var inventory = require('./inventory');
var ledger = require('./ledger');
var invoice = require('./invoice');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

exports.getDashboardSummary = function (db) {
  var orders = db.orders || [];
  var activeOrders = orders.filter(function (o) {
    return (o.status || 'completed') !== 'cancelled';
  });

  var grossRevenue = 0;
  var totalTaxCollected = 0;
  var totalDiscountGiven = 0;
  var pendingCount = 0;
  var cancelledCount = 0;

  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status === 'cancelled') {
      cancelledCount++;
      continue;
    }
    if (o.status === 'pending') {
      pendingCount++;
    }
    grossRevenue += Number(o.total || 0);
    totalTaxCollected += Number(o.tax || 0);
    totalDiscountGiven += Number(o.discount || 0);
  }

  var customers = ledger.listCustomers(db);
  var totalKhataReceivable = 0;
  for (var j = 0; j < customers.length; j++) {
    totalKhataReceivable += Number(customers[j].balance || 0);
  }

  var invSummary = inventory.summarize(db.products || []);
  var recon = exports.getGstReconciliation(db);

  return {
    grossRevenue: round2(grossRevenue),
    totalTaxCollected: round2(totalTaxCollected),
    totalDiscountGiven: round2(totalDiscountGiven),
    totalOrders: orders.length,
    activeOrdersCount: activeOrders.length,
    pendingCount: pendingCount,
    cancelledCount: cancelledCount,
    totalKhataReceivable: round2(totalKhataReceivable),
    inventory: invSummary,
    reconciliationMismatchCount: recon.mismatchCount,
    reconciliationTotalDelta: recon.totalDelta
  };
};

// Compares stored Order Ledger figures (pricing.js) against Accountant Invoice figures (invoice.js)
exports.getGstReconciliation = function (db) {
  var orders = db.orders || [];
  var rows = [];
  var mismatchCount = 0;
  var totalDelta = 0;

  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status === 'cancelled') continue;

    var inv = invoice.computeInvoiceFigures(o);
    var delta = round2(inv.total - Number(o.total || 0));
    var taxDelta = round2(inv.tax - Number(o.tax || 0));
    var matched = Math.abs(delta) < 0.01 && Math.abs(taxDelta) < 0.01;

    if (!matched) {
      mismatchCount++;
      totalDelta = round2(totalDelta + Math.abs(delta));
    }

    rows.push({
      orderId: o.id,
      date: o.date,
      customer: o.customer || 'Walk-in',
      coupon: o.coupon || '',
      ledgerSubtotal: round2(o.subtotal),
      ledgerDiscount: round2(o.discount),
      ledgerTax: round2(o.tax),
      ledgerTotal: round2(o.total),
      invoiceDiscount: inv.discount,
      invoiceTax: inv.tax,
      invoiceTotal: inv.total,
      delta: delta,
      matched: matched
    });
  }

  return {
    totalChecked: rows.length,
    mismatchCount: mismatchCount,
    totalDelta: totalDelta,
    rows: rows
  };
};
