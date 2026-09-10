const { makeModel } = require('./sqlModel');

module.exports = makeModel({
  table: 'pickups',
  fields: { customer: true, collector: true, category: true, qtyEst: true, lat: true, lng: true, address: true, pickupTime: true, status: true },
  defaults: { collector: null, status: 'REQUESTED' },
});
