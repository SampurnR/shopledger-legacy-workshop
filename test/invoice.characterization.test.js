const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const orders = require('../lib/orders');
const reports = require('../lib/reports');

// Handwritten fixtures only. Do not import the server, routes, or persistence.
// Unchanged characterizations retain CURRENT BEHAVIOUR; corrected cases use REGRESSION.
function item(overrides = {}) {
  return { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1, ...overrides };
}

function billedOrder(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1001, orders: [] };
  return orders.add(db, {
    date: '28/11/2026', customer: 'Test Customer', items, coupon,
    subtotal: totals.subtotal, discount: totals.discount,
    tax: totals.tax, total: totals.total
  });
}

function amounts(figures) {
  const { subtotal, discount, tax, cgst, sgst, total } = figures;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('REGRESSION: rice with SAVE10 prints the billed total and post-discount GST', () => {
  const order = billedOrder([item({ price: 1000 })], 'SAVE10');
  assert.equal(order.total, 945);
  const calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(calc), {
    subtotal: 1000, discount: 100, tax: 45, cgst: 22.5, sgst: 22.5, total: 945
  });
  assert.deepEqual(calc.rows, [{
    name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 1000,
    gstPercent: 5, line: 1000, lineTax: 45
  }]);
  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹945.00'));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹45.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: an order without items has zero invoice figures', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('REGRESSION: mixed HSN slabs print the billed 5/12/18 percent rates and taxes', () => {
  const items = [item(), item({ id: 2, name: 'Ghee', hsn: '0405' }),
    item({ id: 3, name: 'Tea', hsn: '0902' })];
  const billed = pricing.computeTotals(items, '');
  assert.deepEqual(amounts(billed), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]),
    [[5, 5], [12, 12], [18, 18]]);
  const order = billedOrder(items);
  const before = structuredClone(order);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 },
      { name: 'Ghee', sku: 'RICE', hsn: '0405', qty: 1, price: 100, gstPercent: 12, line: 100, lineTax: 12 },
      { name: 'Tea', sku: 'RICE', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
  invoice.render(order);
  assert.deepEqual(order, before, 'invoice calculation and rendering leave billed figures unchanged');
});

test('CURRENT BEHAVIOUR: unknown HSN uses the same 18 percent fallback in billing and invoice', () => {
  const order = billedOrder([item({ hsn: 'UNKNOWN' })]);
  assert.equal(order.total, 118);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
});

