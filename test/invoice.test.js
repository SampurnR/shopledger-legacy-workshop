const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const orderRoutes = require('../routes/orders');
const store = require('../lib/store');

const createOrder = orderRoutes.stack.find(
  ({ route }) => route?.path === '/orders' && route.methods.post
).route.stack[0].handle;

function billOrder(t, products, coupon = '') {
  const db = {
    products: products.map(product => ({ stock: 10, ...product })),
    orders: [],
    nextOrderId: 1001
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});
  let status;
  let order;
  createOrder({
    body: {
      coupon,
      items: products.map(({ id }) => ({ id, qty: 1 }))
    }
  }, {
    status(code) {
      status = code;
      return this;
    },
    json(value) {
      order = value;
    }
  });
  assert.equal(status, 201);
  assert.strictEqual(db.orders[0], order);
  assert.equal(write.mock.callCount(), 1);
  return order;
}

function totals({ subtotal, discount, tax, total }) {
  return { subtotal, discount, tax, total };
}

test('invoice and billing agree on a single default-rate item without a coupon', t => {
  const order = billOrder(t, [{ id: 1, name: 'Item', price: 100 }]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(totals(order), { subtotal: 100, discount: 0, tax: 18, total: 118 });
  assert.deepEqual(totals(figures), totals(order));
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses HSN slabs and the capped percentage coupon', t => {
  const order = billOrder(t, [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000 }
  ], ' save10 ');
  assert.equal(order.coupon, 'SAVE10');
  assert.deepEqual(totals(order), {
    subtotal: 2000, discount: 150, tax: 157.25, total: 2007.25
  });
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(totals(figures), {
    subtotal: 2000, discount: 150, tax: 157.25, total: 2007.25
  });
  assert.deepEqual(figures.rows.map(({ hsn, gstPercent, lineTax }) => (
    { hsn, gstPercent, lineTax }
  )), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 }
  ]);
  assert.equal(figures.cgst, 78.63);
  assert.equal(figures.sgst, 78.62);
});

test('a flat coupon reduces taxable value for invoice GST', t => {
  const order = billOrder(t, [{ id: 1, name: 'Item', price: 300 }], 'FLAT50');
  assert.deepEqual(totals(order), { subtotal: 300, discount: 50, tax: 45, total: 295 });
  assert.deepEqual(totals(invoice.computeInvoiceFigures(order)), {
    subtotal: 300, discount: 50, tax: 45, total: 295
  });
});

test('invoice GST sums the rounded line GST amounts', t => {
  const order = billOrder(t, [
    { id: 1, name: 'First item', price: 0.03 },
    { id: 2, name: 'Second item', price: 0.03 }
  ]);
  assert.deepEqual(totals(order), { subtotal: 0.06, discount: 0, tax: 0.02, total: 0.08 });
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(totals(figures), {
    subtotal: 0.06, discount: 0, tax: 0.02, total: 0.08
  });
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
});

test('invoice accepts stored percentage, decimal, and zero GST rates', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 },
      { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
      { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
    ]
  });
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5],
    [5, 5],
    [0, 0]
  ]);
  assert.deepEqual(totals(figures), {
    subtotal: 300, discount: 0, tax: 10, total: 310
  });
});

test('printable invoice shows the billed total and discounted GST for a mixed-rate order', t => {
  const order = billOrder(t, [
    { id: 1, name: 'Rice', hsn: '1006', price: 1000 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000 }
  ], 'SAVE10');
  const html = invoice.render(order);
  const displayedTotal = html.match(/Invoice Total<\/td><td class="r">([^<]+)/)?.[1];
  const displayedTax = html.match(/Total GST\)<\/td><td class="r">([^<]+)/)?.[1];
  assert.deepEqual({ displayedTotal, displayedTax }, {
    displayedTotal: '₹2007.25', displayedTax: '₹157.25'
  });
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice preserves recorded order amounts and splits recorded GST', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 10,
    tax: 5.01,
    total: 95.01
  });
  assert.deepEqual(totals(figures), { subtotal: 100, discount: 10, tax: 5.01, total: 95.01 });
  assert.equal(figures.cgst, 2.51);
  assert.equal(figures.sgst, 2.5);
});
