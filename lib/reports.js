var inventory = require('./inventory');
var ledger = require('./ledger');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.getDashboardSummary = function (db) {
  var orders = db.orders || [];
  var grossRevenue = 0;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].status !== 'cancelled') grossRevenue += Number(orders[i].total || 0);
  }
  return {
    grossRevenue: round2(grossRevenue),
    totalOrders: orders.length,
    inventory: inventory.summarize(db.products || [])
  };
};
