const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

const item = (name, hsn, price, qty) => ({ name, hsn, price, qty });
const orders = [
  { id: 1002, items: [item('Rice', '1006', 640, 1), item('Sunflower oil', '1512', 190, 2)],
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.90, total: 963.90 },
  { id: 1004, items: [item('Groundnut oil', '1508', 1120, 2)],
    coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.50, total: 2194.50 },
  { id: 1008, items: [item('Tea', '0902', 140, 1), item('Syrup', '2106', 180, 2)],
    subtotal: 500, discount: 0, tax: 90, total: 590 }
];

for (const order of orders) {
  test('invoice #' + order.id + ' matches the ledger', () => {
    const figures = invoice.computeInvoiceFigures(order);
    for (const field of ['subtotal', 'discount', 'tax', 'total']) {
      assert.equal(figures[field], order[field], field);
    }
  });
}

test('invoice rows show the HSN rate and GST after the coupon', () => {
  const { rows, cgst, sgst } = invoice.computeInvoiceFigures(orders[0]);
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 28.8], [5, 17.1]]);
  assert.equal(cgst, 22.95);
  assert.equal(sgst, 22.95);
});

test('a genuine discrepancy still displays the reconciliation notice', () => {
  const order = orders[2];
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.match(invoice.render({ ...order, total: 591 }), /Accountant Reconciliation Notice/);
});

test('GST Audit reconciles the representative orders', () => {
  const result = reports.getGstReconciliation({ orders });
  assert.equal(result.totalChecked, orders.length);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
});
