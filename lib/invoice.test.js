'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('./invoice');
const pricing = require('./pricing');
const config = require('../config');

// Retain unaffected characterization tests and pin corrected behavior with
// regression tests. All fixtures are in memory; never load the server or store.
function item(overrides = {}) {
  return {
    id: 1,
    sku: 'TEST-001',
    name: 'Fixture product',
    hsn: '0902',
    price: 100,
    qty: 1,
    ...overrides
  };
}

// The order route stores these monetary fields from the pricing calculator.
function billedOrder(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  return {
    id: 101,
    date: '01/01/2022',
    customer: 'Fixture customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

function amounts(result) {
  return {
    subtotal: result.subtotal,
    discount: result.discount,
    tax: result.tax,
    total: result.total
  };
}

function split(result) {
  return { cgst: result.cgst, sgst: result.sgst };
}

test('REGRESSION: invoice matches the billed rice total and GST after SAVE10', () => {
  const order = billedOrder([item({ hsn: '1006', price: 640 })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 640, discount: 64, tax: 28.8, total: 604.8 });
  assert.deepEqual(amounts(figures), { subtotal: 640, discount: 64, tax: 28.8, total: 604.8 });
  assert.deepEqual(split(figures), { cgst: 14.4, sgst: 14.4 });
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);

  const html = invoice.render(order);
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹604.80</td>'));
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹28.80</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: absent or empty invoice items produce zero figures', () => {
  for (const order of [{}, { items: [] }]) {
    assert.deepEqual(invoice.computeInvoiceFigures(order), {
      subtotal: 0,
      discount: 0,
      tax: 0,
      cgst: 0,
      sgst: 0,
      total: 0,
      rows: []
    });
  }
});

test('CURRENT BEHAVIOUR: an undiscounted 18 percent item matches the billed total and GST', () => {
  const order = billedOrder([item({ qty: 2 })]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 200, discount: 0, tax: 36, total: 236 });
  assert.deepEqual(figures, {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [{
      name: 'Fixture product',
      sku: 'TEST-001',
      hsn: '0902',
      qty: 2,
      price: 100,
      gstPercent: 18,
      line: 200,
      lineTax: 36
    }]
  });
});

test('REGRESSION: invoice follows the billed mixed HSN slabs', () => {
  const items = [
    item({ id: 1, hsn: '1006' }),
    item({ id: 2, hsn: '0405' }),
    item({ id: 3, hsn: '0902' })
  ];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures(billedOrder(items));

  assert.deepEqual(amounts(billed), { subtotal: 300, discount: 0, tax: 35, total: 335 });
  assert.deepEqual(billed.lines.map(line => line.gstPercent), [5, 12, 18]);
  assert.deepEqual(amounts(figures), { subtotal: 300, discount: 0, tax: 35, total: 335 });
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 12, 18]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [5, 12, 18]);
  assert.deepEqual(split(figures), { cgst: 17.5, sgst: 17.5 });
});

for (const scenario of [
  { name: 'honors an explicit percentage GST rate over HSN', rate: 12, billedTax: 12, invoiceTax: 12, gstPercent: 12, total: 112, half: 6 },
  { name: 'honors an explicit decimal GST rate', rate: 0.12, billedTax: 12, invoiceTax: 12, gstPercent: 12, total: 112, half: 6 },
  { name: 'honors an explicit zero GST rate', rate: 0, billedTax: 0, invoiceTax: 0, gstPercent: 0, total: 100, half: 0 }
]) {
  test('REGRESSION: invoice ' + scenario.name, () => {
    const order = billedOrder([item({ hsn: '1006', gstRate: scenario.rate })]);
    const figures = invoice.computeInvoiceFigures(order);

    assert.equal(order.tax, scenario.billedTax);
    assert.equal(figures.tax, scenario.invoiceTax);
    assert.equal(figures.total, scenario.total);
    assert.equal(figures.rows[0].gstPercent, scenario.gstPercent);
    assert.equal(figures.rows[0].lineTax, scenario.invoiceTax);
    assert.deepEqual(split(figures), { cgst: scenario.half, sgst: scenario.half });
  });
}

