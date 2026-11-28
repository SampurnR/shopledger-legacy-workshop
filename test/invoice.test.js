const assert = require('node:assert/strict');
const { test } = require('node:test');
const app = require('../server');
const store = require('../lib/store');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const orderRoutes = require('../routes/orders');
const reportRoutes = require('../routes/reports');

// Invoke the registered handlers without opening a socket.
function runRoute(router, method, path, req) {
  const layer = router.stack.find(({ route }) => route?.path === path && route.methods[method]);
  const handler = layer.route.stack.find((entry) => entry.method === method).handle;
  const response = { status: 200 };
  handler(req, {
    status(code) {
      response.status = code;
      return this;
    },
    json(body) {
      response.body = body;
    },
    send(body) {
      response.body = body;
    }
  });
  return response;
}

test('printable invoice matches the cart and saved order for mixed GST slabs and a capped coupon', (t) => {
  const db = {
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, stock: 10 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 500, stock: 10 },
      { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', price: 500, stock: 10 }
    ],
    orders: [],
    nextOrderId: 1001
  };
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', (saved) => assert.equal(saved, db));

  const request = {
    body: {
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }, { id: 3, qty: 1 }],
      coupon: ' save10 '
    }
  };

  const previewResponse = runRoute(reportRoutes, 'post', '/pricing/preview', request);
  assert.equal(previewResponse.status, 200);
  const { totals } = previewResponse.body;
  const { lines, ...cart } = totals;
  assert.deepEqual(cart, {
    subtotal: 2000, discount: 150, taxable: 1850, tax: 185,
    cgst: 92.5, sgst: 92.5, total: 2035
  });
  assert.deepEqual(lines.map(({ gstPercent, discount, taxable, tax }) => (
    { gstPercent, discount, taxable, tax }
  )), [
    { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
    { gstPercent: 12, discount: 37.5, taxable: 462.5, tax: 55.5 },
    { gstPercent: 18, discount: 37.5, taxable: 462.5, tax: 83.25 }
  ]);

  const orderResponse = runRoute(orderRoutes, 'post', '/orders', request);
  assert.equal(orderResponse.status, 201);
  const order = orderResponse.body;
  assert.deepEqual(db.orders, [order]);
  assert.deepEqual(order.items.map(({ hsn }) => hsn), ['1006', '0405', '0902']);
  assert.ok(order.items.every((item) => !Object.hasOwn(item, 'gstRate')));
  const { coupon, subtotal, discount, tax, total } = order;
  assert.deepEqual({ coupon, subtotal, discount, tax, total }, {
    coupon: 'SAVE10', subtotal: 2000, discount: 150, tax: 185, total: 2035
  });

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 185, cgst: 92.5, sgst: 92.5, total: 2035
  });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 46.25 },
    { gstPercent: 12, lineTax: 55.5 },
    { gstPercent: 18, lineTax: 83.25 }
  ]);

  const invoiceResponse = runRoute(app._router, 'get', '/orders/:id/invoice', {
    params: { id: String(order.id) }
  });
  assert.equal(invoiceResponse.status, 200);
  const html = invoiceResponse.body;
  assert.match(html, /5%<\/td><td[^>]*>₹46\.25<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹185\.00<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹2035\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('pricing and invoice agree for a whole-rupee default-rate order without a coupon', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  const { lines, taxable, ...billed } = pricing.computeTotals(items);
  const order = { items, ...billed };
  const { rows, ...printed } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed, {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
  assert.deepEqual(printed, billed);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the same legacy percentage, decimal and zero GST rates as pricing', () => {
  const items = [
    { name: 'Percent rate', price: 100, qty: 1, hsn: '1006', gstRate: 12 },
    { name: 'Decimal rate', price: 100, qty: 1, hsn: '1006', gstRate: 0.12 },
    { name: 'Zero rate', price: 100, qty: 1, hsn: '1006', gstRate: 0 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map((line) => line.tax), [12, 12, 0]);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [12, 12, 0]);
  assert.equal(billed.total, 324);
  assert.equal(printed.total, 324);
});

test('invoice follows billing rules for coupons below the minimum and expired coupons', () => {
  const items = [{ name: 'Tea', price: 10, qty: 1 }];
  for (const coupon of ['FLAT50', 'DIWALI20']) {
    const billed = pricing.computeTotals(items, coupon);
    const printed = invoice.computeInvoiceFigures({ items, coupon });

    assert.equal(billed.discount, 0, coupon);
    assert.equal(billed.total, 11.8, coupon);
    assert.equal(printed.discount, 0, coupon);
    assert.equal(printed.total, 11.8, coupon);
  }
});

test('invoice and pricing both sum the rounded GST rows', () => {
  const items = [
    { name: 'Tea', price: 0.03, qty: 1 },
    { name: 'Coffee', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(printed.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
});

test('reprinting a saved order preserves its discount after the coupon expires', () => {
  const order = {
    items: [{ name: 'Tea', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    discount: 200,
    tax: 144,
    total: 944
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(printed.discount, 200);
  assert.equal(printed.rows[0].lineTax, 144);
  assert.equal(printed.tax, 144);
  assert.equal(printed.total, 944);
});

test('CURRENT BEHAVIOUR: reconciliation flags a GST-only mismatch but the invoice has no notice', () => {
  const order = {
    id: 1001,
    items: [{ name: 'Tea', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 19,
    total: 118
  };
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.equal(report.totalChecked, 1);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  const { ledgerTax, invoiceTax, delta, matched } = report.rows[0];
  assert.deepEqual({ ledgerTax, invoiceTax, delta, matched }, {
    ledgerTax: 19, invoiceTax: 18, delta: 0, matched: false
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
