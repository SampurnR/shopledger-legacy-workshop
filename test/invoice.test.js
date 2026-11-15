const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// Import only calculation modules: no server, store, or persisted database.
function item(overrides) {
  return Object.assign({
    id: 1, sku: 'TEST-001', name: 'Test rice', hsn: '1006', price: 100, qty: 1
  }, overrides);
}

function compare(items, coupon = '') {
  return {
    billed: pricing.computeTotals(items, coupon),
    printed: invoice.computeInvoiceFigures({ items, coupon })
  };
}

test('invoice uses the same HSN GST as billing', () => {
  const { billed, printed } = compare([item()]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [5, 2.5, 2.5, 105]);
  assert.deepEqual(printed, {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105,
    rows: [{ name: 'Test rice', sku: 'TEST-001', hsn: '1006', qty: 1,
      price: 100, gstPercent: 5, line: 100, lineTax: 5 }]
  });
});

test('invoice applies coupons before calculating GST', () => {
  const { billed, printed } = compare([item()], 'WELCOME');
  assert.deepEqual([billed.discount, billed.tax, billed.total], [5, 4.75, 99.75]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [5, 4.75, 99.75]);
  assert.deepEqual([printed.cgst, printed.sgst, printed.rows[0].lineTax], [2.38, 2.37, 4.75]);
});

test('invoice ignores inactive coupons like billing', () => {
  const { billed, printed } = compare([item({ price: 1000 })], 'DIWALI20');
  assert.deepEqual([billed.discount, billed.total], [0, 1050]);
  assert.deepEqual([printed.discount, printed.total], [0, 1050]);
});

test('invoice respects decimal GST rates', () => {
  const { billed, printed } = compare([item({ hsn: '', gstRate: 0.05 })]);
  assert.deepEqual([billed.tax, billed.total], [5, 105]);
  assert.deepEqual([printed.rows[0].gstPercent, printed.tax, printed.total], [5, 5, 105]);
  assert.deepEqual([printed.cgst, printed.sgst], [2.5, 2.5]);
});

test('invoice respects explicit zero GST', () => {
  const { billed, printed } = compare([item({ gstRate: 0 })]);
  assert.deepEqual([billed.tax, billed.total], [0, 100]);
  assert.deepEqual([printed.rows[0].gstPercent, printed.tax, printed.total], [0, 0, 100]);
});

test('CURRENT BEHAVIOUR: whole-percent GST without a coupon agrees with billing', () => {
  const { billed, printed } = compare([item({ gstRate: 5, qty: 2 })]);
  assert.deepEqual([billed.subtotal, billed.tax, billed.total], [200, 10, 210]);
  assert.deepEqual([printed.subtotal, printed.tax, printed.total], [200, 10, 210]);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice preserves mixed HSN slabs on each row', () => {
  const { billed, printed } = compare([
    item(), item({ id: 2, hsn: '0405' }), item({ id: 3, hsn: '0902' })
  ]);
  assert.deepEqual(billed.lines.map(line => line.tax), [5, 12, 18]);
  assert.deepEqual([billed.tax, billed.total], [35, 335]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [5, 12, 18]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [35, 17.5, 17.5, 335]);
});

test('invoice respects coupon minimum subtotal', () => {
  const { billed, printed } = compare([item({ price: 10 })], 'FLAT50');
  assert.deepEqual([billed.discount, billed.total], [0, 10.5]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [0, 0.5, 10.5]);
});

test('invoice respects the percentage coupon discount cap', () => {
  const { billed, printed } = compare([item({ price: 3000 })], 'WELCOME');
  assert.deepEqual([billed.discount, billed.tax, billed.total], [100, 145, 3045]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [100, 145, 3045]);
});

test('invoice normalizes coupon codes like billing', () => {
  const { billed, printed } = compare([item()], ' welcome ');
  assert.deepEqual([billed.discount, billed.total], [5, 99.75]);
  assert.deepEqual([printed.discount, printed.total], [5, 99.75]);
});

test('invoice sums rounded line GST like billing', () => {
  const { billed, printed } = compare([
    item({ price: 0.03, gstRate: 18 }), item({ id: 2, price: 0.03, gstRate: 18 })
  ]);
  assert.deepEqual([billed.tax, billed.total], [0.02, 0.08]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
});

test('rendered invoice matches billed totals without a mismatch notice', () => {
  const items = [item()];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const html = invoice.render(Object.assign({ id: 42, date: '2021-11-01', items, coupon: 'WELCOME' }, billed));
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹4.75</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹99.75</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: rendered reconciliation notice uses the rounded total difference only', () => {
  const order = { id: 42, items: [item()], tax: 0, total: 105 };
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
  assert.ok(!invoice.render({ ...order, total: 105.004 }).includes('Accountant Reconciliation Notice:'));
  assert.ok(invoice.render({ ...order, total: 105.01 }).includes('by -₹0.01.'));
});

test('invoice total and GST breakdown match the billed rice order with WELCOME', () => {
  const { billed, printed } = compare([item({ price: 640 })], 'WELCOME');
  assert.deepEqual(
    [printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total],
    [640, 32, 30.4, 15.2, 15.2, 638.4]
  );
  assert.deepEqual([printed.rows[0].gstPercent, printed.rows[0].lineTax], [5, billed.lines[0].tax]);
});
