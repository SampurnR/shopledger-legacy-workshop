const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function recordOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const totals = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...totals, items, coupon, date: '2026-01-15' });
  return { db, order, totals };
}

test('printed invoice shows the billed total and GST for a discounted mixed-slab order', () => {
  const { order } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 300, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 400, qty: 1 }
  ], 'SAVE10');
  const html = invoice.render(order);
  const printedTotal = html.match(/Invoice Total<\/td><td class="r">₹([\d.]+)/)?.[1];
  const printedTax = html.match(/Total GST\)<\/td><td class="r">₹([\d.]+)/)?.[1];

  assert.deepEqual(
    { total: printedTotal, tax: printedTax },
    { total: order.total.toFixed(2), tax: order.tax.toFixed(2) }
  );
  assert.match(html, /5%<\/td><td class="r">₹27\.00<\/td>/);
  assert.match(html, /12%<\/td><td class="r">₹43\.20<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('an uncouponed order at the default GST rate matches the invoice', () => {
  const { order } = recordOrder([{ name: 'Sample', price: 0.50, qty: 3 }]);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1.50,
    discount: 0,
    tax: 0.27,
    cgst: 0.14,
    sgst: 0.13,
    total: 1.77,
    rows: [{
      name: 'Sample', sku: '-', hsn: '-', qty: 3, price: 0.50,
      gstPercent: 18, line: 1.50, lineTax: 0.27
    }]
  });
  assert.equal(order.total, 1.77);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice resolves HSN slabs and uses GST on each post-discount line', () => {
  const { order, totals } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 300, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 400, qty: 1 }
  ], 'SAVE10');
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 60, taxable: 540, tax: 27 },
    { gstPercent: 12, discount: 40, taxable: 360, tax: 43.20 }
  ]);
  assert.equal(order.tax, 70.20);
  assert.equal(order.total, 970.20);
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 27 },
    { hsn: '0405', gstPercent: 12, lineTax: 43.20 }
  ]);
  assert.deepEqual(figures, {
    subtotal: 1000, discount: 100, tax: 70.20, cgst: 35.10, sgst: 35.10, total: 970.20
  });
});

test('invoice accepts whole percentage rates, decimal rates and zero GST', () => {
  const { order, totals } = recordOrder([
    { name: 'Whole percent', gstRate: 5, price: 100, qty: 1 },
    { name: 'Decimal rate', gstRate: 0.05, price: 100, qty: 1 },
    { name: 'Zero rate', gstRate: 0, price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines.map(({ tax }) => tax), [5, 5, 0]);
  assert.equal(order.total, 310);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5], [5, 5], [0, 0]
  ]);
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 310);
});

test('invoice preserves a stored GST percentage written as a string', () => {
  const order = {
    items: [{ name: 'Rice', price: 100, qty: 1, gstRate: '5' }],
    discount: 0, tax: 5, total: 105
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.deepEqual([figures.tax, figures.total], [5, 105]);
});

test('invoice sums the rounded line taxes just as checkout does', () => {
  const { order } = recordOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.deepEqual([figures.cgst, figures.sgst], [0.01, 0.01]);
  assert.equal(figures.total, 0.08);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice caps percentage discounts and applies them before GST', () => {
  const { order } = recordOrder([{ name: 'Bulk tea', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
});

test('invoice keeps the recorded zero discount when a flat coupon is below its minimum', () => {
  const { order } = recordOrder([{ name: 'Tea', price: 20, qty: 1 }]);
  assert.deepEqual([order.discount, order.tax, order.total], [0, 3.60, 23.60]);

  // A historical record can contain a coupon that checkout would reject today.
  const figures = invoice.computeInvoiceFigures({ ...order, coupon: 'FLAT50' });
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 3.60, 23.60]);
});

test('invoice keeps the recorded zero discount for an inactive coupon', () => {
  const { order } = recordOrder([{ name: 'Tea', price: 1000, qty: 1 }]);
  assert.deepEqual([order.discount, order.tax, order.total], [0, 180, 1180]);

  const figures = invoice.computeInvoiceFigures({ ...order, coupon: 'DIWALI20' });
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 180, 1180]);
});

