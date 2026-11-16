const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// All fixtures are constructed here. No store, server, or database file is used.
function item(overrides = {}) {
  return { id: 1, name: 'Test rice', sku: 'TEST-1', hsn: '1006', price: 100, qty: 1, ...overrides };
}

function billedOrder(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  return {
    id: 42, date: '17/11/2026', customer: 'Test customer',
    paymentMode: 'cash', status: 'completed', items, coupon,
    subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  };
}

function amounts(figures) {
  const { subtotal, discount, tax, cgst, sgst, total } = figures;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('REGRESSION: HSN rice with SAVE10 invoice matches billed total and GST breakdown', () => {
  const order = billedOrder([item({ price: 640 })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), {
    subtotal: 640, discount: 64, tax: 28.8, cgst: 14.4, sgst: 14.4, total: 604.8
  });
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹604\.80/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice agrees with billing for an undiscounted explicit percentage GST rate', () => {
  const order = billedOrder([item({ gstRate: 12, qty: 2 })]);
  assert.equal(order.tax, 24);
  assert.equal(order.total, 224);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 200, discount: 0, tax: 24, cgst: 12, sgst: 12, total: 224
  });
});

test('invoice uses the billed HSN rates of 5%, 12%, and 18%', () => {
  const order = billedOrder([
    item(), item({ id: 2, hsn: '0405' }), item({ id: 3, hsn: '0902' })
  ]);
  assert.equal(order.tax, 35);
  assert.equal(order.total, 335);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 5], [12, 12], [18, 18]
  ]);
});

test('invoice applies percentage discount before calculating GST', () => {
  const order = billedOrder([item({ price: 1000, gstRate: 5 })], 'SAVE10');
  assert.deepEqual([order.discount, order.tax, order.total], [100, 45, 945]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 1000, discount: 100, tax: 45, cgst: 22.5, sgst: 22.5, total: 945
  });
});

test('invoice respects the percentage coupon maximum discount', () => {
  const order = billedOrder([item({ price: 2000, gstRate: 5 })], 'SAVE10');
  assert.deepEqual([order.discount, order.tax, order.total], [150, 92.5, 1942.5]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 2000, discount: 150, tax: 92.5, cgst: 46.25, sgst: 46.25, total: 1942.5
  });
});

test('flat discount reduces invoice taxable value', () => {
  const order = billedOrder([item({ price: 500, gstRate: 5 })], 'FLAT50');
  assert.deepEqual([order.discount, order.tax, order.total], [50, 22.5, 472.5]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5
  });
});

test('invoice does not apply a coupon below its minimum subtotal', () => {
  const order = billedOrder([item({ gstRate: 5 })], 'SAVE10');
  // Direct module fixture: checkout itself rejects this coupon/subtotal combination.
  assert.deepEqual([order.discount, order.tax, order.total], [0, 5, 105]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
});

test('invoice does not apply an inactive coupon to a stored order', () => {
  const order = billedOrder([item({ price: 1000, gstRate: 5 })], 'DIWALI20');
  // Direct module fixture: checkout rejects this inactive coupon.
  assert.deepEqual([order.discount, order.tax, order.total], [0, 50, 1050]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 1000, discount: 0, tax: 50, cgst: 25, sgst: 25, total: 1050
  });
});

test('invoice normalizes stored coupon codes like billing', () => {
  const order = billedOrder([item({ price: 1000, gstRate: 5 })], ' save10 ');
  assert.deepEqual([order.discount, order.tax, order.total], [100, 45, 945]);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 1000, discount: 100, tax: 45, cgst: 22.5, sgst: 22.5, total: 945
  });
});

test('invoice preserves explicit zero GST', () => {
  const order = billedOrder([item({ gstRate: 0 })]);
  assert.equal(order.tax, 0);
  assert.equal(order.total, 100);
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 0);
  assert.equal(figures.total, 100);
  assert.equal(figures.rows[0].gstPercent, 0);
});

test('invoice accepts decimal GST rates like billing', () => {
  const order = billedOrder([item({ gstRate: 0.05 })]);
  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice sums rounded row taxes like billing', () => {
  const order = billedOrder([
    item({ price: 0.1, gstRate: 5 }), item({ id: 2, price: 0.1, gstRate: 5 })
  ]);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.22);
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(figures), {
    subtotal: 0.2, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.22
  });
});

test('CURRENT BEHAVIOUR: invoice recalculates figures instead of using recorded billing amounts', () => {
  const order = { ...billedOrder([item({ gstRate: 5 })]), subtotal: 900, discount: 100, tax: 40, total: 840 };
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice computed total \(₹105\.00\)/);
  assert.match(html, /Order Ledger recorded total \(₹840\.00\) by -₹735\.00/);
});

test('rendered HSN-only invoice matches billing without a mismatch warning', () => {
  const order = billedOrder([item({ price: 640 })], 'SAVE10');
  assert.equal(order.total, 604.8);
  const html = invoice.render(order);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹604\.80/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('renderer shows matching GST and total for percentage-discount billing', () => {
  const order = billedOrder([item({ price: 1000, gstRate: 5 })], 'SAVE10');
  assert.equal(order.tax, 45);
  assert.equal(invoice.computeInvoiceFigures(order).tax, 45);
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹945\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice returns zero amounts and no rows when items are missing', () => {
  const figures = invoice.computeInvoiceFigures({});
  assert.deepEqual(amounts(figures), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0
  });
  assert.deepEqual(figures.rows, []);
});
