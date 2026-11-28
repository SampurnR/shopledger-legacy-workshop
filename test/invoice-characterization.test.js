const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');

function item(overrides = {}) {
  return Object.assign({
    id: 1,
    sku: 'SKU-1',
    name: 'Test product',
    hsn: '1006',
    price: 100,
    qty: 1
  }, overrides);
}

function order(items, coupon = '') {
  return {
    id: 1001,
    date: '01/04/2024',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    items: items,
    coupon: coupon
  };
}

test('invoice applies the configured GST slab to each HSN line', function () {
  const printed = invoice.computeInvoiceFigures(order([
    item({ id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 2 }),
    item({ id: 2, name: 'Pulses', hsn: '0713', price: 165, qty: 2 }),
    item({ id: 6, name: 'Ghee', hsn: '0405', price: 450, qty: 2 })
  ]));

  assert.deepEqual(printed.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 18, lineTax: 50.4 },
    { gstPercent: 5, lineTax: 16.5 },
    { gstPercent: 12, lineTax: 108 }
  ]);
  assert.equal(printed.subtotal, 1510);
  assert.equal(printed.tax, 174.9);
  assert.equal(printed.cgst, 87.45);
  assert.equal(printed.sgst, 87.45);
  assert.equal(printed.total, 1684.9);
});

test('SAVE10 invoice matches checkout for Order #1002', function () {
  const printed = invoice.computeInvoiceFigures(order([
    item({ id: 1, hsn: '1006', price: 640, qty: 1 }),
    item({ id: 4, hsn: '1512', price: 190, qty: 2 })
  ], 'SAVE10'));

  assert.equal(printed.subtotal, 1020);
  assert.equal(printed.discount, 102);
  assert.equal(printed.tax, 45.9);
  assert.equal(printed.cgst, 22.95);
  assert.equal(printed.sgst, 22.95);
  assert.equal(printed.total, 963.9);
  assert.deepEqual(printed.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 5, lineTax: 28.8 },
    { gstPercent: 5, lineTax: 17.1 }
  ]);
});

test('SAVE10 invoice respects the ₹150 cap for Order #1004', function () {
  const printed = invoice.computeInvoiceFigures(order([
    item({ id: 5, hsn: '1508', price: 1120, qty: 2 })
  ], 'SAVE10'));

  assert.equal(printed.subtotal, 2240);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 104.5);
  assert.equal(printed.total, 2194.5);
});

test('invoice applies the 12% and 5% slabs for Order #1007', function () {
  const printed = invoice.computeInvoiceFigures(order([
    item({ id: 6, name: 'Ghee', hsn: '0405', price: 450, qty: 2 }),
    item({ id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 })
  ]));

  assert.deepEqual(printed.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), [
    { gstPercent: 12, lineTax: 108 },
    { gstPercent: 5, lineTax: 19 }
  ]);
  assert.equal(printed.tax, 127);
  assert.equal(printed.total, 1407);
});

test('printed invoice shows CGST and SGST split and the billed total', function () {
  const html = invoice.render(order([
    item({ hsn: '1006', price: 100 })
  ]));

  assert.match(html, /<tr><td>CGST<\/td><td class="r">₹2\.50<\/td><\/tr>/);
  assert.match(html, /<tr><td>SGST<\/td><td class="r">₹2\.50<\/td><\/tr>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
});
