const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('an uncouponed order at the fallback rate prints the billed total without a notice', () => {
  const items = [{ id: 1, name: 'Tea', price: 50, qty: 2 }];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 1, items, ...billed };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 18,
    cgst: 9,
    sgst: 9,
    total: 118,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 50,
      gstPercent: 18, line: 100, lineTax: 18
    }]
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹118\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('a billed mixed-GST order reconciles with its invoice', () => {
  const order = {
    id: 1,
    date: '21/11/2026',
    items: [
      { name: 'Rice', hsn: '1006', price: 500, qty: 2 },
      { name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
    ],
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 157.25,
    total: 2007.25
  };

  const { mismatchCount, rows: [row] } = reports.getGstReconciliation({ orders: [order] });
  const { invoiceDiscount, invoiceTax, invoiceTotal, matched } = row;
  assert.deepEqual({ invoiceDiscount, invoiceTax, invoiceTotal, matched, mismatchCount }, {
    invoiceDiscount: 150, invoiceTax: 157.25, invoiceTotal: 2007.25, matched: true, mismatchCount: 0
  });
});

test('checkout and the printed invoice agree on HSN GST and a capped coupon', (t) => {
  const db = {
    products: [
      { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, stock: 10 },
      { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 1000, stock: 10 }
    ],
    orders: [],
    customers: [{ id: 1, name: 'Customer', creditLimit: 5000 }],
    nextOrderId: 1
  };
  const store = require('../lib/store');
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', (savedDb) => assert.equal(savedDb, db));

  // Call the registered Express handlers without opening a network socket.
  const orderRoutes = require('../routes/orders');
  const checkoutRoute = orderRoutes.stack.find(({ route }) => route.path === '/orders' && route.methods.post).route;
  const checkoutResponse = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    }
  };
  checkoutRoute.stack[0].handle({
    body: {
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }],
      coupon: ' save10 ',
      customerId: 1,
      paymentMode: 'khata'
    }
  }, checkoutResponse);
  assert.equal(checkoutResponse.statusCode, 201);
  const { id, items, coupon, subtotal, discount, tax, total } = checkoutResponse.body;
  assert.deepEqual(items, [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 1000, qty: 1 }
  ]);
  assert.deepEqual({ coupon, subtotal, discount, tax, total }, {
    coupon: 'SAVE10', subtotal: 2000, discount: 150, tax: 157.25, total: 2007.25
  });
  assert.equal(write.mock.callCount(), 1);
  assert.equal(db.customers[0].totalBilled, 2007.25);

  const billed = pricing.computeTotals(items, coupon);
  const figures = invoice.computeInvoiceFigures(checkoutResponse.body);
  assert.deepEqual({ cgst: figures.cgst, sgst: figures.sgst }, { cgst: 78.63, sgst: 78.62 });
  assert.deepEqual(billed.lines, [
    { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 1000, discount: 75, taxable: 925, tax: 46.25, net: 971.25 },
    { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 1000, discount: 75, taxable: 925, tax: 111, net: 1036 }
  ]);

  const app = require('../server');
  const invoiceRoute = app._router.stack.find(({ route }) => route?.path === '/orders/:id/invoice').route;
  let html;
  invoiceRoute.stack[0].handle({ params: { id: String(id) } }, {
    send(body) {
      html = body;
    }
  });
  assert.match(html, />5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, />12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r"[^>]*>-₹150\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('the invoice uses the billed GST for whole, decimal, and zero rates', () => {
  const items = [
    { name: 'Whole percentage', hsn: '0405', price: 100, qty: 1, gstRate: 5 },
    { name: 'Decimal rate', hsn: '0405', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', hsn: '0405', price: 100, qty: 1, gstRate: 0 }
  ];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map((line) => line.gstPercent), [5, 5, 0]);
  assert.deepEqual(billed.lines.map((line) => line.tax), [5, 5, 0]);
  assert.equal(billed.total, 310);
  assert.deepEqual(printed.rows.map((row) => row.gstPercent), [5, 5, 0]);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [5, 5, 0]);
  assert.equal(printed.tax, 10);
  assert.equal(printed.total, 310);
});

test('a flat discount reduces taxable value at checkout and on the invoice', () => {
  const items = [{ name: 'Rice', price: 300, qty: 1, gstRate: 5 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.taxable, 250);
  assert.equal(billed.tax, 12.5);
  assert.equal(billed.total, 262.5);
  assert.equal(printed.discount, 50);
  assert.equal(printed.tax, 12.5);
  assert.equal(printed.total, 262.5);
});

test('invoice coupon calculation uses checkout normalization and eligibility rules', () => {
  const items = [{ name: 'Tea', price: 20, qty: 1 }];

  for (const { coupon, billedDiscount, invoiceDiscount, invoiceTotal } of [
    { coupon: 'FLAT50', billedDiscount: 0, invoiceDiscount: 0, invoiceTotal: 23.6 },
    { coupon: 'DIWALI20', billedDiscount: 0, invoiceDiscount: 0, invoiceTotal: 23.6 },
    { coupon: ' welcome ', billedDiscount: 1, invoiceDiscount: 1, invoiceTotal: 22.42 }
  ]) {
    assert.equal(pricing.computeTotals(items, coupon).discount, billedDiscount, coupon);
    const printed = invoice.computeInvoiceFigures({ items, coupon });
    assert.equal(printed.discount, invoiceDiscount, coupon);
    assert.equal(printed.total, invoiceTotal, coupon);
  }
});

test('invoice total GST sums the rounded tax on each line', () => {
  const items = [
    { id: 1, name: 'First item', price: 0.1, qty: 1, gstRate: 5 },
    { id: 2, name: 'Second item', price: 0.1, qty: 1, gstRate: 5 }
  ];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 1, items, ...billed };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map((line) => line.tax), [0.01, 0.01]);
  assert.equal(billed.tax, 0.02);
  assert.equal(billed.total, 0.22);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual({ tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total }, {
    tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.22
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: reconciliation flags a GST-only difference without an invoice notice', () => {
  const order = {
    id: 1,
    date: '2021-11-21',
    items: [{ name: 'Tea', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 17,
    total: 118
  };

  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1,
    mismatchCount: 1,
    totalDelta: 0,
    rows: [{
      orderId: 1, date: '2021-11-21', customer: 'Walk-in', coupon: '',
      ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 17, ledgerTotal: 118,
      invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: 0, matched: false
    }]
  });
});
