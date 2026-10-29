require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const sourcePath = process.env.SQLITE_SOURCE || path.join(__dirname, '..', 'kabadiwala.sqlite');
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for SQLite migration.');
}

const sqlite = new Database(sourcePath, { readonly: true });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const tables = [
  { name: 'users', json: ['categories', 'badges'], booleans: ['verified', 'available'] },
  { name: 'centers', json: [], booleans: [] },
  { name: 'recyclers', json: ['accepts'], booleans: ['verified'] },
  { name: 'pickups', json: [], booleans: [] },
  { name: 'collections', json: [], booleans: [] },
  { name: 'reward_transactions', json: [], booleans: [] },
  { name: 'user_badges', json: [], booleans: [] },
];

const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

function convertValue(table, column, value) {
  if (value == null) return null;
  if (table.json.includes(column)) {
    if (typeof value === 'string') {
      try { return JSON.stringify(JSON.parse(value || '[]')); } catch { return JSON.stringify([]); }
    }
    return JSON.stringify(value);
  }
  if (table.booleans.includes(column)) return Boolean(value);
  return value;
}

async function importTable(client, table) {
  const rows = sqlite.prepare(`SELECT * FROM ${quote(table.name)}`).all();
  const columns = rows.length ? Object.keys(rows[0]) : [];
  let imported = 0;
  for (const row of rows) {
    const values = columns.map((column) => convertValue(table, column, row[column]));
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const result = await client.query(
      `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(', ')})
       VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values
    );
    imported += result.rowCount;
  }
  if (columns.includes('id')) {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX(id) FROM ${quote(table.name)}), 1),
        true
      )
    `, [table.name]);
  }
  const destination = await client.query(`SELECT COUNT(*)::int AS count FROM ${quote(table.name)}`);
  if (destination.rows[0].count < rows.length) {
    throw new Error(`${table.name}: destination count is lower than source (${destination.rows[0].count} < ${rows.length})`);
  }
  console.log(`${table.name}: source=${rows.length}, inserted=${imported}, destination=${destination.rows[0].count}`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const schema = require('fs').readFileSync(path.join(__dirname, '..', 'migrations', '001_initial_schema.sql'), 'utf8');
    await client.query(schema);
    for (const table of tables) await importTable(client, table);
    await client.query('COMMIT');
    console.log(`Migration verified from ${sourcePath}. The SQLite source was opened read-only and was not modified.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((error) => {
  console.error('SQLite migration failed:', error.message);
  process.exitCode = 1;
});
