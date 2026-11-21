var test = require('node:test');
var assert = require('node:assert').strict;

var config = require('../config');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

// The fixtures keep the original line items, coupons, and recorded totals in memory.
var orders = {
  1001: {
    id: 1001,
    coupon: '',
    total: 676.90,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
      { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
    ]
  },
  1002: {
    id: 1002,
    coupon: 'SAVE10',
    total: 963.90,
    items: [
      { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  },
  1004: {
    id: 1004,
    coupon: 'SAVE10',
    total: 2194.50,
    items: [
      { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
    ]
  },
  1007: {
    id: 1007,
    coupon: '',
    total: 1407.00,
    items: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  },
  1008: {
    id: 1008,
    coupon: '',
    total: 590.00,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
      { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
    ]
  }
};

function orderFigures(figures) {
  var { subtotal, discount, tax, cgst, sgst, total } = figures;
  return { subtotal, discount, tax, cgst, sgst, total };
}

var billedFiguresByOrder = {
  1001: { subtotal: 610, discount: 0, taxable: 610, tax: 66.90, cgst: 33.45, sgst: 33.45, total: 676.90 },
  1002: { subtotal: 1020, discount: 102, taxable: 918, tax: 45.90, cgst: 22.95, sgst: 22.95, total: 963.90 },
  1004: { subtotal: 2240, discount: 150, taxable: 2090, tax: 104.50, cgst: 52.25, sgst: 52.25, total: 2194.50 },
  1007: { subtotal: 1280, discount: 0, taxable: 1280, tax: 127, cgst: 63.50, sgst: 63.50, total: 1407 },
  1008: { subtotal: 500, discount: 0, taxable: 500, tax: 90, cgst: 45, sgst: 45, total: 590 }
};

// Check checkout against the billed figures before using it to verify the invoice.
Object.keys(billedFiguresByOrder).forEach(function (id) {
  test('EXPECTED: invoice #' + id + ' matches checkout', function () {
    var order = orders[id];
    var checkout = pricing.computeTotals(order.items, order.coupon);
    var printed = invoice.computeInvoiceFigures(order);

    assert.deepEqual({ ...orderFigures(checkout), taxable: checkout.taxable }, billedFiguresByOrder[id], 'Checkout figures');
    assert.deepEqual(orderFigures(printed), orderFigures(checkout), 'Invoice figures');
  });
});

// The configured fallback is 18% for an item without a GST rate or a mapped HSN.
test('invoice uses the configured 18% fallback for an unclassified item without gstRate', function () {
  var order = { items: [{ name: 'Unclassified item', price: 100, qty: 1 }] };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(config.tax.defaultRate, 0.18);
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.tax, 18);
  assert.equal(figures.total, 118);
});

// The correct SAVE10 discount on order #1004 is capped at ₹150.00.
test('invoice applies the ₹150 SAVE10 cap on #1004', function () {
  var figures = invoice.computeInvoiceFigures(orders[1004]);

  assert.equal(figures.discount, 150);
  assert.equal(figures.discount, config.coupons.SAVE10.maxDiscount);
});

// Groundnut oil HSN 1508 should use 5%, giving ₹104.50 GST on ₹2,090.00 after discount.
test('invoice taxes groundnut oil HSN 1508 at 5% after discount', function () {
  var invoiceLine = invoice.computeInvoiceFigures(orders[1004]).rows[0];

  assert.equal(invoiceLine.hsn, '1508');
  assert.equal(invoiceLine.gstPercent, 5);
  assert.equal(invoiceLine.lineTax, 104.50);
});

// Order #1002 shows ₹963.90 and splits ₹45.90 GST into two amounts of ₹22.95.
test('render prints the billed total and per-line and split GST for #1002', function () {
  var html = invoice.render(orders[1002]);

  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹963.90</td>'));
  assert.ok(html.includes('<td class="r">5%</td><td class="r">₹28.80</td>'));
  assert.ok(html.includes('<td class="r">5%</td><td class="r">₹17.10</td>'));
  assert.ok(html.includes('<td>CGST</td><td class="r">₹22.95</td>'));
  assert.ok(html.includes('<td>SGST</td><td class="r">₹22.95</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
