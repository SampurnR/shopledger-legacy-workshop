var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

// Order numbers identify the scenarios these in-memory fixtures are modeled on.
// Undefined rates model order lines that rely on HSN classification at checkout.
var scenarios = [
  {
    name: '#1001 uses the 5% and 12% HSN slabs',
    coupon: '',
    items: [
      { name: 'Rice', price: 200, qty: 2, hsn: '1006', gstRate: undefined },
      { name: 'Ghee', price: 250, qty: 1, hsn: '0405', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 650, discount: 0, tax: 50, cgst: 25, sgst: 25, total: 700 },
    invoiceRows: [
      { gstPercent: 5, line: 400, lineTax: 20 },
      { gstPercent: 12, line: 250, lineTax: 30 }
    ],
    checkoutTotals: { discount: 0, tax: 50, total: 700 },
    checkoutRates: [5, 12]
  },
  {
    name: '#1002 applies SAVE10 before GST',
    coupon: 'SAVE10',
    items: [
      { name: 'Rice', price: 640, qty: 1, hsn: '1006', gstRate: undefined },
      { name: 'Sunflower oil', price: 190, qty: 2, hsn: '1512', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    invoiceRows: [
      { gstPercent: 5, line: 640, lineTax: 28.8 },
      { gstPercent: 5, line: 380, lineTax: 17.1 }
    ],
    checkoutTotals: { discount: 102, tax: 45.9, total: 963.9 },
    checkoutRates: [5, 5]
  },
  {
    name: '#1004 applies the 150 rupee SAVE10 cap before GST',
    coupon: 'SAVE10',
    items: [
      { name: 'Groundnut oil', price: 560, qty: 4, hsn: '1508', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    invoiceRows: [
      { gstPercent: 5, line: 2240, lineTax: 104.5 }
    ],
    checkoutTotals: { discount: 150, tax: 104.5, total: 2194.5 },
    checkoutRates: [5]
  },
  {
    name: '#1008 agrees with checkout for 18% items without a coupon',
    coupon: '',
    items: [
      { name: 'Tea', price: 175, qty: 2, hsn: '0902', gstRate: undefined },
      { name: 'Coffee', price: 125, qty: 1, hsn: '0901', gstRate: 18 }
    ],
    invoiceTotals: { subtotal: 475, discount: 0, tax: 85.5, cgst: 42.75, sgst: 42.75, total: 560.5 },
    invoiceRows: [
      { gstPercent: 18, line: 350, lineTax: 63 },
      { gstPercent: 18, line: 125, lineTax: 22.5 }
    ],
    checkoutTotals: { discount: 0, tax: 85.5, total: 560.5 },
    checkoutRates: [18, 18]
  }
];

scenarios.forEach(function (scenario) {
  test('CURRENT BEHAVIOUR: ' + scenario.name, function () {
    var figures = invoice.computeInvoiceFigures({ items: scenario.items, coupon: scenario.coupon });
    var checkout = pricing.computeTotals(scenario.items, scenario.coupon);

    assert.deepEqual({
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total
    }, scenario.invoiceTotals);
    assert.deepEqual(figures.rows.map(function (row) {
      return { gstPercent: row.gstPercent, line: row.line, lineTax: row.lineTax };
    }), scenario.invoiceRows);

    assert.deepEqual({
      discount: checkout.discount,
      tax: checkout.tax,
      total: checkout.total
    }, scenario.checkoutTotals);
    assert.deepEqual(checkout.lines.map(function (line) {
      return line.gstPercent;
    }), scenario.checkoutRates);
  });
});

test('invoice matches checkout for mixed GST slabs and a capped coupon', function () {
  var items = [
    { name: 'Rice', price: 750, qty: 2, hsn: '1006' },
    { name: 'Ghee', price: 750, qty: 1, hsn: '0405' }
  ];
  var coupon = 'SAVE10';
  var checkout = pricing.computeTotals(items, coupon);
  var savedOrder = {
    id: 1,
    items: items,
    coupon: coupon,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  };
  var figures = invoice.computeInvoiceFigures(savedOrder);

  assert.equal(checkout.discount, 150);
  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total
  });
  assert.deepEqual(figures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 70 },
    { gstPercent: 12, lineTax: 84 }
  ]);

  var html = invoice.render(savedOrder);
  assert.match(html, /Gross Subtotal<\/td><td class="r">₹2250\.00<\/td>/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹154\.00<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2254\.00<\/td>/);
  assert.match(html, /5%<\/td><td class="r">₹70\.00<\/td>/);
  assert.match(html, /12%<\/td><td class="r">₹84\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  var reconciliation = reports.getGstReconciliation({ orders: [savedOrder] });
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
