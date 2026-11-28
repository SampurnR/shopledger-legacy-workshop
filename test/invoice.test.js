const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');

const app = require('../server');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const store = require('../lib/store');

test('invoice uses the recorded bill and the checkout GST breakdown for a discounted mixed-rate order', () => {
  const order = {
    id: 1001,
    coupon: 'SAVE10',
    subtotal: 600,
    discount: 60,
    tax: 74.7,
    total: 614.7,
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 200, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 300, qty: 1 }
    ]
  };
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, { subtotal: 600, discount: 60, tax: 74.7, cgst: 37.35, sgst: 37.35, total: 614.7 });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 4.5], [12, 21.6], [18, 48.6]]);
});

test('checkout, printable invoice, and reconciliation agree on discounted HSN GST', async (t) => {
  const db = {
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, stock: 10 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 200, stock: 10 },
      { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', price: 300, stock: 10 }
    ],
    customers: [{ id: 1, name: 'Credit Customer', creditLimit: 1000 }],
    orders: [],
    nextOrderId: 1001
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});

  const server = app.listen(0, '127.0.0.1');
  t.after(() => {
    if (server.listening) return new Promise((resolve) => server.close(resolve));
  });
  await once(server, 'listening');
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  const request = {
    items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }, { id: 3, qty: 1 }],
    coupon: ' save10 ',
    paymentMode: 'khata',
    customerId: 1
  };
  const post = (path, body) => fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const rejected = await post('/api/orders', { ...request, coupon: 'DIWALI20' });
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { error: 'Coupon DIWALI20 has expired' });
  assert.equal(write.mock.callCount(), 0);
  assert.deepEqual(db.orders, []);
  assert.deepEqual(db.products.map((product) => product.stock), [10, 10, 10]);
  assert.equal(db.customers[0].totalBilled, undefined);

  const preview = await post('/api/pricing/preview', request);
  assert.equal(preview.status, 200);
  const { totals } = await preview.json();
  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) =>
    [gstPercent, discount, taxable, tax]), [[5, 10, 90, 4.5], [12, 20, 180, 21.6], [18, 30, 270, 48.6]]);
  assert.equal(totals.cgst, 37.35);
  assert.equal(totals.sgst, 37.35);
  assert.equal(totals.total, 614.7);

  const created = await post('/api/orders', request);
  assert.equal(created.status, 201);
  const order = await created.json();
  assert.deepEqual(db.orders, [order]);
  assert.equal(write.mock.callCount(), 1);
  assert.deepEqual(db.products.map((product) => product.stock), [9, 9, 9]);
  assert.equal(db.customers[0].totalBilled, 614.7);
  assert.equal(db.customers[0].balance, 614.7);
  assert.equal(order.coupon, 'SAVE10');
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [600, 60, 74.7, 614.7]);
  assert.deepEqual(order.items.map(({ hsn, gstRate }) => [hsn, gstRate]),
    [['1006', undefined], ['0405', undefined], ['0902', undefined]]);

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, { subtotal: 600, discount: 60, tax: 74.7, cgst: 37.35, sgst: 37.35, total: 614.7 });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 4.5], [12, 21.6], [18, 48.6]]);

  const printed = await fetch(baseUrl + '/orders/1001/invoice');
  assert.equal(printed.status, 200);
  const html = await printed.text();
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*74\.70<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*614\.70<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const reconciliation = await fetch(baseUrl + '/api/reports/gst-reconciliation');
  assert.equal(reconciliation.status, 200);
  assert.deepEqual(await reconciliation.json(), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001, date: order.date, customer: 'Credit Customer', coupon: 'SAVE10',
      ledgerSubtotal: 600, ledgerDiscount: 60, ledgerTax: 74.7, ledgerTotal: 614.7,
      invoiceDiscount: 60, invoiceTax: 74.7, invoiceTotal: 614.7, delta: 0, matched: true
    }]
  });
});

