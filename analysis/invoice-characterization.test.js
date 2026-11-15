const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '', id = 1) {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id, date: '15/11/2026', status: 'completed', items, coupon, subtotal, discount, tax, total };
}

test('checkout and invoice agree for an 18% item without a coupon', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 36);
  assert.equal(order.total, 236);
  assert.equal(figures.tax, 36);
  assert.equal(figures.total, 236);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('checkout apportions SAVE10 before applying mixed GST rates', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 300, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 400, qty: 1 }
  ];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(checkout.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 60, taxable: 540, tax: 27 },
    { gstPercent: 12, discount: 40, taxable: 360, tax: 43.2 }
  ]);
  assert.equal(checkout.cgst, 35.1);
  assert.equal(checkout.sgst, 35.1);
  assert.equal(checkout.discount, 100);
  assert.equal(checkout.tax, 70.2);
  assert.equal(checkout.total, 970.2);
});

test('invoice applies the checkout percentage coupon cap', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice sums rounded line GST the same way as checkout', () => {
  const order = billedOrder([
    { name: 'Sample A', price: 0.03, qty: 1 },
    { name: 'Sample B', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.08);
});

test('CURRENT BEHAVIOUR: reconciliation flags a GST-only difference while the invoice shows no notice', () => {
  const order = {
    ...billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]),
    tax: 17.99
  };
  const cancelled = { ...order, id: 2, status: 'cancelled' };

  assert.deepEqual(reports.getGstReconciliation({ orders: [order, cancelled] }), {
    totalChecked: 1,
    mismatchCount: 1,
    totalDelta: 0,
    rows: [{
      orderId: 1,
      date: '15/11/2026',
      customer: 'Walk-in',
      coupon: '',
      ledgerSubtotal: 100,
      ledgerDiscount: 0,
      ledgerTax: 17.99,
      ledgerTotal: 118,
      invoiceDiscount: 0,
      invoiceTax: 18,
      invoiceTotal: 118,
      delta: 0,
      matched: false
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
