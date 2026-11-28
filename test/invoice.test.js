const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [], customers: [{ id: 1, name: 'Test Customer' }] };
  const billed = pricing.computeTotals(items, coupon);
  const charge = ledger.chargeOrderToKhata(db, 1, billed.total);
  assert.equal(charge.ok, true);
  const order = orders.add(db, {
    ...billed,
    date: '2024-01-01',
    customer: charge.customer.name,
    customerId: 1,
    paymentMode: 'khata',
    items,
    coupon
  });
  return { billed, order: orders.get(db, order.id), charged: charge.customer.totalBilled };
}

test('printed invoice matches the order and khata charge for mixed GST slabs with a capped coupon', () => {
  const { order, charged } = billOrder([
    { name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 500, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(charged, 2035);
  assert.equal(figures.total, charged);
  assert.deepEqual([figures.discount, figures.tax], [150, 185]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [46.25, 55.5, 83.25]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹2035\.00<\/td>/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice and billing agree for an undiscounted order at the default GST rate', () => {
  const { billed, order, charged } = billOrder([{ name: 'Item', price: 50, qty: 2 }]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([billed.subtotal, billed.tax, billed.cgst, billed.sgst, charged], [100, 18, 9, 9, 118]);
  assert.deepEqual([figures.subtotal, figures.tax, figures.cgst, figures.sgst, figures.total], [100, 18, 9, 9, 118]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice resolves the HSN slab for each line in a mixed-slab order', () => {
  const { billed, order, charged } = billOrder([
    { name: 'Rice', hsn: '1006', price: 50, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[5, 5], [12, 24], [18, 18]]);
  assert.deepEqual([order.subtotal, order.tax, billed.cgst, billed.sgst, order.total, charged], [400, 47, 23.5, 23.5, 447, 447]);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => [row.hsn, row.gstPercent, row.lineTax]), [
    ['1006', 5, 5], ['0405', 12, 24], ['0902', 18, 18]
  ]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [47, 23.5, 23.5, 447]);

  const html = invoice.render(order);
  assert.match(html, /<td>1006<\/td>.*?<td class="r">5%<\/td><td class="r">₹5\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹47\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹447\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice honors whole-percent, decimal, and zero GST overrides', () => {
  const { billed, order } = billOrder([
    { name: 'Whole percent', price: 100, qty: 1, gstRate: 12 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.12 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[12, 12], [12, 12], [0, 0]]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[12, 12], [12, 12], [0, 0]]);
  assert.deepEqual([order.tax, order.total, figures.tax, figures.total], [24, 324, 24, 324]);
});

test('invoice applies the SAVE10 cap before calculating GST', () => {
  const { order, charged } = billOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  assert.deepEqual([order.discount, order.tax, order.total, charged], [150, 333, 2183, 2183]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
});

test('invoice apportions a flat coupon across lines before calculating GST', () => {
  const { billed, order } = billOrder([
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 },
    { name: 'Coffee', hsn: '0901', price: 300, qty: 1 }
  ], 'FLAT50');
  assert.deepEqual(billed.lines.map(line => [line.discount, line.taxable, line.tax]), [[12.5, 87.5, 15.75], [37.5, 262.5, 47.25]]);
  assert.deepEqual([order.discount, order.tax, order.total], [50, 63, 413]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [15.75, 47.25]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 63, 413]);
});

test('a stored expired coupon code gives no invoice discount', () => {
  const { order } = billOrder([{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures({ ...order, coupon: 'DIWALI20' });
  assert.deepEqual([order.discount, order.tax, order.total], [0, 180, 1180]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 180, 1180]);
});

test('invoice totals GST from rounded line GST amounts', () => {
  const { billed, order } = billOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  assert.deepEqual(billed.lines.map(line => line.tax), [0.01, 0.01]);
  assert.deepEqual([order.tax, billed.cgst, billed.sgst, order.total], [0.02, 0.01, 0.01, 0.08]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});