test('invoice and billing agree for one default-rate item without a coupon', () => {
  const items = [{ name: 'Tea', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 1, items, ...billed };
  const { subtotal, discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual([subtotal, discount, tax, cgst, sgst, total], [100, 0, 18, 9, 9, 118]);
  assert.deepEqual([billed.tax, billed.total], [18, 118]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice honors the SAVE10 cap', () => {
  const items = [{ name: 'Tea', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10', ...billed });
  assert.deepEqual([billed.discount, billed.tax, billed.total], [150, 333, 2183]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
  assert.equal(printed.rows[0].lineTax, 333);
});

test('valid flat coupons reduce taxable value on the invoice', () => {
  const items = [{ name: 'Tea', price: 300, qty: 1 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50', ...billed });
  assert.deepEqual([billed.discount, billed.tax, billed.total], [50, 45, 295]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 45, 295]);
  assert.equal(printed.rows[0].lineTax, 45);
});

test('invoice fallback applies the checkout minimum for a flat coupon', () => {
  const items = [{ name: 'Tea', price: 40, qty: 1 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });
  assert.deepEqual([billed.discount, billed.tax, billed.total], [0, 7.2, 47.2]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [0, 7.2, 47.2]);
});

test('invoice uses the checkout interpretation of numeric GST overrides, including zero', () => {
  const items = [0, 0.05, 5].map((gstRate) => ({ name: 'Item', price: 100, qty: 1, gstRate }));
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, ...billed });
  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[0, 0], [5, 5], [5, 5]]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[0, 0], [5, 5], [5, 5]]);
  assert.deepEqual([billed.tax, billed.total], [10, 310]);
  assert.deepEqual([printed.tax, printed.total], [10, 310]);
});

test('invoice uses checkout line rounding and GST split', () => {
  const items = [{ name: 'A', price: 0.03, qty: 1 }, { name: 'B', price: 0.03, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 1, items, ...billed };
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(billed.lines.map((line) => line.tax), [0.01, 0.01]);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('GST Audit shows the printed historical amounts and flags the difference from checkout pricing', () => {
  const order = {
    id: 1, subtotal: 100, discount: 5, tax: 17, total: 112,
    items: [{ name: 'Legacy item', price: 100, qty: 1 }]
  };
  const html = invoice.render(order);
  assert.match(html, /Coupon Discount \(\)<\/td><td[^>]*>[^<]*5\.00<\/td>/);
  assert.match(html, /Total GST\)<\/td><td[^>]*>[^<]*17\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>[^<]*112\.00<\/td>/);

  const result = reports.getGstReconciliation({ orders: [order] });
  const [row] = result.rows;
  assert.deepEqual([row.invoiceDiscount, row.invoiceTax, row.invoiceTotal], [5, 17, 112]);
  assert.deepEqual([row.matched, row.delta, result.mismatchCount, result.totalDelta], [false, 6, 1, 6]);
});

test('historical invoice displays recorded GST and flags a GST-only difference in its rows', () => {
  const order = {
    id: 1, subtotal: 100, discount: 0, tax: 17, total: 118,
    items: [{ name: 'Legacy item', price: 100, qty: 1 }]
  };
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [1, 1, 0]);
  const [row] = result.rows;
  assert.deepEqual([row.ledgerTax, row.invoiceTax, row.delta, row.matched], [17, 17, 0, false]);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*17\.00<\/td>/);
  assert.match(html, /Accountant Reconciliation Notice:<\/strong> Recalculated line GST adds up to ₹18\.00, while recorded GST is ₹17\.00/);
});

test('historical invoice displays the recorded total and flags a different recalculated total', () => {
  const order = {
    id: 1, subtotal: 100, discount: 0, tax: 18, total: 117,
    items: [{ name: 'Legacy item', price: 100, qty: 1 }]
  };
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*117\.00<\/td>/);
  assert.match(html, /Accountant Reconciliation Notice:<\/strong> Recalculated total \(₹118\.00\) differs from recorded total \(₹117\.00\)/);
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 1);
});

test('historical invoice flags offsetting subtotal and discount differences', () => {
  const order = {
    id: 1, subtotal: 100, discount: 10, tax: 0, total: 90,
    items: [{ name: 'Legacy item', price: 90, qty: 1, gstRate: 0 }]
  };
  assert.match(invoice.render(order), /Recalculated subtotal and discount are ₹90\.00 and ₹0\.00, while recorded amounts are ₹100\.00 and ₹10\.00/);
});
