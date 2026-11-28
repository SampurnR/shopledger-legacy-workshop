const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function makeOrder(items, coupon = '') {
  return {
    id: 1001,
    date: '28/11/2026',
    customer: 'Test Customer',
    status: 'completed',
    items,
    coupon,
    ...pricing.computeTotals(items, coupon)
  };
}

test('order #1002 invoices ₹963.90 including ₹45.90 GST', () => {
  const order = {
    id: 1002,
    status: 'completed',
    items: [
      { name: 'Basmati rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, total: figures.total },
    { discount: 102, tax: 45.9, total: 963.9 }
  );
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹963\.90/);
});

test('invoice honors an explicit legacy GST percentage', () => {
  const order = makeOrder([{ name: 'Rice', price: 100, qty: 2, gstRate: 5 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 10);
  assert.equal(figures.cgst, 5);
  assert.equal(figures.sgst, 5);
  assert.equal(figures.total, 210);
});

test('invoice uses each HSN GST rate on an order without a coupon', () => {
  const order = makeOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(line => line.gstPercent), [5, 12, 18]);
  assert.deepEqual(figures.rows.map(line => line.lineTax), [5, 12, 18]);
  assert.equal(figures.tax, 35);
  assert.equal(figures.total, 335);
});

test('invoice calculates GST after a flat coupon', () => {
  const order = makeOrder([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(order.tax, 81);
  assert.equal(order.total, 531);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 81);
  assert.equal(figures.total, 531);
});

test('invoice caps SAVE10 at ₹150 and calculates GST after the discount', () => {
  const order = makeOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.total, 2183);
});

test('printed invoice and reconciliation agree with the stored checkout total', () => {
  const order = makeOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const html = invoice.render(order);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
