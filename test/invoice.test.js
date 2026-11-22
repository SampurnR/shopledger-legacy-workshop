var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

// All fixtures are constructed here. No server or persistence module is loaded.
function item(price, qty, hsn, extra) {
  return Object.assign({
    id: 1,
    name: 'Fixture product',
    sku: 'TEST-001',
    price: price,
    qty: qty,
    hsn: hsn
  }, extra);
}

function order(items, extra) {
  return Object.assign({
    id: 9999,
    date: '15/03/2022',
    customer: 'Fixture customer',
    status: 'completed',
    paymentMode: 'cash',
    coupon: '',
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    items: items
  }, extra);
}

function totals(result) {
  return {
    subtotal: result.subtotal,
    discount: result.discount,
    tax: result.tax,
    cgst: result.cgst,
    sgst: result.sgst,
    total: result.total
  };
}

function ticketCases() {
  return [
    {
      name: 'invoice #1001 respects mixed HSN slabs',
      order: order([item(140, 2, '0902'), item(165, 2, '0713')], {
        id: 1001, subtotal: 610, discount: 0, tax: 66.9, total: 676.9
      }),
      invoice: { subtotal: 610, discount: 0, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9 }
    },
    {
      name: 'invoice #1002 matches the billed total of 963.90 and GST of 45.90',
      order: order([item(640, 1, '1006'), item(190, 2, '1512')], {
        id: 1002, coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
      }),
      invoice: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
    },
    {
      name: 'invoice #1003 apportions FLAT50 before applying mixed GST rates',
      order: order([item(260, 1, '0405'), item(140, 1, '0902')], {
        id: 1003, coupon: 'FLAT50', subtotal: 400, discount: 50, tax: 49.35, total: 399.35
      }),
      invoice: { subtotal: 400, discount: 50, tax: 49.35, cgst: 24.68, sgst: 24.67, total: 399.35 }
    },
    {
      name: 'invoice #1004 respects the SAVE10 discount cap of 150',
      order: order([item(1120, 2, '1508')], {
        id: 1004, coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5
      }),
      invoice: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
    },
    {
      name: 'invoice #1005 respects mixed 5% and 18% HSN slabs',
      order: order([item(640, 1, '1006'), item(180, 2, '2106')], {
        id: 1005, coupon: 'FLAT50', subtotal: 1000, discount: 50, tax: 91.96, total: 1041.96
      }),
      invoice: { subtotal: 1000, discount: 50, tax: 91.96, cgst: 45.98, sgst: 45.98, total: 1041.96 }
    },
    {
      name: 'invoice #1006 calculates WELCOME from the pre-tax subtotal',
      order: order([item(450, 2, '0405'), item(310, 1, '0901')], {
        id: 1006, coupon: 'WELCOME', subtotal: 1210, discount: 60.5, tax: 155.61, total: 1305.11
      }),
      invoice: { subtotal: 1210, discount: 60.5, tax: 155.61, cgst: 77.81, sgst: 77.8, total: 1305.11 }
    },
    {
      name: 'invoice #1007 respects mixed 12% and 5% HSN slabs',
      order: order([item(450, 2, '0405'), item(190, 2, '1512')], {
        id: 1007, status: 'pending', subtotal: 1280, discount: 0, tax: 127, total: 1407
      }),
      invoice: { subtotal: 1280, discount: 0, tax: 127, cgst: 63.5, sgst: 63.5, total: 1407 }
    },
    {
      name: 'invoice #1008 agrees with checkout for 18% items without a coupon',
      order: order([item(140, 1, '0902'), item(180, 2, '2106')], {
        id: 1008, subtotal: 500, discount: 0, tax: 90, total: 590
      }),
      invoice: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 }
    }
  ];
}

ticketCases().forEach(function (sample) {
  test(sample.name, function () {
    assert.deepStrictEqual(totals(invoice.computeInvoiceFigures(sample.order)), sample.invoice);

    var billed = pricing.computeTotals(sample.order.items, sample.order.coupon);
    assert.deepStrictEqual({
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }, {
      subtotal: sample.order.subtotal,
      discount: sample.order.discount,
      tax: sample.order.tax,
      total: sample.order.total
    });
  });
});

test('missing or empty items produce zero figures without a coupon', function () {
  [order([]), order(undefined)].forEach(function (sample) {
    assert.deepStrictEqual(invoice.computeInvoiceFigures(sample), {
      subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
    });
  });
});

