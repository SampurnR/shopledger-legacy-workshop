const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice uses the same HSN GST and discount calculation as pricing', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ];
  const order = {
    items,
    coupon: 'WELCOME'
  };

  const billed = pricing.computeTotals(items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice uses the same coupon cap and total as pricing', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ];
  const order = {
    items,
    coupon: 'SAVE10'
  };

  const billed = pricing.computeTotals(items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice interprets decimal gstRate the same way as pricing and prints the matching rate', function () {
  const items = [
    { id: 2, name: 'Special rate item', gstRate: 0.05, hsn: '1006', price: 100, qty: 1 }
  ];
  const order = { items, coupon: '' };

  const billed = pricing.computeTotals(items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice uses pricing GST breakdown including its rounding', function () {
  const items = [
    { id: 3, name: 'Item A', price: 0.05, qty: 1, gstRate: 5 },
    { id: 4, name: 'Item B', price: 0.05, qty: 1, gstRate: 5 }
  ];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({
    items,
    coupon: ''
  });

  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
});