test('invoice preserves the discount billed before a coupon was deactivated', () => {
  const order = {
    items: [{ name: 'Tea', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [200, 144, 944]);
  assert.equal(figures.rows[0].lineTax, 144);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies checkout coupon rules when an older order has no recorded discount', () => {
  const { order } = recordOrder([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');
  delete order.discount;

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('invoice does not turn a one-paisa ledger discrepancy into a larger discount', () => {
  const order = {
    items: [{ name: 'Tea', price: 300, qty: 1 }],
    coupon: 'FLAT50', subtotal: 300, tax: 54, total: 303.99
  };

  assert.equal(invoice.computeInvoiceFigures(order).discount, 50);
  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].delta, 0.01);
});

test('invoice preserves a historical bill with pre-discount GST and a recorded discount', () => {
  const order = {
    items: [{ name: 'Tea', price: 300, qty: 1 }],
    coupon: 'FLAT50', discount: 50, tax: 54, total: 304
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 54, 304]);
  assert.equal(figures.rows[0].lineTax, 54);
});

test('reconciliation preserves historical GST and reports only the recorded total discrepancy', () => {
  const order = {
    items: [{ name: 'Tea', price: 300, qty: 1 }],
    coupon: 'FLAT50', subtotal: 300, discount: 50, tax: 54, total: 303.99
  };
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].invoiceTax, 54);
  assert.equal(report.rows[0].delta, 0.01);
});

test('invoice reconciles historical monetary amounts saved as numeric strings', () => {
  const order = {
    items: [{ name: 'Tea', price: 300, qty: 1 }],
    coupon: 'FLAT50', subtotal: '300.00', discount: '50.00', tax: '54.00', total: '304.00'
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 54, 304]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice preserves historical percentage-coupon rounding', () => {
  const order = {
    items: [{ name: 'Tea', price: 500.03, qty: 1 }],
    coupon: 'SAVE10', discount: 59, tax: 90.01, total: 531.03
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [59, 90.01, 531.03]);
});

test('a current discount combined with a different recorded GST remains a mismatch', () => {
  const { db, order } = recordOrder([{ name: 'Tea', price: 1000, qty: 1 }], 'SAVE10');
  order.tax = 180;
  order.total = 1080;

  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 1);
});

test('invoice preserves a numeric rate of one when the historical bill used 1% GST', () => {
  const order = {
    items: [{ name: 'Tea', price: 100, qty: 1, gstRate: 1 }],
    discount: 0, tax: 1, total: 101
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 1);
  assert.deepEqual([figures.tax, figures.total], [1, 101]);
});

test('invoice preserves legacy GST billed before a discount from an inactive coupon', () => {
  const order = {
    items: [{ name: 'Tea', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', tax: 180, total: 944
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [236, 180, 944]);
  assert.equal(figures.rows[0].lineTax, 180);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a percentage coupon reconciles both GST and the billed total', () => {
  const { db, order, totals } = recordOrder([{ name: 'Tea', price: 1000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([totals.cgst, totals.sgst], [81, 81]);
  assert.deepEqual([figures.cgst, figures.sgst], [81, 81]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1,
      date: '2026-01-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 1000,
      ledgerDiscount: 100,
      ledgerTax: 162,
      ledgerTotal: 1062,
      invoiceDiscount: 100,
      invoiceTax: 162,
      invoiceTotal: 1062,
      delta: 0,
      matched: true
    }]
  });
});

test('invoice and reconciliation still flag a different recorded total', () => {
  const { db, order } = recordOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  order.total = 118.01;

  const html = invoice.render(order);
  assert.match(html, /Invoice computed total \(₹118\.00\) differs from Order Ledger recorded total \(₹118\.01\) by -₹0\.01\./);
  const report = reports.getGstReconciliation(db);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].delta, -0.01);
});
