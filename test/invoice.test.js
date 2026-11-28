const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

const order = {
  coupon: 'SAVE10',
  items: [{ name: 'Rice', sku: 'R1', hsn: '1006', qty: 3, price: 640 }]
};

test('invoice uses the billed GST slab and capped discount', () => {
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 88.50);
  assert.equal(figures.discount, 150);
  assert.deepEqual([figures.cgst, figures.sgst, figures.rows[0].gstPercent, figures.rows[0].lineTax], [44.25, 44.25, 5, 88.50]);
  assert.equal(figures.total, 1858.50);
});

test('invoice keeps product identity, quantity and gross amount', () => {
  const [row] = invoice.computeInvoiceFigures(order).rows;
  assert.deepEqual([row.name, row.sku, row.hsn, row.qty, row.price, row.line],
    ['Rice', 'R1', '1006', 3, 640, 1920]);
});

test('invoice apportions a flat discount across mixed GST slabs', () => {
  const figures = invoice.computeInvoiceFigures({
    coupon: 'FLAT50',
    items: [
      { hsn: '1006', qty: 1, price: 300 },
      { hsn: '0902', qty: 1, price: 100 }
    ]
  });
  assert.deepEqual(figures.rows.map(row => row.lineTax), [13.13, 15.75]);
  assert.equal(figures.total, 378.88);
});

test('reprinting a saved checkout preserves the billed tax and coupon', (t) => {
  const config = require('../config');
  const store = require('../lib/store');
  const router = require('../routes/orders');
  const db = {
    products: [{ ...order.items[0], id: 1, stock: 10 }],
    orders: [], nextOrderId: 1, auditLog: []
  };
  let saved;
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', data => { saved = JSON.parse(JSON.stringify(data)); });
  const route = router.stack.find(layer => layer.route.path === '/orders' && layer.route.methods.post);
  route.route.stack[0].handle({ body: { items: [{ id: 1, qty: 3 }], coupon: 'SAVE10' } }, {
    status(code) { assert.equal(code, 201); return this; },
    json() {}
  });

  const billed = saved.orders[0];
  assert.equal(billed.total, 1858.50);
  const oldRate = config.tax.hsnSlabs['1006'];
  const coupon = config.coupons.SAVE10;
  t.after(() => {
    config.tax.hsnSlabs['1006'] = oldRate;
    config.coupons.SAVE10 = coupon;
  });
  config.tax.hsnSlabs['1006'] = 18;
  delete config.coupons.SAVE10;

  const figures = invoice.computeInvoiceFigures(billed);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.discount, 150);
  assert.deepEqual([figures.rows[0].gstPercent, figures.rows[0].lineTax], [5, 88.50]);
});
