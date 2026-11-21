const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const store = require('../lib/store');
const orderRoutes = require('../routes/orders');

test('Invoice and checkout agree on default GST without a coupon', () => {
  const items = [{ name: 'Tea', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items);
  const order = { items, total: billed.total };

  assert.equal(billed.total, 236);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Invoice matches the khata charge and applies HSN GST after discount', async (t) => {
  const db = {
    nextOrderId: 1001,
    orders: [],
    customers: [{ id: 1, name: 'Test customer' }],
    products: [
      { id: 1, name: 'Rice', hsn: '1006', price: 300, stock: 10 },
      { id: 2, name: 'Ghee', hsn: '0405', price: 200, stock: 10 }
    ]
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', (saved) => assert.equal(saved, db));

  const request = {
    method: 'POST',
    url: '/orders',
    body: {
      items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }],
      coupon: ' save10 ',
      paymentMode: 'khata',
      customerId: 1
    }
  };
  let status;
  const order = await new Promise((resolve, reject) => {
    const response = {
      status(code) {
        status = code;
        return this;
      },
      json: resolve
    };
    orderRoutes.handle(request, response, (error) => {
      reject(error || new Error('Order route did not send a response'));
    });
  });
  assert.equal(status, 201);
  assert.equal(write.mock.callCount(), 1);
  assert.deepEqual(db.orders[0], order);
  assert.equal(order.coupon, 'SAVE10');
  assert.deepEqual(
    [order.subtotal, order.discount, order.tax, order.total, db.customers[0].totalBilled],
    [500, 50, 35.1, 485.1, 485.1]
  );

  const billed = pricing.computeTotals(order.items, order.coupon);
  assert.deepEqual(billed.lines.map(({ gstPercent, taxable, tax }) => [
    gstPercent, taxable, tax
  ]), [[5, 270, 13.5], [12, 180, 21.6]]);
  assert.deepEqual([billed.cgst, billed.sgst], [17.55, 17.55]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [
    gstPercent, lineTax
  ]), [[5, 13.5], [12, 21.6]]);
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [500, 50, 35.1, 17.55, 17.55, 485.1]
  );

  const html = invoice.render(order);
  assert.match(html, /Total GST\)<\/td><td class="r">₹35\.10/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹485\.10/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('Invoice applies the percentage coupon cap', () => {
  const items = [{ name: 'Tea', price: 2000, qty: 1 }];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const order = { items, coupon, total: billed.total };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.discount, billed.tax, billed.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Invoice respects zero, decimal and percentage GST rates', () => {
  const items = [
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal-rate item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Percentage-rate item', price: 100, qty: 1, gstRate: 5 }
  ];
  const billedTax = pricing.computeTotals(items).lines.map(({ tax }) => tax);
  const invoiceTax = invoice.computeInvoiceFigures({ items }).rows.map(({ lineTax }) => lineTax);

  assert.deepEqual(billedTax, [0, 5, 5]);
  assert.deepEqual(invoiceTax, [0, 5, 5]);
});

test('Printed line GST rounds consistently with checkout and invoice GST', () => {
  const items = [
    { name: 'First low-value item', price: 0.03, qty: 1 },
    { name: 'Second low-value item', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const figures = invoice.computeInvoiceFigures({ items });

  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('Printable invoice shows the recorded total and GST for a discounted mixed-rate order', () => {
  const order = {
    id: 1001,
    coupon: 'SAVE10',
    subtotal: 500,
    discount: 50,
    tax: 35.1,
    total: 485.1,
    items: [
      { name: 'Rice', hsn: '1006', price: 300, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
    ]
  };

  const html = invoice.render(order);
  assert.equal(html.match(/Invoice Total<\/td><td class="r">₹([\d.]+)/)?.[1], '485.10');
  assert.equal(html.match(/Total GST\)<\/td><td class="r">₹([\d.]+)/)?.[1], '35.10');
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('Issue #1: invoice matches the ledger figures for a ₹1,020 order at 5% GST with SAVE10', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [{ name: 'Rice', hsn: '1006', price: 1020, qty: 1 }]
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 45.9);
});

test('Invoice preserves GST percentages stored as strings on legacy order lines', () => {
  const items = [
    { name: 'Five percent item', price: 100, qty: 1, gstRate: '5' },
    { name: 'One percent item', price: 100, qty: 1, gstRate: '1' }
  ];
  const order = { items, total: 206 };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [
    gstPercent, lineTax
  ]), [[5, 5], [1, 1]]);
  assert.equal(figures.total, 206);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
