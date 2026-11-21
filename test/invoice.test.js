const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// These fixtures are intentionally in memory; tests do not import the store or data/db.json.
function riceOrder(overrides = {}) {
  return {
    id: 42,
    date: '21/11/2026',
    customer: 'Test customer',
    coupon: '',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    ...overrides
  };
}

test('invoice GST breakdown and total match pricing for an HSN-priced order', () => {
  const order = riceOrder();
  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 5);
});

test('invoice matches the billed GST breakdown and total for the reproduced rice order', () => {
  const order = riceOrder({
    subtotal: 640,
    discount: 0,
    tax: 32,
    total: 672,
    items: [{ id: 7, name: 'Indrayani Basmati Rice 5kg', sku: 'RICE-5', hsn: '1006', price: 640, qty: 1 }]
  });

  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, cgst: 16, sgst: 16, total: order.total }
  );
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 32);
});

test('invoice and order use the same percentage coupon calculation', () => {
  const order = riceOrder({
    coupon: 'SAVE10',
    items: [{ id: 1, name: 'Item', hsn: '1006', gstRate: 18, price: 500, qty: 1 }]
  });
  const billed = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.deepEqual({ discount: printed.discount, tax: printed.tax, total: printed.total }, { discount: 50, tax: 81, total: 531 });
});

test('invoice and order interpret decimal gstRate consistently', () => {
  const order = riceOrder({
    items: [{ id: 1, name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }]
  });

  const billed = pricing.computeTotals(order.items, '');
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 5);
});

test('invoice renderer warns when its calculated total differs from the recorded order total', () => {
  const order = riceOrder({ total: 104 });
  const html = invoice.render(order);

  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice computed total \(₹105\.00\)/);
  assert.match(html, /differs from Order Ledger recorded total \(₹104\.00\) by \+₹1\.00/);
});
