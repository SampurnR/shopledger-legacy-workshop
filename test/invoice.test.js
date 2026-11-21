const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Use the line-item shape saved by POST /api/orders. Each test owns its order.
function bill(items, coupon = '') {
  const checkout = pricing.computeTotals(items, coupon);
  const { subtotal, discount, tax, total } = checkout;
  const order = { id: 1, items, coupon, subtotal, discount, tax, total };
  return { checkout, order, printed: invoice.computeInvoiceFigures(order) };
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('printable rice invoice shows the billed total and the two GST components', () => {
  const rice = { id: 1, sku: 'R', name: 'Rice', hsn: '1006', price: 640, qty: 2 };
  const { order } = bill([rice], 'WELCOME');
  assert.equal(order.total, 1276.80);
  assert.equal(order.tax, 60.80);
  const text = invoice.render(order).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.equal(text.match(/Invoice Total ₹([\d.]+)/)[1], '1276.80');
  assert.match(text, /CGST ₹30\.40/);
  assert.match(text, /SGST ₹30\.40/);
});

test('checkout and invoice agree on an undiscounted 18% item with an odd paisa of GST', () => {
  const tea = { id: 1, sku: 'T', name: 'Tea', hsn: '0902', price: 10.50, qty: 1 };
  const { checkout, printed, order } = bill([tea]);
  const expected = { subtotal: 10.50, discount: 0, tax: 1.89, cgst: 0.95, sgst: 0.94, total: 12.39 };
  assert.deepEqual(amounts(checkout), expected);
  assert.deepEqual(amounts(printed), expected);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('the invoice applies 5% and 12% GST after sharing the flat discount across lines', () => {
  const items = [
    { id: 1, sku: 'R', name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, sku: 'G', name: 'Ghee', hsn: '0405', price: 300, qty: 1 }
  ];
  const { checkout, order, printed } = bill(items, 'FLAT50');
  assert.deepEqual(amounts(checkout), { subtotal: 500, discount: 50, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4 });
  assert.deepEqual(checkout.lines.map(({ gstPercent, discount, tax }) => ({ gstPercent, discount, tax })), [
    { gstPercent: 5, discount: 20, tax: 9 },
    { gstPercent: 12, discount: 30, tax: 32.4 }
  ]);
  assert.deepEqual(amounts(printed), amounts(checkout));
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 9 },
    { gstPercent: 12, lineTax: 32.4 }
  ]);

  // Check the visible wording and amounts without pinning CSS or table markup.
  const text = invoice.render(order).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /CGST \+ SGST \(Total GST\) ₹41\.40/);
  assert.match(text, /Invoice Total ₹491\.40/);
  assert.doesNotMatch(text, /Accountant Reconciliation Notice/);
});

test('a percentage coupon reconciles both GST and the invoice total', () => {
  const tea = { id: 1, sku: 'T', name: 'Tea', hsn: '0902', price: 100, qty: 1 };
  const { checkout, order, printed } = bill([tea], 'WELCOME');
  assert.deepEqual(amounts(checkout), { subtotal: 100, discount: 5, tax: 17.1, cgst: 8.55, sgst: 8.55, total: 112.1 });
  assert.deepEqual(amounts(printed), amounts(checkout));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].delta, 0);
});

test('the invoice applies the SAVE10 cap before GST', () => {
  const tea = { id: 1, sku: 'T', name: 'Tea', hsn: '0902', price: 1000, qty: 2 };
  const { checkout, printed } = bill([tea], 'SAVE10');
  assert.deepEqual(amounts(checkout), { subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183 });
  assert.deepEqual(amounts(printed), amounts(checkout));
});

test('invoice GST sums the individually rounded line taxes', () => {
  const items = [
    { id: 1, sku: 'T', name: 'Tea', hsn: '0902', price: 0.03, qty: 1 },
    { id: 2, sku: 'C', name: 'Coffee', hsn: '0901', price: 0.03, qty: 1 }
  ];
  const { checkout, printed } = bill(items);
  assert.deepEqual(amounts(checkout), { subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(printed), amounts(checkout));
});

test('reprinting a billed order preserves its discount after the coupon expires', () => {
  const order = {
    id: 2,
    items: [{ id: 1, sku: 'T', name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 144, total: 944
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(printed), { subtotal: 1000, discount: 200, tax: 144, cgst: 72, sgst: 72, total: 944 });
  assert.equal(printed.rows[0].lineTax, 144);
});
