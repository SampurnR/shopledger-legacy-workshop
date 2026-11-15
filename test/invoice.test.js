'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// Synthetic fixtures only: do not import store, server, routes, or the database.
// Invoice regressions share checkout's rules; retained quirks are marked CURRENT BEHAVIOUR.
function item(overrides = {}) {
  return {
    id: 1,
    name: 'Test rice',
    sku: 'TEST-001',
    hsn: '1006',
    price: 100,
    qty: 1,
    ...overrides
  };
}

function billedOrder(items, coupon = '', overrides = {}) {
  const billed = pricing.computeTotals(items, coupon);
  return {
    id: 1,
    date: '15/11/2026',
    customer: 'Test customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total,
    ...overrides
  };
}

function figures(result) {
  const { subtotal, discount, tax, cgst, sgst, total } = result;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('REGRESSION: invoice total and GST breakdown match the billed mixed-item coupon order', () => {
  const order = billedOrder([
    item({ price: 640 }),
    item({ id: 4, name: 'Test oil', hsn: '1512', price: 190, qty: 2 })
  ], 'SAVE10');
  assert.equal(order.total, 963.9);
  assert.equal(order.tax, 45.9);
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures(printed), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 28.8], [5, 17.1]]);
});

test('CURRENT BEHAVIOUR: an undiscounted 18% item matches checkout and splits GST equally', () => {
  const items = [item({ name: 'Test tea', hsn: '0902', qty: 2 })];
  const expected = { subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236 };
  assert.deepEqual(figures(pricing.computeTotals(items, '')), expected);
  assert.deepEqual(invoice.computeInvoiceFigures(billedOrder(items)), {
    ...expected,
    rows: [{
      name: 'Test tea', sku: 'TEST-001', hsn: '0902', qty: 2,
      price: 100, gstPercent: 18, line: 200, lineTax: 36
    }]
  });
});

test('invoice uses the billed 5% and 12% HSN slabs', () => {
  const items = [item(), item({ id: 2, name: 'Test ghee', hsn: '0405' })];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(billedOrder(items));

  assert.deepEqual(figures(billed), {
    subtotal: 200, discount: 0, tax: 17, cgst: 8.5, sgst: 8.5, total: 217
  });
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[5, 5], [12, 12]]);
  assert.deepEqual(figures(printed), {
    subtotal: 200, discount: 0, tax: 17, cgst: 8.5, sgst: 8.5, total: 217
  });
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [12, 12]]);
});

test('invoice apportions coupon discounts before calculating mixed-slab GST', () => {
  const items = [item({ price: 500 }), item({ id: 2, hsn: '0405', price: 500 })];
  const billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(figures(billed), {
    subtotal: 1000, discount: 100, tax: 76.5, cgst: 38.25, sgst: 38.25, total: 976.5
  });
  assert.deepEqual(billed.lines.map(line => [line.discount, line.taxable, line.tax]), [
    [50, 450, 22.5], [50, 450, 54]
  ]);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10'))), {
    subtotal: 1000, discount: 100, tax: 76.5, cgst: 38.25, sgst: 38.25, total: 976.5
  });
  assert.deepEqual(invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10')).rows.map(row => row.lineTax), [22.5, 54]);
});

