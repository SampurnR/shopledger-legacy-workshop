const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const orders = require('../lib/orders');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Match the order route's saved item shape: HSN is present, gstRate is absent.
function mixedCart() {
  return [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 300, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
}

function bill(items, coupon = '') {
  const db = { orders: [], nextOrderId: 1 };
  const totals = pricing.computeTotals(items, coupon);
  return orders.add(db, { ...totals, items, coupon, date: '01/06/2022' });
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('rice and tea invoice matches the saved SAVE10 sale and its GST breakdown', () => {
  const order = bill([
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ], 'SAVE10');
  assert.equal(order.total, 753.48);
  assert.equal(order.tax, 51.48);
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual([figures.cgst, figures.sgst], [25.74, 25.74]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [28.80, 22.68]);
});

test('checkout apportions SAVE10 before applying each HSN slab and splitting GST', () => {
  const checkout = pricing.computeTotals(mixedCart(), 'SAVE10');
  assert.deepEqual(amounts(checkout), {
    subtotal: 600, discount: 60, tax: 57.6, cgst: 28.8, sgst: 28.8, total: 597.6
  });
  assert.deepEqual(checkout.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 20, taxable: 180, tax: 9 },
    { gstPercent: 12, discount: 30, taxable: 270, tax: 32.4 },
    { gstPercent: 18, discount: 10, taxable: 90, tax: 16.2 }
  ]);
});

test('printed invoice uses each HSN slab and the discount applied at checkout', () => {
  const order = bill(mixedCart(), 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 9 },
    { gstPercent: 12, lineTax: 32.4 },
    { gstPercent: 18, lineTax: 16.2 }
  ]);
  assert.deepEqual(amounts(figures), {
    subtotal: 600, discount: 60, tax: 57.6, cgst: 28.8, sgst: 28.8, total: 597.6
  });

  const text = invoice.render(order).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /CGST \+ SGST \(Total GST\) ₹57\.60/);
  assert.match(text, /Invoice Total ₹597\.60/);
  assert.doesNotMatch(text, /Accountant Reconciliation Notice/);
});

test('an undiscounted item with an unknown HSN uses the same default GST in checkout and on the invoice', () => {
  const order = bill([{ name: 'Sample', hsn: '9999', price: 100, qty: 1 }]);
  assert.equal(order.tax, 18);
  assert.equal(order.total, 118);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('the invoice retains the capped SAVE10 discount', () => {
  const order = bill([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  assert.equal(order.discount, 150);
  assert.equal(order.total, 2183);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a flat discount reduces the taxable amount on the invoice', () => {
  const order = bill([{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }], 'FLAT50');
  assert.equal(order.tax, 45);
  assert.equal(order.total, 295);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 300, discount: 50, tax: 45, cgst: 22.5, sgst: 22.5, total: 295
  });
});

test('reconciliation matches both the discounted GST and total and excludes cancelled orders', () => {
  const order = bill([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  const report = reports.getGstReconciliation({ orders: [order, { ...order, id: 2, status: 'cancelled' }] });
  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.deepEqual(report.rows[0], {
    orderId: 1, date: '01/06/2022', customer: 'Walk-in', coupon: 'SAVE10',
    ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
    invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice GST sums the individually rounded line taxes', () => {
  const items = [
    { name: 'A', hsn: '0902', price: 0.03, qty: 1 },
    { name: 'B', hsn: '0902', price: 0.03, qty: 1 }
  ];
  assert.deepEqual(amounts(pricing.computeTotals(items)), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  const figures = invoice.computeInvoiceFigures(bill(items));
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(figures), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
});

// Orders with explicit rates exercise the module's input format independently of the POS route.
for (const { rate, billedTax } of [
  { rate: 0, billedTax: 0 },
  { rate: 0.05, billedTax: 5 }
]) {
  test(`explicit gstRate ${rate} bills and invoices ₹${billedTax} GST`, () => {
    const order = bill([{ name: 'Sample', price: 100, qty: 1, gstRate: rate }]);
    assert.equal(order.tax, billedTax);
    assert.equal(invoice.computeInvoiceFigures(order).tax, billedTax);
  });
}

test('reprinting after a coupon expires keeps the discount and GST originally billed', () => {
  const order = {
    items: [{ name: 'Tea', hsn: '0902', qty: 1, price: 1000 }],
    coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 144, total: 944
  };
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 1000, discount: 200, tax: 144, cgst: 72, sgst: 72, total: 944
  });
});

test('reconciliation still flags a stored tax discrepancy when the grand total matches', () => {
  const order = bill(mixedCart(), 'SAVE10');
  order.tax += 0.01;
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.rows[0].delta, 0);
  assert.equal(report.rows[0].invoiceTax, 57.6);
  assert.equal(report.rows[0].matched, false);
  assert.equal(report.mismatchCount, 1);
});
