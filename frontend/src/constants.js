export const AP_AREAS = [
  { name: 'Kakinada', lat: 16.9891, lng: 82.2475 },
  { name: 'Rajahmundry', lat: 17.0005, lng: 81.8040 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Amaravati', lat: 16.5738, lng: 80.3565 },
];

// One set of labels / colours used on every page.
export const STATUS_LABEL = {
  REQUESTED: 'Requested', ACCEPTED: 'Accepted', COLLECTED: 'Collected', VERIFIED: 'Verified',
  SENT_TO_RECYCLER: 'Sent to recycler', RECYCLED: 'Recycled', CANCELLED: 'Cancelled',
};
export const STATUS_PILL = {
  REQUESTED: 'pill-amber', ACCEPTED: 'pill-blue', COLLECTED: 'pill-green', VERIFIED: 'pill-green',
  SENT_TO_RECYCLER: 'pill-green', RECYCLED: 'pill-green', CANCELLED: 'pill-grey',
};
export const PICKUP_STEPS = ['REQUESTED', 'ACCEPTED', 'COLLECTED', 'VERIFIED', 'SENT_TO_RECYCLER', 'RECYCLED'];
