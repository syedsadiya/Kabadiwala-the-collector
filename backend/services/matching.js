// Smart Collector Matching — explainable, no ML.
//
// Step 1  ELIGIBILITY (hard filters): the collector must be a collector account,
//         marked available, and accept the requested waste category.
// Step 2  RANKING (transparent score out of 100):
//           60%  proximity   = 1 - distance / MAX_RADIUS_KM   (0 when location unknown)
//           25%  rating      = collector rating / 5
//           15%  experience  = completed pickups / EXPERIENCE_CAP (capped at 1)
//         Ties are broken by shorter distance.
// Every result carries the breakdown and human-readable reasons so the UI can
// show *why* a collector was recommended.
const { AP_AREAS } = require('../constants');

const WEIGHTS = { proximity: 0.6, rating: 0.25, experience: 0.15 };
const MAX_RADIUS_KM = 50;
const EXPERIENCE_CAP = 50;

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Collector position: stored lat/lng, else the centre of their registered area.
function collectorPosition(c) {
  if (c.lat != null && c.lng != null) return { lat: c.lat, lng: c.lng, source: 'gps' };
  const area = AP_AREAS.find((a) => a.name === c.area);
  return area ? { lat: area.lat, lng: area.lng, source: 'area' } : null;
}

function accepts(collector, category) {
  const cats = Array.isArray(collector.categories) ? collector.categories : [];
  return cats.length === 0 ? false : cats.includes(category);
}

function matchCollectors(pickup, collectors) {

  const excluded = {
  unavailable: 0,
  wrongCategory: 0,
  unverified: 0
};

const matches = [];

for (const c of collectors) {
  if (c.role !== 'collector') continue;

  if (!c.verified) {
    excluded.unverified += 1;
    continue;
  }

  if (!c.available) {
    excluded.unavailable += 1;
    continue;
  }

  if (!accepts(c, pickup.category)) {
    excluded.wrongCategory += 1;
    continue;
  }
    const pos = collectorPosition(c);
    const distanceKm = pos && pickup.lat != null && pickup.lng != null
      ? +haversineKm(pickup.lat, pickup.lng, pos.lat, pos.lng).toFixed(1)
      : null;

    const proximity = distanceKm == null ? 0 : Math.max(0, 1 - distanceKm / MAX_RADIUS_KM);
    const rating = Math.min(Math.max((c.rating || 0) / 5, 0), 1);
    const experience = Math.min((c.completed || 0) / EXPERIENCE_CAP, 1);
    const score = +(100 * (WEIGHTS.proximity * proximity + WEIGHTS.rating * rating + WEIGHTS.experience * experience)).toFixed(1);

    const reasons = [
      `Accepts ${pickup.category}`,
      distanceKm == null ? 'Distance unknown' : `${distanceKm} km away${pos.source === 'area' ? ' (area centre)' : ''}`,
      `Rated ${c.rating ?? '–'} / 5`,
      `${c.completed || 0} pickups completed`,
    ];

    matches.push({
      _id: c._id, id: c.id, name: c.name, area: c.area, rating: c.rating, completed: c.completed,
      verified: Boolean(c.verified), categories: c.categories, distanceKm, score,
      breakdown: {
        proximity: +(WEIGHTS.proximity * proximity * 100).toFixed(1),
        rating: +(WEIGHTS.rating * rating * 100).toFixed(1),
        experience: +(WEIGHTS.experience * experience * 100).toFixed(1),
      },
      reasons,
    });
  }

  matches.sort((a, b) => b.score - a.score || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  matches.forEach((m, i) => { m.rank = i + 1; m.recommended = i === 0; });
  return { matches, excluded };
}

module.exports = { matchCollectors, haversineKm, collectorPosition, accepts, WEIGHTS, MAX_RADIUS_KM, EXPERIENCE_CAP };
