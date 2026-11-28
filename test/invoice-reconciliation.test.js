const assert = require('node:assert/strict');
const { test } = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const store = require('../lib/store');
const app = require('../server');

test('invoice shows the billed total and post-discount GST for a capped rice order', () => {
  const order = {
    id: 1009,
    items: [{ name: 'Rice', hsn: '1006', price: 640, qty: 3 }],
    coupon: 'SAVE10',
    subtotal: 1920, discount: 150, tax: 88.5, total: 1858.5
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual({
    total: figures.total, tax: figures.tax, discount: figures.discount,
    cgst: figures.cgst, sgst: figures.sgst,
    rate: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax
  }, {
    total: 1858.5, tax: 88.5, discount: 150,
    cgst: 44.25, sgst: 44.25, rate: 5, lineTax: 88.5
  });
});

test('checkout, khata and the printable invoice agree for mixed GST slabs and a capped coupon', async (t) => {
  const db = {
    products: [
      { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, stock: 10 },
      { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 500, stock: 10 }
    ],
    customers: [{ id: 1, name: 'Asha', creditLimit: 5000 }],
    orders: [],
    nextOrderId: 1001
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', (value) => assert.equal(value, db));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }],
      coupon: ' save10 ',
      paymentMode: 'khata',
      customerId: 1
    })
  };

  const previewResponse = await fetch(`${baseUrl}/api/pricing/preview`, request);
  assert.equal(previewResponse.status, 200);
  const { totals, couponStatus } = await previewResponse.json();
  assert.equal(couponStatus.code, 'SAVE10');
  assert.deepEqual(totals, {
    subtotal: 2500, discount: 150, taxable: 2350, tax: 150.4,
    cgst: 75.2, sgst: 75.2, total: 2500.4,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 2000, discount: 120, taxable: 1880, tax: 94, net: 1974 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 500, discount: 30, taxable: 470, tax: 56.4, net: 526.4 }
    ]
  });

  const orderResponse = await fetch(`${baseUrl}/api/orders`, request);
  assert.equal(orderResponse.status, 201);
  const order = await orderResponse.json();
  const { id, subtotal, discount, tax, total } = order;
  assert.deepEqual({ id, subtotal, discount, tax, total }, {
    id: 1001, subtotal: 2500, discount: 150, tax: 150.4, total: 2500.4
  });
  assert.deepEqual(db.orders, [order]);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(db.customers[0].totalBilled, 2500.4);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 2500, discount: 150, tax: 150.4, cgst: 75.2, sgst: 75.2, total: 2500.4,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 1000, gstPercent: 5, line: 2000, lineTax: 94 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 500, gstPercent: 12, line: 500, lineTax: 56.4 }
    ]
  });

  const invoiceResponse = await fetch(`${baseUrl}/orders/${id}/invoice`);
  assert.equal(invoiceResponse.status, 200);
  const html = await invoiceResponse.text();
  assert.ok(html.includes('5%</td><td class="r">₹94.00</td>'));
  assert.ok(html.includes('12%</td><td class="r">₹56.40</td>'));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹150.40</td>'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2500.40</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const reportResponse = await fetch(`${baseUrl}/api/reports/gst-reconciliation`);
  assert.equal(reportResponse.status, 200);
  assert.deepEqual(await reportResponse.json(), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: order.date, customer: 'Asha', coupon: 'SAVE10',
      ledgerSubtotal: 2500, ledgerDiscount: 150, ledgerTax: 150.4, ledgerTotal: 2500.4,
      invoiceDiscount: 150, invoiceTax: 150.4, invoiceTotal: 2500.4, delta: 0, matched: true
    }]
  });
});

test('an undiscounted default-rate order matches the printable invoice', () => {
  const items = [{ name: 'Item', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items);
  const order = { id: 1, items, ...billed };
  const { subtotal, discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ subtotal, discount, tax, cgst, sgst, total }, {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('a flat coupon reduces taxable value at checkout and on the invoice', () => {
  const items = [{ name: 'Item', price: 300, qty: 1 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const order = { id: 1, items, coupon: 'FLAT50', ...billed };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.discount, billed.tax, billed.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('the invoice uses checkout GST rates for decimal, zero and whole-percent overrides', () => {
  const items = [
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 },
    { name: 'Whole percent', price: 100, qty: 1, gstRate: 12 }
  ];
  const billed = pricing.computeTotals(items);
  const figures = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map((line) => [line.gstPercent, line.tax]), [[5, 5], [0, 0], [12, 12]]);
  assert.deepEqual(figures.rows.map((row) => [row.gstPercent, row.lineTax]), [[5, 5], [0, 0], [12, 12]]);
  assert.deepEqual([billed.total, figures.total], [317, 317]);
});

test('invoice GST totals sum the rounded line amounts used at checkout', () => {
  const items = [
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const order = { id: 1, items, ...billed };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.total], [0.02, 0.08]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: a GST-only mismatch appears in reconciliation but triggers no invoice notice', () => {
  const order = {
    id: 1, items: [{ name: 'Item', price: 100, qty: 1 }],
    subtotal: 100, discount: 0, tax: 17, total: 118
  };
  const report = reports.getGstReconciliation({ orders: [order] });

  assert.equal(report.rows[0].invoiceTax, 18);
  assert.equal(report.rows[0].matched, false);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
