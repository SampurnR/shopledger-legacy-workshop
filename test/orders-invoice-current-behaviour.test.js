'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const orderRouter = require('../routes/orders');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const store = require('../lib/store');

const postOrderHandler = orderRouter.stack
  .find(layer => layer.route && layer.route.path === '/orders' && layer.route.methods.post)
  .route.stack[0].handle;

function placeInMemoryOrder() {
  const db = {
    nextOrderId: 1001,
    products: [{
      id: 1,
      sku: 'RICE-001',
      name: 'Rice',
      hsn: '1006',
      price: 2000,
      stock: 10,
      reserved: 0
    }],
    orders: [],
    customers: [],
    settlements: [],
    auditLog: []
  };

  const originalRead = store.read;
  const originalWrite = store.write;
  store.read = () => db;
  store.write = () => {};

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  try {
    postOrderHandler({
      body: {
        items: [{ id: 1, qty: 1 }],
        paymentMode: 'cash',
        coupon: 'SAVE10'
      }
    }, res);
  } finally {
    store.read = originalRead;
    store.write = originalWrite;
  }

  return { db, res };
}

test('Placed order uses HSN tax and applies discount before GST', () => {
  const { db, res } = placeInMemoryOrder();

  assert.equal(res.statusCode, 201);
  assert.equal(db.orders.length, 1);
  assert.deepEqual(
    {
      subtotal: res.body.subtotal,
      discount: res.body.discount,
      tax: res.body.tax,
      total: res.body.total
    },
    { subtotal: 2000, discount: 150, tax: 92.5, total: 1942.5 }
  );
  assert.equal(res.body.items[0].hsn, '1006');
  assert.equal('gstRate' in res.body.items[0], false);
  assert.equal('cgst' in res.body, false);
  assert.equal('sgst' in res.body, false);
});

test('Invoice figures and GST reconciliation match the placed order', () => {
  const { db, res } = placeInMemoryOrder();
  const figures = invoice.computeInvoiceFigures(res.body);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      lineGstPercent: figures.rows[0].gstPercent,
      lineTax: figures.rows[0].lineTax
    },
    {
      subtotal: res.body.subtotal,
      discount: res.body.discount,
      tax: res.body.tax,
      cgst: 46.25,
      sgst: 46.25,
      total: res.body.total,
      lineGstPercent: 5,
      lineTax: 92.5
    }
  );

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 92.5);
  assert.equal(reconciliation.rows[0].invoiceTax, 92.5);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
