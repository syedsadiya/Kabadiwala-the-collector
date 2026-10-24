const { makeModel } = require('./sqlModel');

module.exports = makeModel({
  table: 'collections',
  fields: { collectionCode: true, pickup: true, collector: true, customer: true, category: true, weight: true, quality: true, amountPaid: true, paymentMethod: true, notes: true, center: true, recycler: true, status: true, co2: true },
  defaults: { status: 'COLLECTED' },
  refs: {
    customer: { table: 'users', jsonFields: ['categories', 'badges'] },
    collector: { table: 'users', jsonFields: ['categories', 'badges'] },
  },
});
