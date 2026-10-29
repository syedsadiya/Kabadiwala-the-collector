const { db } = require('../config/db');

const now = () => new Date().toISOString();
const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

function hydrate(row, jsonFields = []) {
  if (!row) return null;
  const result = { ...row, _id: row.id };
  jsonFields.forEach((field) => {
    if (typeof result[field] === 'string') {
      try { result[field] = JSON.parse(result[field] || '[]'); } catch { result[field] = []; }
    } else if (result[field] == null) {
      result[field] = [];
    }
  });
  ['verified', 'available'].forEach((field) => {
    if (field in result) result[field] = Boolean(result[field]);
  });
  return result;
}

class Query {
  constructor(model, filter) {
    this.model = model;
    this.filter = filter;
    this.order = null;
    this.fields = null;
    this.populates = [];
    this.excludePassword = false;
  }

  sort(order) {
    this.order = order;
    return this;
  }

  select(selection) {
    if (selection.includes('-password')) this.excludePassword = true;
    return this;
  }

  populate(path, select = '') {
    this.populates.push({ path, fields: String(select).split(/\s+/).filter(Boolean) });
    return this;
  }

  async execute() {
    const { where, values } = buildWhere(this.filter);
    const orderBy = this.order
      ? ` ORDER BY ${quote(this.order.replace('-', ''))} ${this.order.startsWith('-') ? 'DESC' : 'ASC'}`
      : '';
    const result = await db.query(`SELECT * FROM ${quote(this.model.table)}${where}${orderBy}`, values);
    const rows = result.rows.map((row) => hydrate(row, this.model.jsonFields));
    for (const doc of rows) {
      for (const { path, fields } of this.populates) {
        const ref = this.model.refs[path];
        if (!ref || doc[path] == null) continue;
        const target = await db.query(`SELECT * FROM ${quote(ref.table)} WHERE id = $1`, [doc[path]]);
        if (!target.rows[0]) continue;
        const full = hydrate(target.rows[0], ref.jsonFields || []);
        delete full.password;
        const picked = { _id: full._id, id: full.id };
        (fields.length ? fields : Object.keys(full)).forEach((field) => {
          if (field in full) picked[field] = full[field];
        });
        doc[path] = picked;
      }
      this.model.decorate(doc);
      if (this.excludePassword) delete doc.password;
    }
    return rows;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

function makeModel({ table, fields, jsonFields = [], defaults = {}, refs = {}, decorate = (row) => row }) {
  const columns = Object.keys(fields);
  const booleanFields = new Set(['verified', 'available']);
  const model = {
    table,
    jsonFields,
    refs,
    decorate,
    async create(input) {
      const values = { ...defaults, ...input, createdAt: input.createdAt || now() };
      const insertColumns = [...columns, 'createdAt'];
      const params = insertColumns.map((column) => serialize(column, values[column], jsonFields, booleanFields));
      const placeholders = params.map((_, index) => `$${index + 1}`).join(', ');
      const result = await db.query(
        `INSERT INTO ${quote(table)} (${insertColumns.map(quote).join(', ')}) VALUES (${placeholders}) RETURNING id`,
        params
      );
      return model.findById(result.rows[0].id);
    },
    async insertMany(inputs) {
      const results = [];
      for (const input of inputs) results.push(await model.create(input));
      return results;
    },
    async findById(id) {
      const result = await db.query(`SELECT * FROM ${quote(table)} WHERE id = $1`, [id]);
      return attach(result.rows[0] ? hydrate(result.rows[0], jsonFields) : null);
    },
    find(filter = {}) {
      return new Query(model, filter);
    },
    async findOne(filter = {}) {
      const rows = await model.find(filter);
      return attach(rows[0] || null);
    },
    async countDocuments(filter = {}) {
      const { where, values } = buildWhere(filter);
      const result = await db.query(`SELECT COUNT(*)::int AS count FROM ${quote(table)}${where}`, values);
      return result.rows[0].count;
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
      const changes = update.$inc
        ? Object.fromEntries(Object.entries(update.$inc).map(([key, value]) => [key, (current[key] || 0) + value]))
        : update;
      const entries = Object.entries(changes).filter(([key]) => columns.includes(key));
      if (!entries.length) return current;
      const params = entries.map(([key, value]) => serialize(key, value, jsonFields, booleanFields));
      const assignments = entries.map((([key], index) => `${quote(key)} = $${index + 1}`)).join(', ');
      await db.query(`UPDATE ${quote(table)} SET ${assignments} WHERE id = $${params.length + 1}`, [...params, id]);
      return model.findById(id);
    },
    async deleteMany(filter = {}) {
      const { where, values } = buildWhere(filter);
      await db.query(`DELETE FROM ${quote(table)}${where}`, values);
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

function serialize(column, value, jsonFields, booleanFields) {
  if (jsonFields.includes(column)) return JSON.stringify(value || []);
  if (booleanFields.has(column)) return Boolean(value);
  return value ?? null;
}

function buildWhere(filter = {}, offset = 0) {
  if (!Object.keys(filter).length) return { where: '', values: [] };
  if (filter.$or) {
    const clauses = [];
    const values = [];
    filter.$or.forEach((condition) => {
      const part = buildWhere(condition, offset + values.length);
      clauses.push(part.where.replace(/^ WHERE /, ''));
      values.push(...part.values);
    });
    return { where: ` WHERE (${clauses.join(' OR ')})`, values };
  }
  const values = [];
  const clauses = Object.entries(filter).map(([key, value]) => {
    const numericKey = ['id', 'customer', 'collector', 'preferredCollector', 'pickup', 'userId', 'collectionId'].includes(key);
    values.push(numericKey && value != null ? Number(value) : typeof value === 'boolean' ? value : value ?? null);
    return `${quote(key)} = $${offset + values.length}`;
  });
  return { where: ` WHERE ${clauses.join(' AND ')}`, values };
}

module.exports = { makeModel, hydrate, db };
