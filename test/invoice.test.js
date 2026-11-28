const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const db = { nextOrderId: 101, orders: [] };
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...billed, items, coupon, date: '2026-01-15' });
  return { db, billed, order };
}

test('invoice and billing agree for an undiscounted item at the default GST rate', () => {
  const { order } = billedOrder([
    { name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 2 }
  ]);

  assert.equal(order.total, 236);
  assert.equal(order.tax, 36);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 }
    ]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice matches billed totals and item GST for mixed HSN rates with a capped percent coupon', () => {
  const { order, billed } = billedOrder([
    { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(billed.lines.map(({ gstPercent, discount, taxable, tax }) => ({
    gstPercent, discount, taxable, tax
  })), [
    { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
    { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
  ]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [2000, 150, 157.25, 2007.25]);
  assert.deepEqual([billed.cgst, billed.sgst], [78.63, 78.62]);

  const { rows, ...totals } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(totals, { subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25 });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 46.25 },
    { gstPercent: 12, lineTax: 111 }
  ]);

  const html = invoice.render(order);
  assert.match(html, /GST %<\/th><th class="r">GST Amt<\/th>/);
  assert.match(html, /5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice taxes the discounted taxable value for a flat coupon', () => {
  const { order, billed } = billedOrder([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.taxable, 250);
  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total], [50, 45, 22.5, 22.5, 295]);
  assert.deepEqual(invoice.computeInvoiceFigures({ ...order, discount: undefined }), figures);
});

test('invoice omits the discount for a saved coupon below its minimum order subtotal', () => {
  const { order } = billedOrder([{ name: 'Tea', price: 10, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures({ ...order, coupon: 'FLAT50' });

  assert.equal(pricing.discount(order.subtotal, 'FLAT50'), 0);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 11.8);
});

test('invoice uses the billed GST for explicit percentage, decimal, and zero rates', () => {
  const { order, billed } = billedOrder([
    { name: 'Rice', price: 100, qty: 1, gstRate: 5 },
    { name: 'Ghee', price: 100, qty: 1, gstRate: 0.12 },
    { name: 'Exempt item', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 5], [12, 12], [0, 0]]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 5], [12, 12], [0, 0]]);
  assert.deepEqual([order.tax, order.total], [17, 317]);
  assert.deepEqual([figures.tax, figures.total], [17, 317]);
});

test('invoice GST sums the same rounded line taxes as billing', () => {
  const { order, billed } = billedOrder([
    { name: 'Tea sample', price: 0.03, qty: 1 },
    { name: 'Coffee sample', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ tax }) => tax), [0.01, 0.01]);
  assert.deepEqual([order.tax, order.total, billed.cgst, billed.sgst], [0.02, 0.08, 0.01, 0.01]);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.total, figures.cgst, figures.sgst], [0.02, 0.08, 0.01, 0.01]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('reconciliation matches billed GST for a percent coupon even when the invoice total was already correct', () => {
  const { db, order } = billedOrder([{ name: 'Tea', price: 100, qty: 1 }], 'WELCOME');
  orders.add(db, { ...order, status: 'cancelled' });

  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 101,
      date: '2026-01-15',
      customer: 'Walk-in',
      coupon: 'WELCOME',
      ledgerSubtotal: 100,
      ledgerDiscount: 5,
      ledgerTax: 17.1,
      ledgerTotal: 112.1,
      invoiceDiscount: 5,
      invoiceTax: 17.1,
      invoiceTotal: 112.1,
      delta: 0,
      matched: true
    }]
  });
});

test('invoice and reconciliation still flag a discrepancy with the saved order total', () => {
  const { db, order } = billedOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  order.total = 118.01;

  assert.match(invoice.render(order), /Accountant Reconciliation Notice:.*differs from Order Ledger recorded total \(₹118\.01\) by -₹0\.01\./);
  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 0.01);
  assert.equal(reconciliation.rows[0].matched, false);
});

test('invoice keeps the billed discount when a saved coupon has expired', () => {
  const order = {
    items: [{ name: 'Tea', price: 1500, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1500,
    discount: 250,
    tax: 225,
    total: 1475
  };

  assert.equal(pricing.discount(order.subtotal, order.coupon), 0);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [250, 225, 1475]);
  assert.equal(figures.rows[0].lineTax, 225);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('reconciliation flags a saved discount on an order without a coupon', () => {
  const { db, order } = billedOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  Object.assign(order, { discount: 10, tax: 16.2, total: 106.2 });

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 18, 118]);
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 1);
});
