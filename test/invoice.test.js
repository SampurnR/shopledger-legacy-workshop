const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function checkoutOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon);
  return {
    id: 42,
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice figures match checkout totals and HSN GST after coupon allocation', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice uses checkout pricing for percent coupons and the same line taxes', () => {
  const order = checkoutOrder([
    { id: 2, name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 10);
  assert.equal(order.tax, 9.5);
  assert.equal(order.total, 199.5);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 9.5);
});

test('invoice line gross remains before discount while GST reflects discounted taxable value', () => {
  const order = checkoutOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].line, 100);
  assert.equal(figures.rows[0].lineTax, 17.1);
  assert.equal(figures.total, order.total);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

test('invoice preserves recorded totals for orders with a coupon that has since expired', () => {
  const order = {
    id: 44,
    coupon: 'DIWALI20',
    subtotal: 1500,
    discount: 250,
    tax: 225,
    total: 1475,
    items: [{ name: 'Packaged tea', hsn: '0902', price: 1500, qty: 1 }]
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 250);
  assert.equal(figures.tax, 225);
  assert.equal(figures.total, 1475);
  assert.equal(figures.rows[0].lineTax, 225);
  assert.doesNotMatch(invoice.render(order), /differs from Order Ledger recorded total/);
});

