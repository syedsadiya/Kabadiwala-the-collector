const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  : null;

function requirePool() {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. Set it to the Supabase PostgreSQL connection string.');
  }
  return pool;
}

const db = {
  query(text, values) {
    return requirePool().query(text, values);
  },
  async transaction(callback) {
    const client = await requirePool().connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  pool,
};

async function connectDB() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_initial_schema.sql'), 'utf8');
  await db.query(schema);
  await db.query('SELECT 1');
  console.log('Supabase PostgreSQL database connected');
}

module.exports = connectDB;
module.exports.db = db;
