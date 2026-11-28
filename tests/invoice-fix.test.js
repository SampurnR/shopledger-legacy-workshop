const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');

test('invoice applies 5% GST after SAVE10 and matches the amount billed', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', qty: 1, price: 1020 }],
    coupon: 'SAVE10',
    discount: 102,
    tax: 45.90,
    total: 963.90
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.total, order.total);
  assert.equal(printed.tax, order.tax);
  assert.equal(printed.discount, order.discount);
  assert.equal(printed.rows[0].gstPercent, 5);
});