test('explicit percentage GST preserves item metadata and numeric totals', function () {
  var result = invoice.computeInvoiceFigures(order([
    item(100, 2, '0405', { name: 'Fixture ghee', sku: 'TEST-GHEE', gstRate: 12 })
  ]));
  assert.deepStrictEqual(totals(result), {
    subtotal: 200, discount: 0, tax: 24, cgst: 12, sgst: 12, total: 224
  });
  assert.deepStrictEqual(result.rows, [{
    name: 'Fixture ghee', sku: 'TEST-GHEE', hsn: '0405', qty: 2,
    price: 100, gstPercent: 12, line: 200, lineTax: 24
  }]);
});

test('missing GST metadata falls back to 18% and placeholder SKU/HSN', function () {
  var result = invoice.computeInvoiceFigures(order([{ name: 'Unclassified', price: 100, qty: 1 }]));
  assert.strictEqual(result.total, 118);
  assert.strictEqual(result.rows[0].gstPercent, 18);
  assert.strictEqual(result.rows[0].sku, '-');
  assert.strictEqual(result.rows[0].hsn, '-');
});

test('fractional gstRate 0.05 is interpreted as 5%', function () {
  var result = invoice.computeInvoiceFigures(order([item(100, 1, undefined, { gstRate: 0.05 })]));
  assert.deepStrictEqual(totals(result), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.strictEqual(result.rows[0].gstPercent, 5);
  assert.strictEqual(result.rows[0].lineTax, 5);
});

test('explicit zero GST remains zero', function () {
  var result = invoice.computeInvoiceFigures(order([item(100, 1, undefined, { gstRate: 0 })]));
  assert.strictEqual(result.tax, 0);
  assert.strictEqual(result.total, 100);
  assert.strictEqual(result.rows[0].gstPercent, 0);
});

test('invoice and checkout agree on GST and discount as well as the final total', function () {
  var sample = order([item(1000, 1, undefined, { gstRate: 18 })], { coupon: 'SAVE10' });
  var calculated = invoice.computeInvoiceFigures(sample);
  var checkout = pricing.computeTotals(sample.items, sample.coupon);
  assert.deepStrictEqual({ discount: calculated.discount, tax: calculated.tax, total: calculated.total }, {
    discount: 100, tax: 162, total: 1062
  });
  assert.deepStrictEqual({ discount: checkout.discount, tax: checkout.tax, total: checkout.total }, {
    discount: 100, tax: 162, total: 1062
  });
  assert.strictEqual(calculated.rows[0].lineTax, 162);
});

test('SAVE10 does not apply below its minimum subtotal', function () {
  var result = invoice.computeInvoiceFigures(order([item(100, 1, '1006')], { coupon: 'SAVE10' }));
  assert.strictEqual(result.discount, 0);
  assert.strictEqual(result.tax, 5);
  assert.strictEqual(result.total, 105);
});

test('an expired DIWALI20 coupon does not discount the invoice', function () {
  var result = invoice.computeInvoiceFigures(order([item(1000, 1, '1006')], { coupon: 'DIWALI20' }));
  assert.strictEqual(result.discount, 0);
  assert.strictEqual(result.tax, 50);
  assert.strictEqual(result.total, 1050);
});

test('invoice coupon lookup normalizes case and whitespace', function () {
  ['save10', ' SAVE10 ', ' save10 '].forEach(function (code) {
    var sample = order([item(1000, 1, undefined, { gstRate: 18 })], { coupon: code });
    var result = invoice.computeInvoiceFigures(sample);
    assert.strictEqual(result.discount, 100);
    assert.strictEqual(result.tax, 162);
    assert.strictEqual(result.total, 1062);
    assert.strictEqual(pricing.computeTotals(sample.items, code).total, 1062);
  });
});

test('unknown coupon codes leave the invoice undiscounted', function () {
  var result = invoice.computeInvoiceFigures(order([item(100, 1)], { coupon: 'NOT_A_COUPON' }));
  assert.strictEqual(result.discount, 0);
  assert.strictEqual(result.total, 118);
});

test('FLAT50 leaves a small order undiscounted rather than making its total negative', function () {
  var result = invoice.computeInvoiceFigures(order([item(20, 1, undefined, { gstRate: 18 })], { coupon: 'FLAT50' }));
  assert.deepStrictEqual(totals(result), {
    subtotal: 20, discount: 0, tax: 3.6, cgst: 1.8, sgst: 1.8, total: 23.6
  });
});

test('rounded row GST sums to the invoice GST', function () {
  var result = invoice.computeInvoiceFigures(order([
    item(0.03, 1, undefined, { gstRate: 18 }),
    item(0.03, 1, undefined, { gstRate: 18 })
  ]));
  assert.deepStrictEqual(result.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepStrictEqual(totals(result), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
});

test('invoice figures are recomputed from items rather than stored ledger figures', function () {
  var result = invoice.computeInvoiceFigures(order([item(100, 1, undefined, { gstRate: 18 })], {
    subtotal: 900, discount: 20, tax: 10, total: 890
  }));
  assert.deepStrictEqual(totals(result), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
});

test('calculation and HTML rendering leave the input order unchanged', function () {
  var sample = ticketCases()[1].order;
  var before = structuredClone(sample);
  invoice.computeInvoiceFigures(sample);
  invoice.render(sample);
  assert.deepStrictEqual(sample, before);
});

test('printed invoice #1002 shows the billed GST and total without a mismatch warning', function () {
  var html = invoice.render(ticketCases()[1].order);
  assert.match(html, /Tax Invoice #1002/);
  assert.match(html, /₹45\.90/);
  assert.match(html, /-₹102\.00/);
  assert.match(html, /₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});

test('a matching invoice omits the reconciliation warning and coupon-discount row', function () {
  var html = invoice.render(ticketCases()[7].order);
  assert.match(html, /₹590\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.doesNotMatch(html, /Coupon Discount \(/);
});

test('a lower computed invoice total displays a negative variance', function () {
  var html = invoice.render(order([item(100, 1, undefined, { gstRate: 18 })], { total: 200 }));
  assert.match(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /-₹82\.00/);
});

test('invoice HTML escapes customer, product and invoice metadata', function () {
  var html = invoice.render(order([
    item(100, 1, '<HSN&1>', { name: '<Rice & Tea>', sku: '<SKU&1>', gstRate: 18 })
  ], {
    customer: '<Buyer & Co>', coupon: '<PROMO&1>', date: '<DATE&1>', total: 118
  }));
  ['&lt;Rice &amp; Tea&gt;', '&lt;SKU&amp;1&gt;', '&lt;HSN&amp;1&gt;',
    '&lt;Buyer &amp; Co&gt;', '&lt;PROMO&amp;1&gt;', '&lt;DATE&amp;1&gt;'].forEach(function (escaped) {
    assert.ok(html.includes(escaped), 'Expected escaped text: ' + escaped);
  });
  assert.doesNotMatch(html, /<Rice & Tea>|<SKU&1>|<Buyer & Co>/);
});

test('invoice HTML supplies defaults for optional metadata', function () {
  var html = invoice.render({ id: 77, items: [{ price: 100, qty: 1 }], total: 118 });
  assert.match(html, /INV-77/);
  assert.match(html, /Walk-in Customer/);
  assert.match(html, /COMPLETED/);
  assert.match(html, /CASH/);
  assert.match(html, /None/);
  assert.doesNotMatch(html, /undefined|null/);
});

test('GST reconciliation matches all eight in-memory ticket orders', function () {
  var db = { orders: ticketCases().map(function (sample) { return sample.order; }) };
  var before = structuredClone(db);
  var result = reports.getGstReconciliation(db);
  assert.strictEqual(result.totalChecked, 8);
  assert.strictEqual(result.mismatchCount, 0);
  assert.strictEqual(result.totalDelta, 0);
  assert.deepStrictEqual(result.rows.map(function (row) { return row.matched; }), [
    true, true, true, true, true, true, true, true
  ]);
  assert.deepStrictEqual(result.rows.map(function (row) { return row.delta; }), [
    0, 0, 0, 0, 0, 0, 0, 0
  ]);
  assert.strictEqual(result.rows[1].ledgerTax, 45.9);
  assert.strictEqual(result.rows[1].invoiceTax, 45.9);
  assert.deepStrictEqual(db, before);
});

test('GST reconciliation still flags genuine GST-only disagreement when final totals match', function () {
  var sample = order([item(1000, 1, undefined, { gstRate: 18 })], {
    coupon: 'SAVE10', subtotal: 1000, discount: 100, tax: 160, total: 1062
  });
  var result = reports.getGstReconciliation({ orders: [sample] });
  assert.strictEqual(result.mismatchCount, 1);
  assert.strictEqual(result.totalDelta, 0);
  assert.strictEqual(result.rows[0].delta, 0);
  assert.strictEqual(result.rows[0].matched, false);
  assert.strictEqual(result.rows[0].invoiceTax, 162);
  assert.strictEqual(result.rows[0].ledgerTax, 160);
});

test('reconciliation skips cancelled orders and includes pending orders', function () {
  var samples = ticketCases();
  samples[1].order.status = 'cancelled';
  var result = reports.getGstReconciliation({ orders: [samples[1].order, samples[6].order] });
  assert.strictEqual(result.totalChecked, 1);
  assert.strictEqual(result.rows[0].orderId, 1007);
  assert.strictEqual(result.rows[0].matched, true);
  assert.strictEqual(result.mismatchCount, 0);
});

test('reconciliation returns an empty audit when there are no orders', function () {
  [{}, { orders: [] }].forEach(function (db) {
    assert.deepStrictEqual(reports.getGstReconciliation(db), {
      totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: []
    });
  });
});
