const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function line(hsn, price, qty) {
  return { hsn, price, qty };
}

// Keep billed amounts literal so the reconciliation expectations do not
// change if the pricing or invoice calculation changes.
function order(id, coupon, subtotal, discount, tax, total, items) {
  return { id, coupon, subtotal, discount, tax, total, items };
}

const orders = [
  order(1001, '', 610, 0, 66.90, 676.90, [line('0902', 140, 2), line('0713', 165, 2)]),
  order(1002, 'SAVE10', 1020, 102, 45.90, 963.90, [line('1006', 640, 1), line('1512', 190, 2)]),
  order(1003, 'FLAT50', 400, 50, 49.35, 399.35, [line('0405', 260, 1), line('0902', 140, 1)]),
  order(1004, 'SAVE10', 2240, 150, 104.50, 2194.50, [line('1508', 1120, 2)]),
  order(1005, 'FLAT50', 1000, 50, 91.96, 1041.96, [line('1006', 640, 1), line('2106', 180, 2)]),
  order(1006, 'WELCOME', 1210, 60.50, 155.61, 1305.11, [line('0405', 450, 2), line('0901', 310, 1)]),
  { ...order(1007, '', 1280, 0, 127, 1407, [line('0405', 450, 2), line('1512', 190, 2)]), status: 'pending' },
  order(1008, '', 500, 0, 90, 590, [line('0902', 140, 1), line('2106', 180, 2)]),
];

test('order #1002 invoice shows ₹963.90 total and ₹45.90 GST', () => {
  const order = orders[1];
  const { subtotal, discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal, discount, tax, cgst, sgst, total }, {
    subtotal: 1020, discount: 102, tax: 45.90, cgst: 22.95, sgst: 22.95, total: 963.90,
  });
  const html = invoice.render(order);
  assert.match(html, /Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('order #1004 invoice respects the ₹150 SAVE10 cap', () => {
  const { discount, tax, total } = invoice.computeInvoiceFigures(orders[3]);
  assert.deepEqual({ discount, tax, total }, { discount: 150, tax: 104.50, total: 2194.50 });
});

test('invoice uses the 12% and 5% HSN rates on a mixed order', () => {
  const { rows } = invoice.computeInvoiceFigures(orders[6]);
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 12, lineTax: 108 },
    { gstPercent: 5, lineTax: 19 },
  ]);
});

test('order #1008 invoice remains ₹590 with ₹90 GST', () => {
  const { discount, tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(orders[7]);
  assert.deepEqual({ discount, tax, cgst, sgst, total }, {
    discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590,
  });
  assert.deepEqual(rows.map(row => row.gstPercent), [18, 18]);
});

test('all eight stored orders reconcile', () => {
  const { totalChecked, mismatchCount, totalDelta, rows } = reports.getGstReconciliation({ orders });
  assert.equal(totalChecked, 8);
  assert.deepEqual(rows.filter(row => !row.matched).map(row => row.orderId), []);
  assert.equal(mismatchCount, 0);
  assert.equal(totalDelta, 0);
});
