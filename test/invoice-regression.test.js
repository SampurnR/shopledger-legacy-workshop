const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice and reconciliation agree with mixed-HSN billing after an apportioned coupon', () => {
  const order = {
    id: 1001, date: '01/01/2021', customer: 'Test customer', coupon: 'FLAT50',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
      { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ],
    subtotal: 300, discount: 50, tax: 29.17, total: 279.17
  };
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 300, discount: 50, tax: 29.17, cgst: 14.59, sgst: 14.58, total: 279.17,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 4.17 },
      { name: 'Ghee', sku: '-', hsn: '0405', qty: 1, price: 100, gstPercent: 12, line: 100, lineTax: 10 },
      { name: 'Tea', sku: '-', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 15 }
    ]
  });
  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹279.17'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, true);
});