test('CURRENT BEHAVIOUR: invoice recomputes and ignores all stored monetary figures', () => {
  const calc = invoice.computeInvoiceFigures({
    items: [item({ hsn: '0902' })], subtotal: 999, discount: 50, tax: 1, total: 950
  });
  assert.deepEqual(amounts(calc), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
});

test('REGRESSION: percentage discount uses subtotal and invoice GST uses discounted taxable value', () => {
  const items = [item({ hsn: '0902', price: 1000 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10'))), {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
});

test('REGRESSION: invoice respects the percentage coupon cap', () => {
  const items = [item({ hsn: '0902', price: 2000 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10'))), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
});

test('REGRESSION: flat discount reduces both billed and invoice GST', () => {
  const items = [item({ hsn: '0902', price: 500 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'FLAT50')), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(billedOrder(items, 'FLAT50'))), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
});

// Invalid historical orders are supplied directly to the invoice function;
// these cases do not claim the order-creation route accepts invalid coupons.
for (const scenario of [
  { name: 'respects the minimum subtotal', price: 100, coupon: 'SAVE10', billed: 118, discount: 0, total: 118 },
  { name: 'ignores an expired coupon', price: 1000, coupon: 'DIWALI20', billed: 1180, discount: 0, total: 1180 },
  { name: 'does not apply a flat coupon below its minimum', price: 10, coupon: 'FLAT50', billed: 11.8, discount: 0, total: 11.8 },
  { name: 'normalizes coupon whitespace and case', price: 1000, coupon: ' save10 ', billed: 1062, discount: 100, total: 1062 },
  { name: 'silently ignores an unknown coupon', price: 1000, coupon: 'UNKNOWN', billed: 1180, discount: 0, total: 1180, unchanged: true }
]) {
  test((scenario.unchanged ? 'CURRENT BEHAVIOUR' : 'REGRESSION') + ': invoice ' + scenario.name, () => {
    const items = [item({ hsn: '0902', price: scenario.price })];
    assert.equal(pricing.computeTotals(items, scenario.coupon).total, scenario.billed);
    const calc = invoice.computeInvoiceFigures({ items, coupon: scenario.coupon });
    assert.equal(calc.discount, scenario.discount);
    assert.equal(calc.total, scenario.total);
  });
}

for (const scenario of [
  { rate: 5, billedTax: 5, invoiceTax: 5, invoicePercent: 5 },
  { rate: 0.05, billedTax: 5, invoiceTax: 5, invoicePercent: 5 },
  { rate: 0, billedTax: 0, invoiceTax: 0, invoicePercent: 0 }
]) {
  test((scenario.rate === 5 ? 'CURRENT BEHAVIOUR' : 'REGRESSION') + ': explicit gstRate ' + scenario.rate + ' agrees in billing and invoice', () => {
    const items = [item({ gstRate: scenario.rate })];
    assert.equal(pricing.computeTotals(items, '').tax, scenario.billedTax);
    const calc = invoice.computeInvoiceFigures({ items });
    assert.equal(calc.tax, scenario.invoiceTax);
    assert.equal(calc.rows[0].gstPercent, scenario.invoicePercent);
  });
}

test('REGRESSION: invoice sums rounded line taxes like billing', () => {
  const items = [1, 2, 3].map(id => item({ id, hsn: '0902', price: 0.03 }));
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), {
    subtotal: 0.09, discount: 0, tax: 0.03, cgst: 0.02, sgst: 0.01, total: 0.12
  });
  const calc = invoice.computeInvoiceFigures(billedOrder(items));
  assert.deepEqual(amounts(calc), {
    subtotal: 0.09, discount: 0, tax: 0.03, cgst: 0.02, sgst: 0.01, total: 0.12
  });
  assert.deepEqual(calc.rows.map(row => row.lineTax), [0.01, 0.01, 0.01]);
});

test('REGRESSION: invoice splits rounded tax with the odd paisa in CGST like billing', () => {
  const items = [item({ hsn: '0902', price: 0.03 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), {
    subtotal: 0.03, discount: 0, tax: 0.01, cgst: 0.01, sgst: 0, total: 0.04
  });
  const calc = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(amounts(calc), {
    subtotal: 0.03, discount: 0, tax: 0.01, cgst: 0.01, sgst: 0, total: 0.04
  });
});

test('REGRESSION: rendered invoice shows billed HSN GST and total without a discrepancy', () => {
  const html = invoice.render(billedOrder([item()]));
  assert.ok(html.includes('<td class="r">5%</td>'));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹5.00'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹105.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: rendered warning also shows a negative total discrepancy', () => {
  const html = invoice.render({ ...billedOrder([item({ hsn: '0902', price: 2000 })], 'SAVE10'), total: 2242 });
  assert.ok(html.includes('Order Ledger recorded total (₹2242.00) by -₹59.00.'));
});

test('CURRENT BEHAVIOUR: render warns at one paisa but suppresses a sub-half-paisa difference', () => {
  const order = billedOrder([item({ hsn: '0902' })]);
  assert.ok(invoice.render({ ...order, total: 117.99 }).includes('by +₹0.01.'));
  assert.ok(!invoice.render({ ...order, total: 117.996 }).includes('Accountant Reconciliation Notice:'));
});

test('REGRESSION: percentage coupon GST matches billing in reconciliation and invoice', () => {
  const order = billedOrder([item({ hsn: '0902', price: 1000 })], 'SAVE10');
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: '28/11/2026', customer: 'Test Customer', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 162, ledgerTotal: 1062,
      invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: true
    }]
  });
});

test('CURRENT BEHAVIOUR: reconciliation sums absolute invoice deltas and skips cancelled orders', () => {
  const positive = { ...billedOrder([item()]), total: 92 };
  const negative = { ...billedOrder([item({ hsn: '0902', price: 2000 })], 'SAVE10'), id: 1002, total: 2242 };
  const cancelled = { ...positive, id: 1003, status: 'cancelled' };
  const matched = { ...billedOrder([item({ hsn: '0902' })]), id: 1004 };
  const result = reports.getGstReconciliation({ orders: [positive, negative, cancelled, matched] });
  assert.equal(result.totalChecked, 3);
  assert.equal(result.mismatchCount, 2);
  assert.equal(result.totalDelta, 72);
  assert.deepEqual(result.rows.map(row => [row.orderId, row.delta, row.matched]),
    [[1001, 13, false], [1002, -59, false], [1004, 0, true]]);
});
