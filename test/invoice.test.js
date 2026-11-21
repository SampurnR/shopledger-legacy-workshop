const assert = require('node:assert/strict');
const { test } = require('node:test');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function recordOrder(items, coupon = '') {
  const db = { nextOrderId: 1001, orders: [] };
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...billed, items, coupon, date: '2026-01-15' });
  return { db, order, billed };
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('printed invoice matches checkout for a flat coupon on mixed GST slabs', () => {
  const { order } = recordOrder([
    { name: 'Rice', hsn: '1006', price: 50, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ], 'FLAT50');

  assert.equal(order.total, 274.17);
  assert.equal(order.tax, 24.17);
  const html = invoice.render(order);
  const displayedTotal = html.match(/Invoice Total<\/td><td class="r">₹([^<]+)/)?.[1];
  assert.equal(displayedTotal, '274.17');
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹24\.17/);
  assert.match(html, /5%<\/td><td class="r">₹4\.17/);
  assert.match(html, /12%<\/td><td class="r">₹20\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice and checkout agree for an undiscounted item at the default GST rate', () => {
  const { order, billed } = recordOrder([{ name: 'Unclassified item', price: 100, qty: 2 }]);
  const expected = { subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236 };

  assert.deepEqual(amounts(billed), expected);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    ...expected,
    rows: [{
      name: 'Unclassified item', sku: '-', hsn: '-', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36
    }]
  });
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹36\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹236\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses the billed HSN slabs and reconciliation marks the order matched', () => {
  const { db, order, billed } = recordOrder([
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 50, qty: 2 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 1 }
  ]);
  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 5], [12, 24]]);
  assert.deepEqual(amounts(billed), {
    subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329
  });
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 50, gstPercent: 5, line: 100, lineTax: 5 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 200, gstPercent: 12, line: 200, lineTax: 24 }
    ]
  });

  const html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹5\.00/);
  assert.match(html, /12%<\/td><td class="r">₹24\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹29\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹329\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: '2026-01-15', customer: 'Walk-in', coupon: '',
      ledgerSubtotal: 300, ledgerDiscount: 0, ledgerTax: 29, ledgerTotal: 329,
      invoiceDiscount: 0, invoiceTax: 29, invoiceTotal: 329, delta: 0, matched: true
    }]
  });
});

test('invoice uses the checkout percentage coupon cap before GST', () => {
  const { order, billed } = recordOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');

  assert.deepEqual(amounts(billed), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
  const html = invoice.render(order);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice calculates GST on the amount after a flat coupon', () => {
  const { order, billed } = recordOrder([{ name: 'Tea', hsn: '0902', price: 400, qty: 1 }], 'FLAT50');

  assert.deepEqual(amounts(billed), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.5, sgst: 31.5, total: 413
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 400, discount: 50, tax: 63, cgst: 31.5, sgst: 31.5, total: 413
  });
});

test('invoice uses checkout eligibility for expired and below-minimum coupons', () => {
  const item = { name: 'Tea', hsn: '0902', price: 100, qty: 1 };

  for (const coupon of ['SAVE10', 'DIWALI20']) {
    const { order } = recordOrder([item]);
    const figures = invoice.computeInvoiceFigures({ ...order, coupon });

    assert.equal(coupons.validate(coupon, order.subtotal).valid, false, coupon);
    assert.equal(order.discount, 0);
    assert.equal(order.total, 118);
    assert.equal(figures.discount, 0, coupon);
    assert.equal(figures.total, 118, coupon);
  }
});

test('invoice and reconciliation match checkout GST when an uncapped percentage coupon applies', () => {
  const { db, order } = recordOrder([{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount: order.discount, tax: order.tax, total: order.total }, {
    discount: 100, tax: 162, total: 1062
  });
  assert.deepEqual(amounts(figures), {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹162\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation(db);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.rows[0].delta, 0);
});

test('invoice uses checkout GST rates for whole percentages, fractions, and zero', () => {
  const { order, billed } = recordOrder([
    { name: 'Percentage rate', gstRate: 5, price: 100, qty: 1 },
    { name: 'Fractional rate', gstRate: 0.12, price: 100, qty: 1 },
    { name: 'Zero rate', gstRate: 0, price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 5], [12, 12], [0, 0]]);
  assert.equal(order.tax, 17);
  assert.equal(order.total, 317);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 5], [12, 12], [0, 0]]);
  assert.equal(figures.tax, 17);
  assert.equal(figures.total, 317);
});

test('invoice GST total sums the rounded line taxes used at checkout', () => {
  const { order, billed } = recordOrder([
    { name: 'Tea sample', hsn: '0902', price: 0.04, qty: 1 },
    { name: 'Coffee sample', hsn: '0901', price: 0.04, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ tax }) => tax), [0.01, 0.01]);
  assert.deepEqual(amounts(billed), {
    subtotal: 0.08, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.10
  });
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(figures), {
    subtotal: 0.08, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.10
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice splits rounded GST the same way as checkout', () => {
  const { order, billed } = recordOrder([{ name: 'Tea', hsn: '0902', price: 100.05, qty: 1 }]);

  assert.deepEqual(amounts(billed), {
    subtotal: 100.05, discount: 0, tax: 18.01, cgst: 9.01, sgst: 9, total: 118.06
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 100.05, discount: 0, tax: 18.01, cgst: 9.01, sgst: 9, total: 118.06
  });
});

test('reconciliation still flags figures that differ from the ledger', () => {
  const { db, order } = recordOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]);
  order.tax = 17;
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 1);

  order.total = 117;
  assert.match(invoice.render(order), /recorded total \(₹117\.00\) by \+₹1\.00\./);
  assert.equal(reports.getGstReconciliation(db).totalDelta, 1);
});
