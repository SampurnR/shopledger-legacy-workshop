const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1001, items, coupon, subtotal, discount, tax, total };
}

test('invoice and checkout agree on an undiscounted line with an explicit percentage rate', () => {
  const order = billedOrder([{ name: 'Tea', price: 50, qty: 2, gstRate: 18 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.equal(figures.rows[0].lineTax, 18);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice renders discounted HSN tax and reconciles a capped percentage coupon', () => {
  // Checkout stores HSN on order lines without copying gstRate.
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const order = billedOrder(items, 'SAVE10');
  const bill = pricing.computeTotals(items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(bill.lines.map(line => [line.gstPercent, line.discount, line.tax]), [
    [5, 75, 46.25],
    [12, 75, 111]
  ]);
  assert.deepEqual(
    [bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, order.total],
    [2000, 150, 157.25, 78.63, 78.62, 2007.25]
  );
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 46.25],
    [12, 111]
  ]);
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [2000, 150, 157.25, 78.63, 78.62, 2007.25]
  );

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>[^<]*157\.25/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>[^<]*2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('a flat coupon reduces GST at checkout and on the invoice', () => {
  const order = billedOrder([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('invoice preserves a zero billed discount for expired and below-minimum coupons', () => {
  const items = [{ name: 'Tea', price: 100, qty: 1 }];
  for (const coupon of ['DIWALI20', 'FLAT50']) {
    const order = billedOrder(items, coupon);
    const figures = invoice.computeInvoiceFigures(order);

    assert.equal(order.discount, 0, coupon);
    assert.equal(order.total, 118, coupon);
    assert.equal(figures.discount, 0, coupon);
    assert.equal(figures.total, 118, coupon);
  }
});

test('invoice preserves a zero billed discount even when the coupon qualifies today', () => {
  const items = [{ name: 'Tea', price: 300, qty: 1 }];
  const order = { ...billedOrder(items), coupon: 'FLAT50' };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(pricing.computeTotals(items, 'FLAT50').discount, 50);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 54, 354]);
});

test('invoice preserves fractional and zero GST rates', () => {
  const order = billedOrder([
    { name: 'Rice', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Other', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [5, 205]);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [0, 0]]);
  assert.deepEqual([figures.tax, figures.total], [5, 205]);
});

test('invoice GST sums the rounded taxes shown on each line', () => {
  const order = billedOrder([
    { name: 'Item A', price: 0.03, qty: 1 },
    { name: 'Item B', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('reconciliation flags a tax-only mismatch while the invoice shows no notice', () => {
  const order = {
    id: 1001,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 105
  };
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].invoiceTax, 5);
  assert.equal(reconciliation.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice shows the same total and GST breakdown as checkout for a mixed-rate discounted order', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total, 'invoice total must match the billed total');
  assert.deepEqual(
    [figures.discount, figures.tax, figures.cgst, figures.sgst],
    [150, 157.25, 78.63, 78.62]
  );
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 46.25],
    [12, 111]
  ]);
});

test('invoice still warns when a stored billed total differs from reconstructed pricing', () => {
  const order = {
    ...billedOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]),
    total: 104
  };
  assert.match(invoice.render(order), /Accountant Reconciliation Notice:.*105\.00.*104\.00.*1\.00/);
});

test('a reprinted invoice preserves the billed discount after a coupon is deactivated', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [200, 40, 840]);
  assert.equal(figures.rows[0].lineTax, 40);
});
