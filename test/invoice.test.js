const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billOrder(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1001, orders: [] };
  const order = orders.add(db, { ...billed, items, coupon, date: '2021-11-15' });
  return { billed, order };
}

test('invoice matches billing for a default-rate item without a coupon', () => {
  const { order } = billOrder([{ name: 'Loose tea', price: 50, qty: 2 }]);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 18,
    cgst: 9,
    sgst: 9,
    total: 118,
    rows: [{
      name: 'Loose tea',
      sku: '-',
      hsn: '-',
      qty: 2,
      price: 50,
      gstPercent: 18,
      line: 100,
      lineTax: 18
    }]
  });
  assert.equal(order.total, 118);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice calculates GST after applying a flat coupon', () => {
  const { order } = billOrder([{ name: 'Loose tea', price: 300, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('invoice treats an explicit whole-number GST rate as a percentage', () => {
  const { order } = billOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 12 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 12);
  assert.equal(figures.rows[0].lineTax, 12);
  assert.equal(figures.total, 112);
  assert.equal(order.total, 112);
});

test('invoice preserves a zero GST rate even for an HSN with a nonzero slab', () => {
  const { order } = billOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 0 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [0, 100]);
  assert.equal(figures.rows[0].gstPercent, 0);
  assert.deepEqual([figures.rows[0].lineTax, figures.tax, figures.total], [0, 0, 100]);
});

test('invoice interprets a decimal GST rate the same way as checkout', () => {
  const { order } = billOrder([{ name: 'Rice', price: 100, qty: 1, gstRate: 0.05 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.tax, order.total], [5, 105]);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.deepEqual([figures.rows[0].lineTax, figures.tax, figures.total], [5, 5, 105]);
});

test('invoice adds rounded GST lines the same way as checkout', () => {
  const { billed, order } = billOrder([
    { name: 'Sample A', price: 0.03, qty: 1 },
    { name: 'Sample B', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice falls back to checkout coupon rules when no billed amounts were recorded', () => {
  const items = [{ name: 'Loose tea', price: 100, qty: 1 }];

  for (const [coupon, discount, gst, total] of [
    ['DIWALI20', 0, 18, 118],
    ['SAVE10', 0, 18, 118],
    ['WELCOME', 5, 17.1, 112.1]
  ]) {
    const figures = invoice.computeInvoiceFigures({ items, coupon });
    assert.deepEqual([figures.discount, figures.tax, figures.total], [discount, gst, total], coupon);
  }
});

test('invoice uses the recorded discount for line GST even if the coupon is now expired', () => {
  const order = {
    items: [{ name: 'Loose tea', price: 100, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 100,
    discount: 20,
    tax: 14.4,
    total: 94.4
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [figures.discount, figures.rows[0].lineTax, figures.tax, figures.total],
    [20, 14.4, 14.4, 94.4]
  );
});

test('invoice preserves a recorded zero discount even when the coupon would qualify today', () => {
  const { order } = billOrder([{ name: 'Loose tea', price: 100, qty: 1 }]);
  order.coupon = 'WELCOME';
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [figures.discount, figures.rows[0].lineTax, figures.tax, figures.total],
    [0, 18, 18, 118]
  );
});

test('invoice prints the billed total and GST breakdown for a mixed-slab order with a capped coupon', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 1000, qty: 1 }
  ];
  const { billed, order } = billOrder(items, 'SAVE10');
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: billed.lines[0].tax },
    { hsn: '0405', gstPercent: 12, lineTax: billed.lines[1].tax }
  ]);

  const html = invoice.render(order);
  assert.match(html, /<td>1006<\/td><td class="r">2<\/td><td class="r">₹500\.00<\/td><td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td>0405<\/td><td class="r">1<\/td><td class="r">₹1000\.00<\/td><td class="r">12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-₹150\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
