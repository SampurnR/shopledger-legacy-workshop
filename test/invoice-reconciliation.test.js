const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function recordOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const totals = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...totals, items, coupon, date: '2021-11-15' });
  return { order, totals };
}

test('a mixed-HSN checkout with capped SAVE10 matches the invoice and GST reconciliation', () => {
  const { order } = recordOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 2 },
    { id: 7, name: 'Ghee', hsn: '0405', price: 260, qty: 2 },
    { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ], 'SAVE10');
  const { discount, tax, total, rows } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount, tax, total }, { discount: 150, tax: 139.87, total: 1929.87 });
  assert.deepEqual(rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 59.05], [12, 57.57], [18, 23.25]
  ]);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.rows[0].matched, true);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('billing and invoice agree on an undiscounted line with an explicit percentage rate', () => {
  const { order, totals } = recordOrder([
    { id: 1, name: 'Rice', price: 50.10, qty: 2, gstRate: 5 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines[0], {
    id: 1, name: 'Rice', hsn: '', gstPercent: 5,
    gross: 100.20, discount: 0, taxable: 100.20, tax: 5.01, net: 105.21
  });
  assert.deepEqual(figures, {
    subtotal: 100.20, discount: 0, tax: 5.01, cgst: 2.51, sgst: 2.50, total: 105.21,
    rows: [
      { name: 'Rice', sku: '-', hsn: '-', qty: 2, price: 50.10, gstPercent: 5, line: 100.20, lineTax: 5.01 }
    ]
  });
  assert.equal(order.total, 105.21);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the 5%, 12%, and 18% slabs for saved HSN-only lines', () => {
  // Checkout saves the HSN on each line without a gstRate field.
  const { order, totals } = recordOrder([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines.map(line => [line.gstPercent, line.tax]), [[5, 10], [12, 12], [18, 18]]);
  assert.equal(order.subtotal, 400);
  assert.equal(order.tax, 40);
  assert.equal(order.total, 440);
  assert.deepEqual(figures.rows.map(row => [row.hsn, row.gstPercent, row.lineTax]), [
    ['1006', 5, 10], ['0405', 12, 12], ['0902', 18, 18]
  ]);
  assert.equal(figures.tax, 40);
  assert.equal(figures.cgst, 20);
  assert.equal(figures.sgst, 20);
  assert.equal(figures.total, 440);

  const html = invoice.render(order);
  assert.match(html, /<td>1006<\/td>.*<td class="r">5%<\/td><td class="r">₹10\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹40\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹440\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice caps SAVE10 and applies GST to each discounted line', () => {
  const { order, totals } = recordOrder([
    { id: 1, name: 'Rice', price: 1200, qty: 1, gstRate: 5 },
    { id: 2, name: 'Ghee', price: 800, qty: 1, gstRate: 12 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.deepEqual(totals.lines.map(line => [line.discount, line.taxable, line.tax]), [
    [90, 1110, 55.50], [60, 740, 88.80]
  ]);
  assert.equal(order.tax, 144.30);
  assert.equal(order.total, 1994.30);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [55.50, 88.80]);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 144.30);
  assert.equal(figures.total, 1994.30);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice reduces taxable value before calculating GST for FLAT50', () => {
  const { order, totals } = recordOrder([
    { id: 1, name: 'Tea', price: 300, qty: 1, hsn: '0902' }
  ], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(totals.lines[0].taxable, 250);
  assert.equal(order.tax, 45);
  assert.equal(order.total, 295);
  assert.equal(figures.discount, 50);
  assert.equal(figures.rows[0].lineTax, 45);
  assert.equal(figures.tax, 45);
  assert.equal(figures.total, 295);
});

test('invoice applies no discount for expired and below-minimum coupons without a saved discount', () => {
  const items = [{ id: 1, name: 'Tea', price: 200, qty: 1, hsn: '0902' }];

  assert.equal(pricing.computeTotals(items, 'DIWALI20').discount, 0);
  assert.equal(pricing.computeTotals(items, 'FLAT50').discount, 0);

  // These coupon codes can be read from saved orders even though checkout would reject them today.
  const expired = invoice.computeInvoiceFigures({ items, coupon: 'DIWALI20' });
  assert.equal(expired.discount, 0);
  assert.equal(expired.total, 236);

  const belowMinimum = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });
  assert.equal(belowMinimum.discount, 0);
  assert.equal(belowMinimum.total, 236);
});

test('invoice preserves the applied discount on a saved order after the coupon expires', () => {
  const order = {
    coupon: 'DIWALI20',
    items: [{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }],
    subtotal: 300, discount: 60, tax: 43.20, total: 283.20
  };
  const { discount, tax, total, rows } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount, tax, total }, { discount: 60, tax: 43.20, total: 283.20 });
  assert.equal(rows[0].lineTax, 43.20);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('invoice uses the same decimal and zero GST rates as billing', () => {
  const { order, totals } = recordOrder([
    { id: 1, name: 'Rice', price: 100, qty: 1, gstRate: 0.05 },
    { id: 2, name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines.map(line => [line.gstPercent, line.tax]), [[5, 5], [0, 0]]);
  assert.equal(order.tax, 5);
  assert.equal(order.total, 205);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [0, 0]]);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 205);
});

test('invoice sums rounded line GST and splits the rounded total across CGST and SGST', () => {
  const { order, totals } = recordOrder([
    { id: 1, name: 'Rice sample', price: 0.10, qty: 1, gstRate: 5 },
    { id: 2, name: 'Poha sample', price: 0.10, qty: 1, gstRate: 5 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines.map(line => line.tax), [0.01, 0.01]);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.22);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.22);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('reconciliation flags a GST mismatch even when the invoice total matches', () => {
  const order = {
    id: 1, date: '2021-11-15', customer: 'Test customer', coupon: 'FLAT50',
    items: [{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }],
    subtotal: 300, discount: 50, tax: 54, total: 295
  };

  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1,
    mismatchCount: 1,
    totalDelta: 0,
    rows: [{
      orderId: 1, date: '2021-11-15', customer: 'Test customer', coupon: 'FLAT50',
      ledgerSubtotal: 300, ledgerDiscount: 50, ledgerTax: 54, ledgerTotal: 295,
      invoiceDiscount: 50, invoiceTax: 45, invoiceTotal: 295, delta: 0, matched: false
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('reconciliation keeps signed row deltas, sums absolute total deltas, and skips cancelled orders', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  const db = {
    orders: [
      { id: 1, items, subtotal: 100, discount: 0, tax: 18, total: 118 },
      { id: 2, items, subtotal: 100, discount: 0, tax: 15, total: 115 },
      { id: 3, items, subtotal: 100, discount: 0, tax: 20, total: 120 },
      { id: 4, items, subtotal: 100, discount: 0, tax: 0, total: 100, status: 'cancelled' }
    ]
  };
  const { totalChecked, mismatchCount, totalDelta, rows } = reports.getGstReconciliation(db);

  assert.deepEqual({ totalChecked, mismatchCount, totalDelta }, {
    totalChecked: 3, mismatchCount: 2, totalDelta: 5
  });
  assert.deepEqual(rows.map(row => [row.orderId, row.delta, row.matched]), [
    [1, 0, true], [2, 3, false], [3, -2, false]
  ]);
});
