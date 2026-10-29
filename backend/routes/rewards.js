
const router = require('express').Router();
const { db } = require('../models/sqlModel');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/rewards/mine
// Customer's points, history and earned badges.
router.get('/mine', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const customerId = req.user.id;

    const balanceResult = await db.query(`
      SELECT COALESCE(SUM(points), 0)::int AS "totalPoints",
             COUNT(*)::int AS "completedPickups",
             COALESCE(SUM(weight), 0) AS "totalWasteKg"
      FROM reward_transactions
      WHERE customer = $1
    `, [customerId]);
    const balance = balanceResult.rows[0];

    const historyResult = await db.query(`
      SELECT id, pickup, category, weight, points, "createdAt"
      FROM reward_transactions
      WHERE customer = $1
      ORDER BY id DESC
    `, [customerId]);

    const badgesResult = await db.query(`
      SELECT "badgeKey", "earnedAt"
      FROM user_badges
      WHERE "userId" = $1
      ORDER BY id DESC
    `, [customerId]);

    res.json({
      rewards: {
        totalPoints: balance.totalPoints,
        completedPickups: balance.completedPickups,
        totalWasteKg: Number(balance.totalWasteKg.toFixed(2)),
        level: balance.totalPoints >= 500 ? 'Eco Champion'
          : balance.totalPoints >= 100 ? 'Eco Warrior'
          : 'Eco Starter',
        history: historyResult.rows,
        badges: badgesResult.rows,
      },
    });
  } catch (err) {
    console.error('Rewards lookup failed:', err);
    res.status(500).json({ message: 'Could not load rewards' });
  }
});

// GET /api/rewards/leaderboard
// Shows the top 10 customers by earned points.
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id AS "userId",
             u.name AS name,
             COALESCE(SUM(r.points), 0)::int AS "totalPoints",
             COUNT(r.id)::int AS "completedPickups",
             COALESCE(SUM(r.weight), 0) AS "totalWasteKg"
      FROM users u
      LEFT JOIN reward_transactions r ON r.customer = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.name
      HAVING COUNT(r.id) > 0
      ORDER BY "totalPoints" DESC, "completedPickups" DESC, u.name ASC
      LIMIT 10
    `);

    res.json({ leaderboard: result.rows });
  } catch (err) {
    console.error('Leaderboard lookup failed:', err);
    res.status(500).json({ message: 'Could not load leaderboard' });
  }
});

module.exports = router;
