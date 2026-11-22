const assert = require('node:assert/strict');
const test = require('node:test');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

const mixedSlabItems = [
  { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
  { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
];
const defaultRateItem = { id: 3, name: 'Unclassified item', price: 1000, qty: 1 };

function billOrder(db, items, coupon = '', status = 'completed') {
  return orders.add(db, {
    ...pricing.computeTotals(items, coupon),
    items,
    coupon,
    status,
    date: '10/11/2021'
  });
}

test('checkout caps SAVE10 and apportions it before applying each HSN rate', () => {
  assert.deepEqual(pricing.computeTotals(mixedSlabItems, 'SAVE10'), {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    total: 2007.25,
    lines: [
      {
        id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
        gross: 1000, discount: 75, taxable: 925, tax: 46.25, net: 971.25
      },
      {
        id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12,
        gross: 1000, discount: 75, taxable: 925, tax: 111, net: 1036
      }
    ]
  });
});

test('invoice and reconciliation agree with the billed total and GST on a mixed-HSN sale', () => {
  const db = { orders: [], nextOrderId: 1 };
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Butter', hsn: '0405', price: 260, qty: 1 }
  ];
  const order = billOrder(db, items, 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ total: figures.total, gst: figures.tax }, { total: 915.04, gst: 60.04 });
  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual([figures.cgst, figures.sgst], [30.02, 30.02]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 30.4], [12, 29.64]]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹60\.04/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹915\.04/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation(db).rows[0].matched, true);
});

test('invoice honours the SAVE10 cap and shows GST after the discount for each HSN', () => {
  const db = { orders: [], nextOrderId: 1 };
  const order = billOrder(db, mixedSlabItems, 'SAVE10');
  const { rows, ...totals } = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 2007.25);
  assert.equal(order.tax, 157.25);
  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows, [
    { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 46.25 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000, gstPercent: 12, line: 1000, lineTax: 111 }
  ]);

  const html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹46\.25/);
  assert.match(html, /12%<\/td><td class="r">₹111\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
});

test('invoice handles percentage, fractional, and zero GST rates like checkout', () => {
  const items = [
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 12 },
    { name: 'Fractional rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[12, 12], [5, 5], [0, 0]]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[12, 12], [5, 5], [0, 0]]);
  assert.equal(billed.total, 317);
  assert.equal(printed.total, 317);
});

test('invoice totals and splits rounded line GST like checkout', () => {
  const items = [
    { id: 1, name: 'First small line', price: 0.08, qty: 1 },
    { id: 2, name: 'Second small line', price: 0.08, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map(line => line.tax), [0.01, 0.01]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.18]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.18]);
});

test('CURRENT BEHAVIOUR: checkout rounds each line discount without allocating the remainder', () => {
  const items = [
    { id: 1, name: 'First item', price: 100, qty: 1 },
    { id: 2, name: 'Second item', price: 100, qty: 1 },
    { id: 3, name: 'Third item', price: 100, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'FLAT50');

  assert.deepEqual(billed.lines.map(line => line.discount), [16.67, 16.67, 16.67]);
  assert.deepEqual(billed.lines.map(line => line.net), [98.33, 98.33, 98.33]);
  assert.equal(billed.discount, 50);
  assert.equal(billed.total, 295);
});

test('invoice ignores expired and below-minimum coupons when no applied discount was recorded', () => {
  const items = [{ ...defaultRateItem, price: 100 }];
  const subtotal = pricing.subtotal(items);

  for (const coupon of ['DIWALI20', 'SAVE10', 'FLAT50']) {
    assert.equal(coupons.validate(coupon, subtotal).valid, false, coupon);
    const printed = invoice.computeInvoiceFigures({ items, coupon });
    assert.deepEqual([printed.discount, printed.tax, printed.total], [0, 18, 118], coupon);
  }
});

test('a reprinted invoice preserves the stored discount after a coupon is retired', () => {
  const order = {
    id: 1,
    items: [defaultRateItem],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  };
  assert.equal(coupons.validate(order.coupon, order.subtotal).valid, false);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.rows[0].lineTax, printed.total], [200, 144, 944]);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('reconciliation skips cancellations and sums absolute invoice-total differences', () => {
  const db = { orders: [], nextOrderId: 1 };
  const belowCalculation = billOrder(db, [defaultRateItem]);
  belowCalculation.tax = 175;
  belowCalculation.total = 1175;
  const aboveCalculation = billOrder(db, [defaultRateItem]);
  aboveCalculation.tax = 190;
  aboveCalculation.total = 1190;
  billOrder(db, [defaultRateItem], '', 'pending');
  billOrder(db, mixedSlabItems, 'SAVE10', 'cancelled');

  const { rows, ...summary } = reports.getGstReconciliation(db);

  assert.deepEqual(summary, { totalChecked: 3, mismatchCount: 2, totalDelta: 15 });
  assert.deepEqual(rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) => (
    { orderId, ledgerTax, invoiceTax, delta, matched }
  )), [
    { orderId: 1, ledgerTax: 175, invoiceTax: 180, delta: 5, matched: false },
    { orderId: 2, ledgerTax: 190, invoiceTax: 180, delta: -10, matched: false },
    { orderId: 3, ledgerTax: 180, invoiceTax: 180, delta: 0, matched: true }
  ]);
  assert.match(invoice.render(belowCalculation), /differs from Order Ledger recorded total \(₹1175\.00\) by \+₹5\.00/);
});

test('a SAVE10 sale with matching grand totals also reconciles its GST', () => {
  const db = { orders: [], nextOrderId: 1 };
  const order = billOrder(db, [defaultRateItem], 'SAVE10');
  const { rows: [row], ...summary } = reports.getGstReconciliation(db);

  assert.deepEqual(summary, { totalChecked: 1, mismatchCount: 0, totalDelta: 0 });
  assert.equal(row.ledgerTotal, 1062);
  assert.equal(row.invoiceTotal, 1062);
  assert.equal(row.ledgerTax, 162);
  assert.equal(row.invoiceTax, 162);
  assert.equal(row.delta, 0);
  assert.equal(row.matched, true);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹162\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
