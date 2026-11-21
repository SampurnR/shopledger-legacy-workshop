const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');
const store = require('../lib/store');
const orderRouter = require('../routes/orders');

test('invoice matches the billed total and line GST on a mixed-rate discounted order', () => {
  const order = {
    items: [
      { name: 'Rice', hsn: '1006', price: 400, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
    ],
    coupon: 'FLAT50', subtotal: 500, discount: 50, tax: 28.8, total: 478.8
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.total, order.total);
  assert.equal(printed.tax, order.tax);
  assert.equal(printed.cgst, 14.4);
  assert.equal(printed.sgst, 14.4);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 18], [12, 10.8]
  ]);
});

test('checkout apportions a flat coupon across 5%, 12% and 18% GST lines', () => {
  const bill = pricing.computeTotals([
    { name: 'Rice', hsn: '1006', price: 50, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 200, qty: 1 }
  ], 'FLAT50');

  assert.deepEqual(bill.lines.map(line => [line.discount, line.taxable, line.tax]), [
    [10, 90, 4.5], [20, 180, 21.6], [20, 180, 32.4]
  ]);
  assert.equal(bill.discount, 50);
  assert.equal(bill.tax, 58.5);
  assert.equal(bill.cgst, 29.25);
  assert.equal(bill.sgst, 29.25);
  assert.equal(bill.total, 508.5);
});

test('a placed rice order prints the billed 5% GST and welcome discount', t => {
  const db = {
    nextOrderId: 1, orders: [],
    products: [{ id: 1, name: 'Rice', sku: 'R1', hsn: '1006', price: 640, stock: 4 }]
  };
  t.mock.method(store, 'read', () => db);
  t.mock.method(store, 'write', () => {});
  const request = {
    method: 'POST', url: '/orders',
    body: { items: [{ id: 1, qty: 1 }], coupon: 'WELCOME' }
  };
  const response = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }
  };
  orderRouter.handle(request, response, assert.fail);
  assert.equal(response.statusCode, 201);
  const order = db.orders[0];
  assert.equal(order.items[0].hsn, '1006');
  assert.equal(order.items[0].gstRate, undefined);
  assert.equal(order.discount, 32);
  assert.equal(order.tax, 30.4);
  assert.equal(order.total, 638.4);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 30.4);
  assert.equal(figures.cgst, 15.2);
  assert.equal(figures.sgst, 15.2);
  assert.equal(figures.discount, 32);
  assert.equal(figures.total, 638.4);

  const printed = invoice.render(order);
  assert.match(printed, /Total GST\).*?₹30\.40/);
  assert.match(printed, /Invoice Total<.*?₹638\.40/);
  assert.doesNotMatch(printed, /Accountant Reconciliation Notice/);
});

test('the invoice applies the SAVE10 cap on a ₹2,000 order', () => {
  const items = [{ hsn: '0902', price: 1000, qty: 2 }];
  const bill = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });
  assert.equal(bill.discount, 150);
  assert.equal(bill.tax, 333);
  assert.equal(bill.total, 2183);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 333);
  assert.equal(printed.total, 2183);
});

test('reconciliation matches both GST and total on a discounted tea order', () => {
  const items = [{ hsn: '0902', price: 500, qty: 1 }];
  const bill = pricing.computeTotals(items, 'SAVE10');
  const order = { ...bill, items, coupon: 'SAVE10' };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(bill.tax, 81);
  assert.equal(printed.tax, 81);
  assert.equal(bill.total, 531);
  assert.equal(printed.total, 531);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.totalDelta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('an explicit 5% rate with no coupon gives matching totals and splits an odd paise', () => {
  const items = [{ gstRate: 5, price: 0.60, qty: 1 }];
  const bill = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items });
  for (const figures of [bill, printed]) {
    assert.equal(figures.tax, 0.03);
    assert.equal(figures.cgst, 0.02);
    assert.equal(figures.sgst, 0.01);
    assert.equal(figures.total, 0.63);
  }
});

test('reprinting a saved order preserves the billed discount after its coupon is retired', () => {
  const order = {
    items: [{ hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'RETIRED', discount: 100, tax: 45, total: 945
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 100);
  assert.equal(printed.rows[0].lineTax, 45);
  assert.equal(printed.total, 945);
});
