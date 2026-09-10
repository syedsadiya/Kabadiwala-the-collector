const { makeModel } = require('./sqlModel');

module.exports = makeModel({
  table: 'recyclers',
  fields: { name: true, location: true, accepts: true, contact: true, verified: true, capacity: true, status: true },
  jsonFields: ['accepts'],
  defaults: { accepts: [], verified: 0, status: 'Pending verification' },
});
