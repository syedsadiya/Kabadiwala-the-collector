const { db } = require('../config/db');

const now = () => new Date().toISOString();

function hydrate(row, jsonFields = []) {
  if (!row) return null;
  const result = { ...row, _id: row.id };
  jsonFields.forEach((field) => {
    try { result[field] = JSON.parse(result[field] || '[]'); } catch { result[field] = []; }
  });
  ['verified'].forEach((field) => {
    if (field in result) result[field] = Boolean(result[field]);
  });
  return result;
}

class Query {
  constructor(model, rows) {
    this.model = model;
    this.rows = rows;
    this.populates = [];
    this.excludePassword = false;
  }

  sort(order) {
    const field = order.replace('-', '');
    const direction = order.startsWith('-') ? -1 : 1;
    this.rows.sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')) * direction);
    return this;
  }

  select(selection) {
    if (selection.includes('-password')) this.excludePassword = true;
    return this;
  }

  populate(path) {
    this.populates.push(path);
    return this;
  }

  then(resolve, reject) {
    try {
      const result = this.rows.map((row) => this.model.decorate(hydrate(row, this.model.jsonFields), this.populates));
      if (this.excludePassword) result.forEach((row) => delete row.password);
      return Promise.resolve(result).then(resolve, reject);
    } catch (error) {
      return Promise.reject(error).then(resolve, reject);
    }
  }
}

function makeModel({ table, fields, jsonFields = [], defaults = {}, decorate = (row) => row }) {
  const columns = Object.keys(fields);
  const model = {
    jsonFields,
    decorate,
    async create(input) {
      const values = { ...defaults, ...input, createdAt: now() };
      const serialized = columns.map((column) => jsonFields.includes(column) ? JSON.stringify(values[column] || []) : sqlValue(values[column]));
      const result = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}, createdAt) VALUES (${columns.map(() => '?').join(', ')}, ?)`).run(...serialized, values.createdAt);
      return model.findById(result.lastInsertRowid);
    },
    async insertMany(inputs) {
      const results = [];
      for (const input of inputs) results.push(await model.create(input));
      return results;
    },
    async findById(id) {
      return attach(hydrate(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id), jsonFields));
    },
    find(filter = {}) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all().filter((row) => matches(row, filter));
      return new Query(model, rows);
    },
    async findOne(filter = {}) {
      const row = db.prepare(`SELECT * FROM ${table}`).all().find((candidate) => matches(candidate, filter));
      return attach(hydrate(row, jsonFields));
    },
    async countDocuments(filter = {}) {
      return db.prepare(`SELECT * FROM ${table}`).all().filter((row) => matches(row, filter)).length;
    },
    async findByIdAndUpdate(id, update) {
      return model.updateById(id, update);
    },
    async findOneAndUpdate(filter, update) {
      const row = await model.findOne(filter);
      return row ? model.updateById(row._id, update) : null;
    },
    async updateById(id, update) {
      const current = await model.findById(id);
      if (!current) return null;
      const changes = update.$inc ? Object.fromEntries(Object.entries(update.$inc).map(([key, value]) => [key, (current[key] || 0) + value])) : update;
      const entries = Object.entries(changes).filter(([key]) => columns.includes(key));
      if (entries.length) {
        const values = entries.map(([key, value]) => `${key} = ?`);
        const params = entries.map(([key, value]) => jsonFields.includes(key) ? JSON.stringify(value || []) : sqlValue(value));
        db.prepare(`UPDATE ${table} SET ${values.join(', ')} WHERE id = ?`).run(...params, id);
      }
      return model.findById(id);
    },
    async deleteMany(filter = {}) {
      const rows = db.prepare(`SELECT id FROM ${table}`).all().filter((row) => matches(row, filter));
      const statement = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
      rows.forEach(({ id }) => statement.run(id));
    },
  };
  function attach(row) {
    if (!row) return null;
    row.toObject = () => ({ ...row });
    row.save = async () => model.updateById(row._id, row);
    return row;
  }
  return model;
}

function matches(row, filter) {
  if (filter.$or) return filter.$or.some((condition) => matches(row, condition));
  return Object.entries(filter).every(([key, value]) => {
    const normalized = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    return String(row[key]) === String(normalized);
  });
}

function sqlValue(value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value ?? null;
}

module.exports = { makeModel, hydrate, db };
