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

test('invoice uses the billed HSN rates and apportions a flat coupon before GST', () => {
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
    subtotal: 300, discount: 50, tax: 18.33, cgst: 9.17, sgst: 9.16, total: 268.33
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) =>
    ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 8.33 },
    { hsn: '0405', gstPercent: 12, lineTax: 10 }
  ]);
});

test('invoice applies the capped percentage coupon before GST', () => {
  const { order } = billOrder([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.total, 2183);
});

test('invoice uses the billing interpretation of explicit decimal and zero GST rates', () => {
  const { billed, order } = billOrder([
    { name: 'Decimal rate item', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate item', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [
    [5, 5], [0, 0]
  ]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5], [0, 0]
  ]);
  assert.equal(order.total, 205);
  assert.equal(figures.total, 205);
});

test('invoice sums rounded line GST the same way as billing', () => {
  const { order } = billOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
});

test('printed invoice matches the recorded charge and GST on a discounted mixed-rate order', () => {
  const { order } = billOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ], 'FLAT50');

  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹268\.33/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹18\.33/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice preserves recorded amounts on an order with an expired coupon', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  });

  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.discount, 200);
  assert.equal(figures.tax, 144);
  assert.equal(figures.total, 944);
  assert.equal(figures.cgst, 72);
  assert.equal(figures.sgst, 72);
  assert.equal(figures.rows[0].lineTax, 144);
});

test('printed invoice flags line GST that differs from recorded GST', () => {
  const html = invoice.render({
    items: [{ name: 'Ghee', hsn: '0405', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  });

  assert.match(html, /Recalculated line GST \(₹12\.00\) differs from recorded GST \(₹5\.00\)/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
});

test('printed invoice flags a recorded total that differs from the displayed amounts', () => {
  const { order } = billOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  order.total = 117;

  const html = invoice.render(order);
  assert.match(html, /Subtotal less discount plus GST \(₹118\.00\) differs from recorded total \(₹117\.00\)/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹117\.00/);
});

test('invoice derives missing GST and total using the recorded discount', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200
  });

  assert.equal(figures.rows[0].lineTax, 144);
  assert.equal(figures.tax, 144);
  assert.equal(figures.total, 944);
});
