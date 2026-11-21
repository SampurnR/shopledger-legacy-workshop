const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('invoice matches checkout for HSN slabs and a proportional SAVE10 discount', function () {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    total: 963.90,
    items: [
      { name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 1020, discount: 102, tax: 45.90, total: 963.90 }
  );
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [28.80, 17.10]);
});

test('invoice respects the SAVE10 maximum discount on a wholesale order', function () {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    total: 2194.50,
    items: [
      { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 2240, discount: 150, tax: 104.50, total: 2194.50 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies each saved line item HSN rate when no coupon is used', function () {
  const order = {
    id: 1001,
    coupon: '',
    total: 676.90,
    items: [
      { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 2 },
      { name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', price: 165, qty: 2 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 610, discount: 0, tax: 66.90, total: 676.90 }
  );
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
});