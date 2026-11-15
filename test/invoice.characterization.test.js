var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Synthetic fixtures only. These modules do not load the store or access files.
// Expected figures are literals: neither calculator supplies the other's oracle.
function item(overrides) {
  return Object.assign({
    id: 1, sku: 'TEST-1', name: 'Synthetic tea', hsn: '0902', price: 100, qty: 1
  }, overrides);
}

function order(overrides) {
  return Object.assign({
    id: 1001, date: '15/11/2026', customer: 'Synthetic customer',
    status: 'completed', paymentMode: 'cash', coupon: '',
    items: [item()], subtotal: 100, discount: 0, tax: 18, total: 118
  }, overrides);
}

function amounts(result) {
  return {
    subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total
  };
}

function mixedItems(price) {
  return [
    item({ id: 1, hsn: '1006', price: price }),
    item({ id: 2, hsn: '0405', price: price }),
    item({ id: 3, hsn: '0902', price: price })
  ];
}

test('CURRENT BEHAVIOUR: 18% items without coupons agree with recorded billing', function () {
  var recorded = order();
  var expected = { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 };
  assert.deepEqual(amounts(pricing.computeTotals(recorded.items, '')), expected);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(recorded)), expected);
  assert.deepEqual(reports.getGstReconciliation({ orders: [recorded] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: '15/11/2026', customer: 'Synthetic customer', coupon: '',
      ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 18, ledgerTotal: 118,
      invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: 0, matched: true
    }]
  });
});

test('FIXED: invoice uses the same mixed HSN slabs as checkout', function () {
  var items = mixedItems(100);
  var billed = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures(order({
    items: items, subtotal: 300, tax: 35, total: 335
  }));
  assert.deepEqual(amounts(billed), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(billed.lines.map(function (line) { return line.gstPercent; }), [5, 12, 18]);
  assert.deepEqual(amounts(figures), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.line, row.lineTax];
  }), [['1006', 5, 100, 5], ['0405', 12, 100, 12], ['0902', 18, 100, 18]]);
});

test('FIXED: mixed-slab percentage coupon produces the billed invoice total and GST', function () {
  var items = mixedItems(200);
  var billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(amounts(billed), {
    subtotal: 600, discount: 60, tax: 63, cgst: 31.5, sgst: 31.5, total: 603
  });
  assert.deepEqual(billed.lines.map(function (line) {
    return [line.discount, line.taxable, line.tax, line.net];
  }), [[20, 180, 9, 189], [20, 180, 21.6, 201.6], [20, 180, 32.4, 212.4]]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order({
    items: items, coupon: 'SAVE10', subtotal: 600, discount: 60, tax: 63, total: 603
  }))), { subtotal: 600, discount: 60, tax: 63, cgst: 31.5, sgst: 31.5, total: 603 });
});

test('FIXED: percentage-discounted totals also agree on GST and discount', function () {
  var items = [item({ price: 500 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order({
    items: items, coupon: 'SAVE10', subtotal: 500, discount: 50, tax: 81, total: 531
  }))), { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 });
});

// Some cases model historical/manually supplied orders that checkout validation
// would reject today. They characterize the invoice helper, not route acceptance.
[
  {
    name: 'invoice respects the percentage coupon cap', price: 2000, coupon: 'SAVE10',
    billed: { subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183 },
    invoiced: { subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183 }
  },
  {
    name: 'flat discount reduces the invoice taxable amount', price: 500, coupon: 'FLAT50',
    billed: { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 },
    invoiced: { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 }
  },
  {
    name: 'invoice ignores a coupon below its minimum subtotal', price: 100, coupon: 'SAVE10',
    billed: { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 },
    invoiced: { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 }
  },
  {
    name: 'invoice ignores an inactive coupon', price: 1000, coupon: 'DIWALI20',
    billed: { subtotal: 1000, discount: 0, tax: 180, cgst: 90, sgst: 90, total: 1180 },
    invoiced: { subtotal: 1000, discount: 0, tax: 180, cgst: 90, sgst: 90, total: 1180 }
  },
  {
    name: 'invoice normalizes coupon whitespace and case', price: 500, coupon: ' save10 ',
    billed: { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 },
    invoiced: { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 }
  },
  {
    name: 'invoice does not apply an ineligible flat discount exceeding the order value', price: 10, coupon: 'FLAT50',
    billed: { subtotal: 10, discount: 0, tax: 1.8, cgst: 0.9, sgst: 0.9, total: 11.8 },
    invoiced: { subtotal: 10, discount: 0, tax: 1.8, cgst: 0.9, sgst: 0.9, total: 11.8 }
  }
].forEach(function (scenario) {
  test('FIXED: ' + scenario.name, function () {
    var items = [item({ price: scenario.price })];
    assert.deepEqual(amounts(pricing.computeTotals(items, scenario.coupon)), scenario.billed);
    assert.deepEqual(amounts(invoice.computeInvoiceFigures(order({
      items: items, coupon: scenario.coupon,
      subtotal: scenario.billed.subtotal, discount: scenario.billed.discount,
      tax: scenario.billed.tax, total: scenario.billed.total
    }))), scenario.invoiced);
  });
});

