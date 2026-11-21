const assert = require('node:assert/strict');
const { test } = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const store = require('../lib/store');
const orderRoutes = require('../routes/orders');

test('printed total and GST breakdown match the recorded charge for a discounted mixed-HSN order', () => {
  const order = {
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

  const { rows, ...summary } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ ...summary, gstLines: rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]) }, {
    subtotal: 2000,
    discount: 150,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    total: 2007.25,
    lineTaxesMatch: true,
    gstLines: [[5, 46.25], [12, 111]]
  });
});

test('the invoice prints the same HSN rates and capped SAVE10 discount used for Khata billing', async (t) => {
  const db = {
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, stock: 10 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, stock: 10 }
    ],
    customers: [{ id: 1, name: 'Meera', creditLimit: 5000 }],
    nextOrderId: 1001,
    orders: []
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});

  const request = {
    method: 'POST',
    url: '/orders',
    body: {
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }],
      coupon: ' save10 ',
      customerId: 1,
      paymentMode: 'khata'
    }
  };
  const { status, order } = await new Promise((resolve, reject) => {
    orderRoutes(request, {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, order: body });
      }
    }, (error) => reject(error || new Error('Order route did not send a response')));
  });
  assert.equal(status, 201);
  assert.deepEqual(order.items, [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ]);
  assert.equal(order.coupon, 'SAVE10');
  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 157.25);
  assert.equal(order.total, 2007.25);
  assert.equal(db.customers[0].totalBilled, 2007.25);
  assert.deepEqual(db.orders, [order]);
  assert.equal(write.mock.callCount(), 1);
  assert.equal(write.mock.calls[0].arguments[0], db);

  const totals = pricing.computeTotals(order.items, order.coupon);
  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) => ({
    gstPercent, discount, taxable, tax
  })), [
    { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
    { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
  ]);
  assert.deepEqual([totals.cgst, totals.sgst], [78.63, 78.62]);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 2000,
    discount: 150,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    total: 2007.25,
    lineTaxesMatch: true,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 46.25 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000, gstPercent: 12, line: 1000, lineTax: 111 }
    ]
  });

  const html = invoice.render(db.orders[0]);
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td class="r">12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td>[^>]+>-₹150\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice and checkout agree on an undiscounted 18% HSN line', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items);
  const order = { ...billed, items };
  const { subtotal, discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal, discount, tax, cgst, sgst, total }, {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236
  });
  assert.equal(billed.total, 236);
  assert.equal(billed.tax, 36);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a flat coupon reduces the taxable value on the invoice', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }];
  const coupon = 'FLAT50';
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items, coupon });

  assert.deepEqual([billed.discount, billed.taxable, billed.tax, billed.total], [50, 250, 45, 295]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 45, 295]);
});

test('invoice fallback ignores below-minimum and inactive coupons when no discount was recorded', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 40, qty: 1 }];

  for (const coupon of ['FLAT50', 'DIWALI20']) {
    const billed = pricing.computeTotals(items, coupon);
    const printed = invoice.computeInvoiceFigures({ items, coupon });

    assert.deepEqual([billed.discount, billed.tax, billed.total], [0, 7.2, 47.2], coupon);
    assert.deepEqual([printed.discount, printed.tax, printed.total], [0, 7.2, 47.2], coupon);
  }
});

test('invoice honors explicit whole, zero, and decimal GST rates like checkout', () => {
  const cases = [
    { gstRate: 5, billedTax: 5, shownPercent: 5, shownTax: 5 },
    { gstRate: 0, billedTax: 0, shownPercent: 0, shownTax: 0 },
    { gstRate: 0.05, billedTax: 5, shownPercent: 5, shownTax: 5 }
  ];

  for (const { gstRate, billedTax, shownPercent, shownTax } of cases) {
    const items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate }];
    const billed = pricing.computeTotals(items);
    const printed = invoice.computeInvoiceFigures({ items });

    assert.equal(billed.tax, billedTax, 'gstRate: ' + gstRate);
    assert.deepEqual([printed.rows[0].gstPercent, printed.rows[0].lineTax, printed.tax],
      [shownPercent, shownTax, shownTax], 'gstRate: ' + gstRate);
  }
});

test('invoice GST is the sum of the rounded line taxes', () => {
  const items = [
    { name: 'Line A', price: 0.03, qty: 1 },
    { name: 'Line B', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const order = { ...billed, items };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map((line) => line.tax), [0.01, 0.01]);
  assert.deepEqual(printed.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹0\.08<\/td>/);
});

test('reconciliation matches GST and total for an uncapped percentage coupon', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const order = { ...billed, id: 1001, date: '2021-11-15', items, coupon };

  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '2021-11-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 500,
      ledgerDiscount: 50,
      ledgerTax: 81,
      ledgerTotal: 531,
      invoiceDiscount: 50,
      invoiceTax: 81,
      invoiceTotal: 531,
      delta: 0,
      matched: true
    }]
  });
  const html = invoice.render(order);
  assert.match(html, /Total GST\)<\/td><td class="r">₹81\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹531\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('an invoice reprint uses the recorded discount after a coupon expires', () => {
  const order = {
    items: [{ name: 'Tea', hsn: '0902', price: 1200, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1200,
    discount: 240,
    tax: 172.8,
    total: 1132.8
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(printed.discount, 240);
  assert.equal(printed.rows[0].lineTax, 172.8);
  assert.equal(printed.total, 1132.8);
});

test('older invoices show recorded totals when line GST cannot be reconstructed', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [18, 9, 9, 118]);
  assert.deepEqual([printed.rows[0].gstPercent, printed.rows[0].lineTax], [null, null]);
  assert.match(invoice.render(order), /<td class="r">—<\/td><td class="r">—<\/td>/);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.rows[0].matched, false);
});
