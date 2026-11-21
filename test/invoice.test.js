const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const orders = require('../lib/orders');
const invoice = require('../lib/invoice');

function bill(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1, orders: [] };
  const order = orders.add(db, { ...billed, items, coupon, date: '2021-11-01' });
  return { billed, order, printed: invoice.computeInvoiceFigures(order) };
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('Unknown HSN without a coupon uses 18% in checkout and on the invoice', () => {
  const { billed, order, printed } = bill([{ hsn: '9999', price: 25, qty: 2 }]);
  const expected = { subtotal: 50, discount: 0, tax: 9, cgst: 4.5, sgst: 4.5, total: 59 };
  assert.deepEqual(amounts(billed), expected);
  assert.deepEqual(amounts(printed), expected);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('A mixed HSN invoice with FLAT50 prints the billed total and discounted GST for each slab', () => {
  const { billed, order, printed } = bill([
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Butter', sku: 'B', hsn: '0405', price: 300, qty: 1 }
  ], 'FLAT50');
  assert.deepEqual(billed.lines, [
    { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 200, discount: 20, taxable: 180, tax: 9, net: 189 },
    { id: 2, name: 'Butter', hsn: '0405', gstPercent: 12, gross: 300, discount: 30, taxable: 270, tax: 32.4, net: 302.4 }
  ]);
  assert.deepEqual(amounts(billed), { subtotal: 500, discount: 50, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4 });
  assert.equal(order.total, 491.4);
  assert.equal(printed.total, order.total);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 9], [12, 32.4]]);
  assert.deepEqual(amounts(printed), amounts(billed));
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹41\.40/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹491\.40/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('SAVE10 invoice matches both the billed discount and GST', () => {
  const { billed, order, printed } = bill([{ hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  assert.deepEqual(amounts(billed), { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 });
  assert.deepEqual(amounts(printed), amounts(billed));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('SAVE10 invoice applies the checkout discount cap before GST', () => {
  const { billed, order, printed } = bill([{ hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  assert.deepEqual(amounts(billed), { subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183 });
  assert.deepEqual(amounts(printed), amounts(billed));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('Explicit whole-percent GST overrides HSN in both calculations', () => {
  const { billed, printed } = bill([{ hsn: '1006', gstRate: 12, price: 100, qty: 1 }]);
  const expected = { subtotal: 100, discount: 0, tax: 12, cgst: 6, sgst: 6, total: 112 };
  assert.deepEqual(amounts(billed), expected);
  assert.deepEqual(amounts(printed), expected);
});

test('The invoice preserves decimal GST rates and explicit zero', () => {
  const { billed, printed } = bill([
    { price: 100, qty: 1, gstRate: 0.05 },
    { price: 100, qty: 1, gstRate: 0 }
  ]);
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[5, 5], [0, 0]]);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [0, 0]]);
});

test('Invoice GST sums individually rounded lines at the one-paisa boundary', () => {
  const { billed, printed, order } = bill([
    { price: 0.02, qty: 1 }, { price: 0.02, qty: 1 }
  ]);
  assert.deepEqual(billed.lines.map(line => line.tax), [0, 0]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0, 0]);
  assert.deepEqual(amounts(billed), { subtotal: 0.04, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0.04 });
  assert.deepEqual(amounts(printed), amounts(billed));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