[
  { name: 'CURRENT BEHAVIOUR: numeric percentage override agrees', rate: 5, billedTax: 5, invoiceTax: 5, cgst: 2.5, sgst: 2.5, percent: 5 },
  { name: 'FIXED: decimal GST rate agrees with checkout', rate: 0.05, billedTax: 5, invoiceTax: 5, cgst: 2.5, sgst: 2.5, percent: 5 },
  { name: 'FIXED: zero GST stays zero in invoices', rate: 0, billedTax: 0, invoiceTax: 0, cgst: 0, sgst: 0, percent: 0 },
  { name: 'FIXED: string GST is ignored by both calculators in favor of HSN', rate: '5', billedTax: 18, invoiceTax: 18, cgst: 9, sgst: 9, percent: 18 }
].forEach(function (scenario) {
  test(scenario.name, function () {
    var items = [item({ gstRate: scenario.rate })];
    var billed = pricing.computeTotals(items, '');
    assert.equal(billed.tax, scenario.billedTax);
    assert.equal(billed.total, 100 + scenario.billedTax);
    var figures = invoice.computeInvoiceFigures(order({ items: items }));
    assert.deepEqual(amounts(figures), {
      subtotal: 100, discount: 0, tax: scenario.invoiceTax,
      cgst: scenario.cgst, sgst: scenario.sgst, total: 100 + scenario.invoiceTax
    });
    assert.equal(figures.rows[0].gstPercent, scenario.percent);
  });
});

test('CURRENT BEHAVIOUR: unknown HSN falls back to 18% in both calculators', function () {
  var items = [item({ hsn: 'UNKNOWN' })];
  var expected = { subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118 };
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), expected);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order({ items: items }))), expected);
});

test('FIXED: invoice rounds GST per line like checkout', function () {
  var items = [item({ price: 0.03 }), item({ id: 2, price: 0.03 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  var figures = invoice.computeInvoiceFigures(order({
    items: items, subtotal: 0.06, tax: 0.02, total: 0.08
  }));
  assert.deepEqual(amounts(figures), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('FIXED: invoice splits rounded GST like checkout for one small line', function () {
  var items = [item({ price: 0.03 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), {
    subtotal: 0.03, discount: 0, tax: 0.01, cgst: 0.01, sgst: 0, total: 0.04
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order({ items: items }))), {
    subtotal: 0.03, discount: 0, tax: 0.01, cgst: 0.01, sgst: 0, total: 0.04
  });
});

test('CURRENT BEHAVIOUR: invoice recalculates instead of using stored monetary figures', function () {
  var recorded = order({ subtotal: 900, discount: 20, tax: 30, total: 910 });
  var before = structuredClone(recorded);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(recorded)), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
  invoice.render(recorded);
  reports.getGstReconciliation({ orders: [recorded] });
  assert.deepEqual(recorded, before, 'calculating, rendering and reporting leave the stored order unchanged');
});

test('FIXED: rendered mixed-slab invoice displays billed GST and total without a warning', function () {
  var html = invoice.render(order({ items: mixedItems(100), subtotal: 300, tax: 35, total: 335 }));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹35.00'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹335.00'));
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
});

test('CURRENT BEHAVIOUR: rendered invoice warns about a negative one-paisa total difference', function () {
  var html = invoice.render(order({ total: 118.01 }));
  assert.ok(html.includes('Invoice computed total (₹118.00) differs from Order Ledger recorded total (₹118.01) by -₹0.01.'));
});

test('FIXED: percentage-discounted invoice has matching GST and passes reconciliation', function () {
  var recorded = order({
    items: [item({ price: 500 })], coupon: 'SAVE10',
    subtotal: 500, discount: 50, tax: 81, total: 531
  });
  var html = invoice.render(recorded);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹81.00'));
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
  assert.deepEqual(reports.getGstReconciliation({ orders: [recorded] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: '15/11/2026', customer: 'Synthetic customer', coupon: 'SAVE10',
      ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
      invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true
    }]
  });
});

test('CURRENT BEHAVIOUR: reconciliation sums absolute total differences and excludes cancelled orders', function () {
  // Deliberately inconsistent stored totals preserve coverage of report behavior
  // now that legitimately billed orders no longer produce invoice mismatches.
  var db = { orders: [
    order({ items: mixedItems(100), subtotal: 300, tax: 35, total: 316 }),
    order({ id: 1002, items: [item({ price: 2000 })], coupon: 'SAVE10',
      subtotal: 2000, discount: 150, tax: 333, total: 2242 }),
    order({ id: 1003, status: 'cancelled', total: 999 })
  ] };
  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 2);
  assert.equal(result.totalDelta, 78);
  assert.deepEqual(result.rows.map(function (row) {
    return [row.orderId, row.delta, row.matched];
  }), [[1001, 19, false], [1002, -59, false]]);
});

test('CURRENT BEHAVIOUR: inconsistent stored GST alone fails reconciliation without a total warning', function () {
  var recorded = order({ tax: 17 });
  assert.equal(invoice.render(recorded).includes('Accountant Reconciliation Notice:'), false);
  var result = reports.getGstReconciliation({ orders: [recorded] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.rows[0].ledgerTax, 17);
  assert.equal(result.rows[0].invoiceTax, 18);
});
