const { makeModel } = require('./sqlModel');

module.exports = makeModel({
  table: 'users',
  fields: {
    role: true, name: true, email: true, password: true, phone: true, area: true,
    address: true, lat: true, lng: true, verified: true, rating: true, completed: true,
    totalWasteKg: true, categories: true, earningsToday: true, earningsWeek: true,
    earningsMonth: true, earningsTotal: true, badges: true,
  },
  jsonFields: ['categories', 'badges'],
  defaults: {
    verified: 0, rating: 4, completed: 0, totalWasteKg: 0, categories: [],
    earningsToday: 0, earningsWeek: 0, earningsMonth: 0, earningsTotal: 0, badges: [],
  },
});
