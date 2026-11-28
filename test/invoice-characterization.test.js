const assert = require('node:assert/strict');
const { test } = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

const rice = { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 1000, qty: 1 };
const ghee = { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 };
const coffee = { id: 3, sku: 'COFFEE', name: 'Coffee', hsn: '0901', price: 100, qty: 1 };

function makeOrder(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  return orders.add({ nextOrderId: 1001, orders: [] }, {
    date: '15/03/2022',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('checkout caps SAVE10 and applies each HSN rate after allocating the discount', () => {
  const totals = pricing.computeTotals([rice, ghee], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    total: 2007.25,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 1000, discount: 75,
        taxable: 925, tax: 46.25, net: 971.25 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 1000, discount: 75,
        taxable: 925, tax: 111, net: 1036 }
    ]
  });
});

test('invoice and checkout agree for an undiscounted 18% HSN item', () => {
  const order = makeOrder([coffee]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 118);
  assert.equal(order.tax, 18);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.doesNotMatch(invoice.render(order), /Line GST breakdown unavailable/);
});

test('invoice uses the saved discount even when the coupon is unavailable', () => {
  const order = {
    ...makeOrder([coffee]),
    coupon: 'RETIRED',
    discount: 10,
    tax: 16.2,
    total: 106.2
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 10);
  assert.equal(figures.rows[0].lineTax, 16.2);
  assert.equal(figures.total, 106.2);
  const [line] = invoice.reconstructFigures(order).lines;
  assert.deepEqual([line.discount, line.taxable, line.tax, line.net], [10, 90, 16.2, 106.2]);
});

test('invoice HTML prints billed GST and total along with the discounted line GST', () => {
  const html = invoice.render(makeOrder([rice, ghee], 'SAVE10'));

  assert.match(html, />5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, />12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, />CGST<\/td><td class="r">₹78\.63/);
  assert.match(html, />SGST<\/td><td class="r">₹78\.62/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Line GST breakdown unavailable/);
});

test('invoice interprets fractional and zero GST rates like checkout', () => {
  const order = makeOrder([{ ...rice, gstRate: 0.05 }, { ...ghee, gstRate: 0 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 50], [0, 0]
  ]);
  assert.equal(figures.tax, 50);
});

test('invoice preserves the sum of rounded line GST as billed', () => {
  const order = makeOrder([
    { ...coffee, price: 0.03 },
    { ...coffee, id: 4, price: 0.03 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.08);
});

test('historical invoice preserves billed GST when its line breakdown cannot be reconstructed', () => {
  const order = { ...makeOrder([coffee]), tax: 17, total: 117 };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(figures.tax, 17);
  assert.equal(figures.total, 117);
  assert.equal(figures.rows[0].gstPercent, null);
  assert.equal(figures.rows[0].lineTax, null);
  assert.match(html, /Line GST breakdown unavailable/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹117\.00/);
});

test('reconciliation detects historical discrepancies independently and excludes cancelled orders', () => {
  const matching = makeOrder([coffee]);
  const mixed = { ...makeOrder([rice, ghee], 'SAVE10'), id: 1002 };
  const historical = { ...matching, id: 1003, tax: 17, total: 117 };
  const cancelled = { ...historical, id: 1004, status: 'cancelled' };

  const result = reports.getGstReconciliation({ orders: [matching, mixed, historical, cancelled] });

  assert.equal(result.totalChecked, 3);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 1);
  assert.deepEqual(result.rows.map(({ orderId, invoiceTax, invoiceTotal, matched }) =>
    ({ orderId, invoiceTax, invoiceTotal, matched })), [
    { orderId: 1001, invoiceTax: 18, invoiceTotal: 118, matched: true },
    { orderId: 1002, invoiceTax: 157.25, invoiceTotal: 2007.25, matched: true },
    { orderId: 1003, invoiceTax: 18, invoiceTotal: 118, matched: false }
  ]);
});

test('invoice agrees with the billed total and discounted HSN GST breakdown', () => {
  const order = makeOrder([rice, ghee], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [figures.total, figures.tax, figures.cgst, figures.sgst],
    [2007.25, 157.25, 78.63, 78.62]
  );
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 46.25], [12, 111]
  ]);
});

test('invoice shows the billed total and warns when only the reconstructed total differs', () => {
  const html = invoice.render({ ...makeOrder([coffee]), total: 117 });

  assert.match(html, /Invoice Total<\/td><td class="r">₹117\.00/);
  assert.match(html, /differs from the total reconstructed from the line items \(₹118\.00\)/);
  assert.doesNotMatch(html, /Line GST breakdown unavailable/);
});