test('REGRESSION: invoice uses billed discount allocations and post-discount GST for mixed slabs', () => {
  const items = [
    item({ id: 1, hsn: '1006', price: 1000 }),
    item({ id: 2, hsn: '0405', price: 500 })
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10'));

  assert.deepEqual(amounts(billed), { subtotal: 1500, discount: 150, tax: 99, total: 1449 });
  assert.deepEqual(billed.lines.map(line => ({ discount: line.discount, taxable: line.taxable, tax: line.tax })), [
    { discount: 100, taxable: 900, tax: 45 },
    { discount: 50, taxable: 450, tax: 54 }
  ]);
  assert.deepEqual(split(billed), { cgst: 49.5, sgst: 49.5 });
  assert.deepEqual(amounts(figures), { subtotal: 1500, discount: 150, tax: 99, total: 1449 });
  assert.deepEqual(figures.rows.map(row => ({ gross: row.line, tax: row.lineTax })), [
    { gross: 1000, tax: 45 },
    { gross: 500, tax: 54 }
  ]);
  assert.deepEqual(split(figures), { cgst: 49.5, sgst: 49.5 });
});

test('REGRESSION: matching invoice totals also have the billed GST and discount amounts', () => {
  const order = billedOrder([item({ price: 1000 })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual(amounts(order), { subtotal: 1000, discount: 100, tax: 162, total: 1062 });
  assert.deepEqual(amounts(figures), { subtotal: 1000, discount: 100, tax: 162, total: 1062 });
  assert.deepEqual(split(figures), { cgst: 81, sgst: 81 });
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹162.00</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹1062.00</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('REGRESSION: invoice percentage discount respects the billed coupon cap', () => {
  const order = billedOrder([item({ price: 2000 })], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 2000, discount: 150, tax: 333, total: 2183 });
  assert.deepEqual(amounts(figures), { subtotal: 2000, discount: 150, tax: 333, total: 2183 });
  assert.deepEqual(split(figures), { cgst: 166.5, sgst: 166.5 });
});

test('REGRESSION: invoice does not apply a percentage coupon below its minimum spend', () => {
  const order = billedOrder([item()], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 100, discount: 0, tax: 18, total: 118 });
  assert.deepEqual(amounts(figures), { subtotal: 100, discount: 0, tax: 18, total: 118 });
});

test('REGRESSION: invoice ignores an inactive coupon consistently with the pricing calculator', () => {
  const order = billedOrder([item({ price: 1000 })], 'DIWALI20');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 1000, discount: 0, tax: 180, total: 1180 });
  assert.deepEqual(amounts(figures), { subtotal: 1000, discount: 0, tax: 180, total: 1180 });
});

test('REGRESSION: flat invoice discounts reduce the GST taxable value', () => {
  const order = billedOrder([item({ price: 400 })], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 400, discount: 50, tax: 63, total: 413 });
  assert.deepEqual(amounts(figures), { subtotal: 400, discount: 50, tax: 63, total: 413 });
  assert.deepEqual(split(figures), { cgst: 31.5, sgst: 31.5 });
});

test('REGRESSION: an ineligible flat invoice coupon does not make the total negative', () => {
  const order = billedOrder([item({ price: 20 })], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 20, discount: 0, tax: 3.6, total: 23.6 });
  assert.deepEqual(amounts(figures), { subtotal: 20, discount: 0, tax: 3.6, total: 23.6 });
});

test('CURRENT BEHAVIOUR: an unknown coupon does not change invoice figures', () => {
  const order = billedOrder([item()], 'NOT-A-COUPON');

  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 100, discount: 0, tax: 18, total: 118
  });
});

test('REGRESSION: invoice sums rounded line GST consistently with billing', () => {
  const order = billedOrder([item({ id: 1, price: 0.03 }), item({ id: 2, price: 0.03 })]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 0.06, discount: 0, tax: 0.02, total: 0.08 });
  assert.deepEqual(amounts(figures), { subtotal: 0.06, discount: 0, tax: 0.02, total: 0.08 });
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual(split(figures), { cgst: 0.01, sgst: 0.01 });
});

test('REGRESSION: rounded invoice components add up to the billed rounded total', () => {
  const order = billedOrder([item({ price: 0.03 })], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(order), { subtotal: 0.03, discount: 0, tax: 0.01, total: 0.04 });
  assert.deepEqual(amounts(figures), { subtotal: 0.03, discount: 0, tax: 0.01, total: 0.04 });
  assert.deepEqual(split(figures), { cgst: 0.01, sgst: 0 });
});

test('CURRENT BEHAVIOUR: invoice recomputes monetary fields instead of using stored billed figures', () => {
  const order = {
    ...billedOrder([item()]),
    subtotal: 90,
    discount: 10,
    tax: 4,
    total: 84
  };
  const before = structuredClone(order);
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual(amounts(figures), { subtotal: 100, discount: 0, tax: 18, total: 118 });
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹118.00</td>'));
  assert.ok(html.includes('Order Ledger recorded total (₹84.00) by +₹34.00.'));
  assert.deepEqual(order, before);
});

test('CURRENT BEHAVIOUR: changing live coupon configuration changes an existing invoice but not its billed order', t => {
  const order = billedOrder([item({ price: 1000 })], 'SAVE10');
  const before = structuredClone(order);
  const originalValue = config.coupons.SAVE10.value;
  t.after(() => { config.coupons.SAVE10.value = originalValue; });

  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 1000, discount: 100, tax: 162, total: 1062
  });

  // Only the in-memory configuration object changes, and cleanup restores it.
  config.coupons.SAVE10.value = 20;

  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 1000, discount: 150, tax: 153, total: 1003
  });
  assert.deepEqual(order, before);
});

test('CURRENT BEHAVIOUR: invoice warnings use rounded total differences with a one-paisa threshold', () => {
  for (const scenario of [
    { billedTotal: 118, warning: null },
    { billedTotal: 117.996, warning: null },
    { billedTotal: 117.99, warning: '+₹0.01' },
    { billedTotal: 118.01, warning: '-₹0.01' }
  ]) {
    const order = { ...billedOrder([item()]), total: scenario.billedTotal };
    const html = invoice.render(order);
    const context = 'Stored total: ' + scenario.billedTotal;

    assert.equal(html.includes('Accountant Reconciliation Notice:'), scenario.warning !== null, context);
    if (scenario.warning !== null) {
      assert.ok(html.includes('by ' + scenario.warning + '.'), context);
    }
  }
});
