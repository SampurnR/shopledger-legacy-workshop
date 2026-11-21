const assert = require('node:assert/strict');
const test = require('node:test');

const app = require('../server');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const store = require('../lib/store');

const tea = { id: 1, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 };

function runRoute(method, path, request) {
  // Dispatch the registered route in process so the test needs no listening socket.
  const layers = app._router.stack.flatMap((layer) => layer.handle.stack || [layer]);
  const layer = layers.find(({ route }) => route && route.path === path && route.methods[method.toLowerCase()]);
  assert.ok(layer, method + ' ' + path + ' should be registered');

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      return this.send(body);
    }
  };
  layer.route.dispatch({ ...request, method }, response, (error) => {
    assert.ifError(error);
  });
  return response;
}

test('an undiscounted 18% item has matching checkout and invoice totals', () => {
  const totals = pricing.computeTotals([tea], '');
  assert.deepEqual(totals, {
    subtotal: 100, discount: 0, taxable: 100, tax: 18, cgst: 9, sgst: 9, total: 118,
    lines: [
      { id: 1, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 0, taxable: 100, tax: 18, net: 118 }
    ]
  });

  const order = { id: 1, items: [tea], coupon: '', total: 118 };
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a mixed-HSN khata invoice matches the billed total and post-discount GST', (t) => {
  const db = {
    products: [
      { id: 2, name: 'Rice', sku: 'RICE', hsn: '1006', price: 150, stock: 10 },
      { id: 3, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, stock: 10 }
    ],
    customers: [{ id: 1, name: 'Asha', creditLimit: 1000 }],
    orders: [],
    nextOrderId: 1001
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', (writtenDb) => assert.strictEqual(writtenDb, db));

  const cart = { items: [{ id: 2, qty: 2 }, { id: 3, qty: 1 }], coupon: ' save10 ' };

  const previewResponse = runRoute('POST', '/pricing/preview', { body: cart });
  assert.equal(previewResponse.statusCode, 200);
  const { totals } = previewResponse.body;
  assert.deepEqual(totals, {
    subtotal: 500, discount: 50, taxable: 450, tax: 35.1, cgst: 17.55, sgst: 17.55, total: 485.1,
    lines: [
      { id: 2, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 300, discount: 30, taxable: 270, tax: 13.5, net: 283.5 },
      { id: 3, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 200, discount: 20, taxable: 180, tax: 21.6, net: 201.6 }
    ]
  });

  const orderResponse = runRoute('POST', '/orders', {
    body: { ...cart, customerId: 1, paymentMode: 'khata' }
  });
  assert.equal(orderResponse.statusCode, 201);
  const order = orderResponse.body;
  const { coupon, subtotal, discount, tax, total } = order;
  assert.deepEqual({ coupon, subtotal, discount, tax, total }, {
    coupon: 'SAVE10', subtotal: 500, discount: 50, tax: 35.1, total: 485.1
  });
  assert.deepEqual(db.orders, [order]);
  assert.equal(db.customers[0].totalBilled, 485.1);
  assert.equal(write.mock.callCount(), 1);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500, discount: 50, tax: 35.1, cgst: 17.55, sgst: 17.55, total: 485.1,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 150, gstPercent: 5, line: 300, lineTax: 13.5 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 200, gstPercent: 12, line: 200, lineTax: 21.6 }
    ]
  });
  const invoiceResponse = runRoute('GET', '/orders/:id/invoice', { params: { id: String(order.id) } });
  assert.equal(invoiceResponse.statusCode, 200);
  const html = invoiceResponse.body;
  assert.match(html, /5%<\/td><td class="r">₹13\.50/);
  assert.match(html, /12%<\/td><td class="r">₹21\.60/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹35\.10/);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-₹50\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹485\.10/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const reconciliationResponse = runRoute('GET', '/reports/gst-reconciliation');
  assert.equal(reconciliationResponse.statusCode, 200);
  assert.deepEqual(reconciliationResponse.body, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: order.date, customer: 'Asha', coupon: 'SAVE10',
      ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 35.1, ledgerTotal: 485.1,
      invoiceDiscount: 50, invoiceTax: 35.1, invoiceTotal: 485.1, delta: 0, matched: true
    }]
  });
});

test('invoice and checkout agree on percentage, decimal and zero GST rates', () => {
  const items = [
    { ...tea, name: 'Percentage rate', gstRate: 5 },
    { ...tea, name: 'Decimal rate', gstRate: 0.05 },
    { ...tea, name: 'Zero rate', gstRate: 0 }
  ];
  const checkout = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(checkout.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [
    [5, 5], [5, 5], [0, 0]
  ]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5], [5, 5], [0, 0]
  ]);
  assert.equal(checkout.total, 310);
  assert.equal(printed.total, 310);
});

test('the invoice uses checkout coupon normalization, minimums, limits and expiry', () => {
  const cases = [
    { coupon: ' save10 ', price: 500, discount: 50 },
    { coupon: 'SAVE10', price: 100, discount: 0 },
    { coupon: 'SAVE10', price: 2000, discount: 150 },
    { coupon: 'DIWALI20', price: 1000, discount: 0 },
    { coupon: 'FLAT50', price: 10, discount: 0 }
  ];

  for (const { coupon, price, discount } of cases) {
    const items = [{ ...tea, price }];
    const label = JSON.stringify({ coupon, price });
    assert.equal(pricing.computeTotals(items, coupon).discount, discount, label);
    assert.equal(invoice.computeInvoiceFigures({ items, coupon }).discount, discount, label);
  }
});

test('printed line GST and total GST use checkout rounding', () => {
  const items = [{ ...tea, price: 0.03 }, { ...tea, id: 2, price: 0.03 }];
  const checkout = pricing.computeTotals(items, '');
  const order = { id: 2, items, total: 0.08 };
  const { rows, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: checkout.tax, cgst: checkout.cgst, sgst: checkout.sgst, total: checkout.total },
    { tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 }
  );
  assert.deepEqual(rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual({ tax, cgst, sgst, total }, { tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.match(invoice.render({ ...order, total: 0.09 }), /differs from Order Ledger recorded total \(₹0\.09\) by -₹0\.01\./);
});

test('CURRENT BEHAVIOUR: checkout rounds coupon allocations independently of the cart discount', () => {
  const items = [1, 2, 3].map((id) => ({ ...tea, id, price: 0.1 }));
  const { discount, taxable, tax, total, lines } = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual({ discount, taxable, tax, total }, { discount: 0.02, taxable: 0.28, tax: 0.06, total: 0.34 });
  assert.deepEqual(lines.map((line) => [line.discount, line.taxable, line.tax, line.net]), [
    [0.01, 0.09, 0.02, 0.11],
    [0.01, 0.09, 0.02, 0.11],
    [0.01, 0.09, 0.02, 0.11]
  ]);
});

test('CURRENT BEHAVIOUR: reconciliation flags a tax-only difference without an invoice notice', () => {
  const order = { id: 3, items: [tea], subtotal: 100, discount: 0, tax: 17.99, total: 118 };
  const cancelled = { ...order, id: 4, status: 'cancelled', total: 100 };
  const result = reports.getGstReconciliation({ orders: [order, cancelled] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) => ({
    orderId, ledgerTax, invoiceTax, delta, matched
  })), [
    { orderId: 3, ledgerTax: 17.99, invoiceTax: 18, delta: 0, matched: false }
  ]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
