const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Match the line shape saved by POST /api/orders, including HSN but no gstRate.
function line(id, name, hsn, price, qty = 1) {
  return { id, sku: 'SKU-' + id, name, hsn, price, qty };
}

function checkout(items, coupon = '') {
  const bill = pricing.computeTotals(items, coupon);
  const { subtotal, discount, tax, total } = bill;
  const order = { id: 1, items, coupon, subtotal, discount, tax, total };
  return { bill, order, printed: invoice.computeInvoiceFigures(order) };
}

test('Rice invoice shows the GST and total billed at checkout', () => {
  const { printed, order } = checkout([line(1, 'Rice', '1006', 640)]);
  assert.equal(printed.total, 672);
  assert.equal(printed.tax, 32);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹672\.00/);
});

test('Invoice assigns the odd paisa to CGST as billed', () => {
  const { bill, order, printed } = checkout([line(1, 'Tea', '0902', 100.05)]);
  for (const figures of [bill, printed]) {
    assert.equal(figures.tax, 18.01);
    assert.equal(figures.total, 118.06);
  }
  assert.deepEqual([bill.cgst, bill.sgst], [9.01, 9]);
  assert.deepEqual([printed.cgst, printed.sgst], [9.01, 9]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Mixed rice and butter invoice uses the billed HSN slabs', () => {
  const { bill, order, printed } = checkout([
    line(1, 'Rice', '1006', 100, 2), line(2, 'Butter', '0405', 100)
  ]);
  assert.deepEqual(bill.lines.map(l => [l.gstPercent, l.tax]), [[5, 10], [12, 12]]);
  assert.deepEqual(printed.rows.map(r => [r.gstPercent, r.lineTax]), [[5, 10], [12, 12]]);
  assert.deepEqual([bill.tax, bill.cgst, bill.sgst, bill.total], [22, 11, 11, 322]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [22, 11, 11, 322]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].delta, 0);
});

test('Invoice applies the ₹150 SAVE10 cap before GST', () => {
  const { bill, printed } = checkout([line(1, 'Tea', '0902', 1000, 2)], 'SAVE10');
  assert.deepEqual([bill.discount, bill.tax, bill.total], [150, 333, 2183]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
});

test('Invoice charges GST after the flat discount', () => {
  const { bill, printed } = checkout([line(1, 'Tea', '0902', 300)], 'FLAT50');
  assert.deepEqual([bill.discount, bill.tax, bill.total], [50, 45, 295]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 45, 295]);
});

test('Invoice GST sums the rounded line taxes', () => {
  const { bill, printed } = checkout([
    line(1, 'Tea', '0902', 0.03), line(2, 'Coffee', '0901', 0.03)
  ]);
  assert.deepEqual(printed.rows.map(r => r.lineTax), [0.01, 0.01]);
  assert.equal(bill.tax, 0.02);
  assert.equal(printed.tax, 0.02);
});
