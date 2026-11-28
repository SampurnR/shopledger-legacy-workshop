const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice matches the billed total and GST for a capped coupon on mixed GST items', () => {
  const items = [
    { name: 'Rice', hsn: '1006', price: 640, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 260, qty: 3 }
  ];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const order = {
    id: 3, items, coupon, subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { total: figures.total, tax: figures.tax, discount: figures.discount },
    { total: 2056.12, tax: 146.12, discount: 150 }
  );
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 59.34], [12, 86.78]]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice and checkout agree for an undiscounted line at the default GST rate', () => {
  const items = [{ name: 'Item', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items, total: billed.total });

  assert.equal(billed.total, 236);
  assert.equal(figures.total, 236);
  assert.equal(figures.tax, 36);
  assert.equal(figures.cgst, 18);
  assert.equal(figures.sgst, 18);
  assert.doesNotMatch(invoice.render({ id: 1, items, total: billed.total }),
    /Accountant Reconciliation Notice/);
});

test('invoice uses HSN rates and applies the capped coupon before GST', () => {
  // Order creation snapshots HSN on each line and leaves out gstRate.
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const order = {
    id: 2, items, coupon, subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.subtotal, 2000);
  assert.equal(billed.discount, 150);
  assert.deepEqual(billed.lines.map(({ gstPercent, discount, tax }) =>
    [gstPercent, discount, tax]), [[5, 75, 46.25], [12, 75, 111]]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total],
    [157.25, 78.63, 78.62, 2007.25]);

  assert.equal(figures.subtotal, 2000);
  assert.equal(figures.discount, 150);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) =>
    [gstPercent, lineTax]), [[5, 46.25], [12, 111]]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total],
    [157.25, 78.63, 78.62, 2007.25]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice ignores an inactive coupon below its minimum', () => {
  const items = [{ name: 'Item', price: 100, qty: 1 }];
  const coupon = 'DIWALI20';
  assert.equal(pricing.computeTotals(items, coupon).discount, 0);

  const figures = invoice.computeInvoiceFigures({ items, coupon, total: 118 });
  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 18);
  assert.equal(figures.total, 118);
});

test('invoice sums rounded line taxes using the same rounding as checkout', () => {
  const items = [
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items, total: billed.total });

  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total],
    [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total],
    [0.02, 0.01, 0.01, 0.08]);
});

test('invoice still shows a reconciliation notice when the recorded total differs', () => {
  const items = [{ name: 'Item', price: 100, qty: 1 }];
  assert.match(invoice.render({ id: 4, items, total: 115 }),
    /Accountant Reconciliation Notice:.*₹118\.00.*₹115\.00.*\+₹3\.00/);
});