const couponCases = [
  {
    name: 'percentage coupon preserves both the billed total and GST breakdown',
    line: { hsn: '0902', price: 1000 }, code: 'SAVE10',
    billed: { subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062 }
  },
  {
    name: 'invoice respects the SAVE10 maximum discount of 150',
    line: { price: 1000, qty: 2 }, code: 'SAVE10',
    billed: { subtotal: 2000, discount: 150, tax: 92.5, cgst: 46.25, sgst: 46.25, total: 1942.5 }
  },
  {
    name: 'flat coupon reduces invoice taxable value before GST',
    line: { price: 400 }, code: 'FLAT50',
    billed: { subtotal: 400, discount: 50, tax: 17.5, cgst: 8.75, sgst: 8.75, total: 367.5 }
  },
  // These existing-order inputs are deliberately not examples of accepted POST /orders payloads.
  {
    name: 'existing invoice does not apply SAVE10 below its minimum order value',
    line: { price: 100 }, code: 'SAVE10',
    billed: { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  },
  {
    name: 'existing invoice does not apply the inactive DIWALI20 coupon',
    line: { price: 1000 }, code: 'DIWALI20',
    billed: { subtotal: 1000, discount: 0, tax: 50, cgst: 25, sgst: 25, total: 1050 }
  },
  {
    name: 'existing invoice does not become negative from a below-minimum flat coupon',
    line: { price: 10 }, code: 'FLAT50',
    billed: { subtotal: 10, discount: 0, tax: 0.5, cgst: 0.25, sgst: 0.25, total: 10.5 }
  },
  {
    name: 'invoice normalizes a stored coupon code just as checkout pricing does',
    line: { hsn: '0902', price: 1000 }, code: ' save10 ',
    billed: { subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062 }
  }
];

for (const scenario of couponCases) {
  test(scenario.name, () => {
    const items = [item(scenario.line)];
    assert.deepEqual(figures(pricing.computeTotals(items, scenario.code)), scenario.billed);
    assert.deepEqual(figures(invoice.computeInvoiceFigures(billedOrder(items, scenario.code))), scenario.billed);
  });
}

test('invoice honors both percentage and decimal GST rates', () => {
  const percentItems = [item({ gstRate: 5 })];
  assert.deepEqual(figures(invoice.computeInvoiceFigures(billedOrder(percentItems))), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });

  const decimalItems = [item({ gstRate: 0.05 })];
  assert.deepEqual(figures(pricing.computeTotals(decimalItems, '')), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  const printed = invoice.computeInvoiceFigures(billedOrder(decimalItems));
  assert.deepEqual(figures(printed), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice preserves explicit zero GST', () => {
  const items = [item({ gstRate: 0 })];
  assert.deepEqual(figures(pricing.computeTotals(items, '')), {
    subtotal: 100, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 100
  });
  assert.deepEqual(figures(invoice.computeInvoiceFigures(billedOrder(items))), {
    subtotal: 100, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 100
  });
});

test('invoice sums rounded line GST and uses the billed odd-paisa CGST/SGST split', () => {
  const items = [1, 2, 3].map(id => item({ id, hsn: '0902', price: 0.03 }));
  assert.deepEqual(figures(pricing.computeTotals(items, '')), {
    subtotal: 0.09, discount: 0, tax: 0.03, cgst: 0.02, sgst: 0.01, total: 0.12
  });
  const printed = invoice.computeInvoiceFigures(billedOrder(items));
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01, 0.01]);
  assert.deepEqual(figures(printed), {
    subtotal: 0.09, discount: 0, tax: 0.03, cgst: 0.02, sgst: 0.01, total: 0.12
  });
});

test('CURRENT BEHAVIOUR: invoice recomputes figures instead of using stored billed figures', () => {
  const order = billedOrder([item()], '', { subtotal: 999, discount: 9, tax: 1, total: 991 });
  const before = structuredClone(order);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order)), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  invoice.render(order);
  assert.deepEqual(order, before);
});

test('printed invoice shows billed GST and total without a reconciliation warning', () => {
  const html = invoice.render(billedOrder([item()]));
  assert.ok(html.includes('<td class="r">5%</td>'));
  assert.ok(html.includes('<tr><td>CGST + SGST (Total GST)</td><td class="r">₹5.00</td></tr>'));
  assert.ok(html.includes('<tr class="grand"><td>Invoice Total</td><td class="r">₹105.00</td></tr>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: inconsistent stored totals still produce signed reconciliation notices', () => {
  for (const [total, difference] of [[100, '+₹5.00'], [110, '-₹5.00']]) {
    const html = invoice.render(billedOrder([item()], '', { total }));
    assert.ok(html.includes('Invoice computed total (₹105.00)'));
    assert.ok(html.includes('Order Ledger recorded total (₹' + total.toFixed(2) + ') by ' + difference + '.'));
  }
});

test('equal totals with a percentage coupon also have matching GST in reconciliation', () => {
  const order = billedOrder([item({ hsn: '0902', price: 1000 })], 'SAVE10');
  assert.equal(order.tax, 162);
  assert.equal(invoice.computeInvoiceFigures(order).tax, 162);
  assert.equal(order.total, 1062);
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1, date: '15/11/2026', customer: 'Test customer', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 162, ledgerTotal: 1062,
      invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: true
    }]
  });
});

test('CURRENT BEHAVIOUR: a matching invoice has no warning and is matched by reconciliation', () => {
  const order = billedOrder([item({ hsn: '0902' })]);
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
