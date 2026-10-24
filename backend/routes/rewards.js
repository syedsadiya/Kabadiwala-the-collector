
const router = require('express').Router();
const { db } = require('../models/sqlModel');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/rewards/mine
// Customer's points, history and earned badges.
router.get('/mine', requireAuth, requireRole('customer'), (req, res) => {
  try {
    const customerId = req.user.id;

    const balance = db.prepare(`
      SELECT COALESCE(SUM(points), 0) AS totalPoints,
             COUNT(*) AS completedPickups,
             COALESCE(SUM(weight), 0) AS totalWasteKg
      FROM reward_transactions
      WHERE customer = ?
    `).get(customerId);

    const history = db.prepare(`
      SELECT id, pickup, category, weight, points, createdAt
      FROM reward_transactions
      WHERE customer = ?
      ORDER BY id DESC
    `).all(customerId);

    const badges = db.prepare(`
      SELECT badgeKey, earnedAt
      FROM user_badges
      WHERE userId = ?
      ORDER BY id DESC
    `).all(customerId);

    res.json({
      rewards: {
        totalPoints: balance.totalPoints,
        completedPickups: balance.completedPickups,
        totalWasteKg: Number(balance.totalWasteKg.toFixed(2)),
        level: balance.totalPoints >= 500 ? 'Eco Champion'
          : balance.totalPoints >= 100 ? 'Eco Warrior'
          : 'Eco Starter',
        history,
        badges,
      },
    });
  } catch (err) {
    console.error('Rewards lookup failed:', err);
    res.status(500).json({ message: 'Could not load rewards' });
  }
});

// GET /api/rewards/leaderboard
// Shows the top 10 customers by earned points.
router.get('/leaderboard', requireAuth, (req, res) => {
  try {
    const leaderboard = db.prepare(`
      SELECT u.id AS userId,
             u.name AS name,
             COALESCE(SUM(r.points), 0) AS totalPoints,
             COUNT(r.id) AS completedPickups,
             COALESCE(SUM(r.weight), 0) AS totalWasteKg
      FROM users u
      LEFT JOIN reward_transactions r ON r.customer = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.name
      HAVING COUNT(r.id) > 0
      ORDER BY totalPoints DESC, completedPickups DESC, u.name ASC
      LIMIT 10
    `).all();

    res.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard lookup failed:', err);
    res.status(500).json({ message: 'Could not load leaderboard' });
  }
});

module.exports = router;
