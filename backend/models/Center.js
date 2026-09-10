const { makeModel } = require('./sqlModel');

module.exports = makeModel({
  table: 'centers',
  fields: { name: true, area: true, incoming: true, outgoing: true },
  defaults: { incoming: 0, outgoing: 0 },
});
