const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'kabadiwala.sqlite'));
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT NOT NULL, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, phone TEXT, area TEXT,
      address TEXT, lat REAL, lng REAL, verified INTEGER DEFAULT 0, rating REAL DEFAULT 4,
      completed INTEGER DEFAULT 0, totalWasteKg REAL DEFAULT 0, categories TEXT DEFAULT '[]',
      earningsToday REAL DEFAULT 0, earningsWeek REAL DEFAULT 0, earningsMonth REAL DEFAULT 0,
      earningsTotal REAL DEFAULT 0, badges TEXT DEFAULT '[]', createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, area TEXT,
      incoming INTEGER DEFAULT 0, outgoing INTEGER DEFAULT 0, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recyclers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT,
      accepts TEXT DEFAULT '[]', contact TEXT, verified INTEGER DEFAULT 0,
      capacity TEXT, status TEXT DEFAULT 'Pending verification', createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pickups (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer INTEGER NOT NULL, collector INTEGER,
      category TEXT NOT NULL, qtyEst REAL NOT NULL, lat REAL, lng REAL, address TEXT,
      pickupTime TEXT, status TEXT DEFAULT 'REQUESTED', createdAt TEXT NOT NULL,
      FOREIGN KEY (customer) REFERENCES users(id), FOREIGN KEY (collector) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, collectionCode TEXT NOT NULL UNIQUE,
      pickup INTEGER NOT NULL, collector INTEGER NOT NULL, customer INTEGER NOT NULL,
      category TEXT, weight REAL, quality TEXT, amountPaid REAL, paymentMethod TEXT,
      notes TEXT, center TEXT, recycler TEXT, status TEXT DEFAULT 'COLLECTED', co2 REAL,
      createdAt TEXT NOT NULL, FOREIGN KEY (pickup) REFERENCES pickups(id),
      FOREIGN KEY (collector) REFERENCES users(id), FOREIGN KEY (customer) REFERENCES users(id)
    );
  `);
}

// Adds a column only if it is missing, so an existing kabadiwala.sqlite keeps its data.
function addColumnIfMissing(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}


function migrate() {
  addColumnIfMissing('users', 'available', 'INTEGER DEFAULT 1');
  addColumnIfMissing('pickups', 'pickupDate', 'TEXT');
  addColumnIfMissing('pickups', 'preferredCollector', 'INTEGER');

  // Green Rewards: keep a permanent record of each points award.
  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer INTEGER NOT NULL,
      pickup INTEGER NOT NULL,
      collectionId INTEGER NOT NULL UNIQUE,
      category TEXT NOT NULL,
      weight REAL NOT NULL CHECK (weight > 0),
      points INTEGER NOT NULL CHECK (points >= 0),
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customer) REFERENCES users(id),
      FOREIGN KEY (pickup) REFERENCES pickups(id),
      FOREIGN KEY (collectionId) REFERENCES collections(id)
    );

    CREATE INDEX IF NOT EXISTS idx_rewards_customer
      ON reward_transactions(customer);

    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      badgeKey TEXT NOT NULL,
      earnedAt TEXT NOT NULL,
      UNIQUE (userId, badgeKey),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_badges_user
      ON user_badges(userId);

    CREATE INDEX IF NOT EXISTS idx_pickups_status
      ON pickups(status);

    CREATE INDEX IF NOT EXISTS idx_pickups_customer
      ON pickups(customer);

    CREATE INDEX IF NOT EXISTS idx_collections_collector
      ON collections(collector);
  `);
}


async function connectDB() {
  initSchema();
  migrate();
  console.log('SQLite database connected');
}

module.exports = connectDB;
module.exports.db = db;
