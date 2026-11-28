const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billOrder(items, coupon = '') {
  const db = {
    nextOrderId: 1,
    orders: [],
    customers: [{ id: 1, name: 'Test Customer', totalBilled: 0 }]
  };
  const billed = pricing.computeTotals(items, coupon);
  const charge = ledger.chargeOrderToKhata(db, 1, billed.total);
  assert.equal(charge.ok, true);

  const order = orders.add(db, {
    ...billed,
    items,
    coupon,
    customerId: 1,
    paymentMode: 'khata',
    date: '2021-11-15'
  });

  return { billed, order, charged: charge.customer.totalBilled };
}

test('invoice and billed totals agree for a whole-rupee default-rate sale without a coupon', () => {
  const { order, charged } = billOrder([{ name: 'Tea', price: 50, qty: 2 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(charged, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: mixed HSN slabs and a flat coupon produce different billed and printed totals', () => {
  const { billed, order, charged } = billOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ], 'FLAT50');

  assert.deepEqual(billed.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 33.33, taxable: 166.67, tax: 8.33 },
    { gstPercent: 12, discount: 16.67, taxable: 83.33, tax: 10 }
  ]);
  assert.equal(order.subtotal, 300);
  assert.equal(order.discount, 50);
  assert.equal(order.tax, 18.33);
  assert.equal(order.total, 268.33);
  assert.equal(charged, 268.33);
  assert.equal(billed.cgst, 9.17);
  assert.equal(billed.sgst, 9.16);

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 300, discount: 50, tax: 54, cgst: 27, sgst: 27, total: 304
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) =>
    ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 18, lineTax: 36 },
    { hsn: '0405', gstPercent: 18, lineTax: 18 }
  ]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹54\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹304\.00/);
  assert.match(html, /Invoice computed total \(₹304\.00\) differs from Order Ledger recorded total \(₹268\.33\) by \+₹35\.67\./);
});

test('CURRENT BEHAVIOUR: invoice applies the percentage coupon after GST and ignores its cap', () => {
  const { order } = billOrder([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.equal(figures.discount, 236);
  assert.equal(figures.tax, 360);
  assert.equal(figures.total, 2124);
  assert.match(invoice.render(order), /recorded total \(₹2183\.00\) by -₹59\.00\./);
});

test('CURRENT BEHAVIOUR: invoice and billing interpret explicit decimal and zero GST rates differently', () => {
  const { billed, order } = billOrder([
    { name: 'Decimal rate item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate item', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [
    [5, 5], [0, 0]
  ]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [0, 0.05], [18, 18]
  ]);
  assert.equal(order.total, 205);
  assert.equal(figures.total, 218.05);
});

test('CURRENT BEHAVIOUR: rounded invoice line taxes can sum to more than the printed GST', () => {
  const { order } = billOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.01);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0);
  assert.equal(figures.total, 0.07);
  assert.match(invoice.render(order), /recorded total \(₹0\.08\) by -₹0\.01\./);
});
