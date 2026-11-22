const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');

test('Invoice total and GST breakdown match the figures used to bill the order', () => {
  const order = {
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
});

test('invoice applies the same HSN slab as order pricing', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.equal(pricing.computeTotals(items, '').total, 105);
  assert.deepEqual(invoice.computeInvoiceFigures({ items }).rows[0], {
    name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100,
    gstPercent: 5, line: 100, lineTax: 5
  });
  assert.equal(invoice.computeInvoiceFigures({ items }).total, 105);
});

test('invoice uses the same decimal gstRate interpretation as order pricing', () => {
  const items = [{ name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];

  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.equal(pricing.computeTotals(items, '').total, 105);
  assert.equal(invoice.computeInvoiceFigures({ items }).rows[0].gstPercent, 5);
  assert.equal(invoice.computeInvoiceFigures({ items }).total, 105);
});

test('invoice applies the same coupon discount base as order pricing', () => {
  const items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const priced = pricing.computeTotals(items, 'WELCOME');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'WELCOME' });

  assert.deepEqual(
    { subtotal: priced.subtotal, discount: priced.discount, tax: priced.tax, total: priced.total },
    { subtotal: 100, discount: 5, tax: 4.75, total: 99.75 }
  );
  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, total: invoiced.total },
    { subtotal: 100, discount: 5, tax: 4.75, total: 99.75 }
  );
});

test('invoice render agrees with the recorded order total and shows matching GST', () => {
  const html = invoice.render({
    id: 7,
    date: '2026-11-22',
    total: 105,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.match(html, /5%<\/td><td class="r">₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
