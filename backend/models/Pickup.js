const { makeModel } = require('./sqlModel');

module.exports = makeModel({
  table: 'pickups',
  fields: {
    customer: true, collector: true, category: true, qtyEst: true, lat: true, lng: true,
    address: true, pickupTime: true, pickupDate: true, preferredCollector: true, status: true,
  },
  defaults: { collector: null, preferredCollector: null, status: 'REQUESTED' },
  refs: {
    customer: { table: 'users', jsonFields: ['categories', 'badges'] },
    collector: { table: 'users', jsonFields: ['categories', 'badges'] },
    preferredCollector: { table: 'users', jsonFields: ['categories', 'badges'] },
  },
});
