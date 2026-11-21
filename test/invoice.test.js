const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billedOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  return orders.add(db, {
    ...pricing.computeTotals(items, coupon),
    items,
    coupon,
    date: '2026-11-20'
  });
}

test('printable invoice shows the billed HSN rates, GST and total', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ]);
  const html = invoice.render(order);

  assert.match(html, />5%<\/td><td class="r">₹5\.00/);
  assert.match(html, />12%<\/td><td class="r">₹12\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹17\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹217\.00/);
  assert.doesNotMatch(html, /Line GST breakdown unavailable/);
});

test('invoice figures use the billed GST for mixed HSN slabs', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 17);
  assert.equal(order.total, 217);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [12, 12]]);
  assert.equal(figures.tax, 17);
  assert.equal(figures.cgst, 8.5);
  assert.equal(figures.sgst, 8.5);
  assert.equal(figures.total, 217);
});

test('invoice uses the capped percent coupon and taxes the discounted amount', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.rows[0].lineTax, figures.tax, figures.total], [150, 333, 333, 2183]);
});

test('invoice calculates GST after applying a flat coupon', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  assert.deepEqual([figures.discount, figures.rows[0].lineTax, figures.tax, figures.total], [50, 81, 81, 531]);
});

test('invoice resolves zero, decimal and percentage GST rates as billing does', () => {
  const items = [
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal-rated item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Percentage-rated item', price: 100, qty: 1, gstRate: 5 }
  ];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[0, 0], [5, 5], [5, 5]]);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[0, 0], [5, 5], [5, 5]]);
});

test('invoice sums rounded line GST amounts', () => {
  const order = billedOrder([
    { name: 'Tea sample', hsn: '0902', price: 0.03, qty: 1 },
    { name: 'Coffee sample', hsn: '0901', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('invoice matches billing for a single default-rate item without a coupon', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [18, 9, 9, 118]);
  assert.equal(figures.total, order.total);
  assert.doesNotMatch(invoice.render(order), /Line GST breakdown unavailable/);
});

test('invoice preserves saved amounts and calculates fields missing from older orders', () => {
  const order = {
    items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }],
    discount: 100,
    tax: 0
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 100);
  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 0);
  assert.equal(figures.total, 0);
  assert.equal(figures.rows[0].lineTax, null);
  assert.match(invoice.render(order), /Line GST breakdown unavailable/);
  assert.equal(invoice.computeInvoiceFigures({ ...order, total: 1 }).total, 1);
  assert.match(invoice.render({ ...order, total: 1 }), /Accountant Reconciliation Notice/);
  assert.equal(invoice.computeInvoiceFigures({ ...order, tax: undefined }).total, 0);
  assert.equal(invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 499, qty: 1 }],
    subtotal: 500,
    coupon: 'SAVE10'
  }).discount, 50);
});
