const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Fixtures stay in memory; these calculation modules never load the store.
function item(overrides = {}) {
  return { id: 1, name: 'Synthetic item', price: 100, qty: 1, ...overrides };
}

function order(overrides = {}) {
  return {
    id: 1, date: '01/01/2021', customer: 'Test customer',
    items: [item()], subtotal: 100, discount: 0, tax: 18, total: 118,
    ...overrides
  };
}

test('CURRENT BEHAVIOUR: default GST produces matching figures and line breakdowns', () => {
  const items = [item({ price: 50, qty: 2 })];
  assert.deepEqual(pricing.computeTotals(items), {
    subtotal: 100, discount: 0, taxable: 100, tax: 18, cgst: 9, sgst: 9, total: 118,
    lines: [{ id: 1, name: 'Synthetic item', hsn: '', gstPercent: 18,
      gross: 100, discount: 0, taxable: 100, tax: 18, net: 118 }]
  });
  assert.deepEqual(invoice.computeInvoiceFigures({ items }), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [{ name: 'Synthetic item', sku: '-', hsn: '-', qty: 2, price: 50,
      gstPercent: 18, line: 100, lineTax: 18 }]
  });
});

test('CURRENT BEHAVIOUR: mixed HSN slabs produce matching billed and invoice GST', () => {
  const items = [
    item({ id: 1, name: 'Rice', hsn: '1006' }),
    item({ id: 2, name: 'Ghee', hsn: '0405' }),
    item({ id: 3, name: 'Tea', hsn: '0902', sku: 'TEA' })
  ];
  assert.deepEqual(pricing.computeTotals(items), {
    subtotal: 300, discount: 0, taxable: 300, tax: 35, cgst: 17.5, sgst: 17.5, total: 335,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 100, discount: 0, taxable: 100, tax: 5, net: 105 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 100, discount: 0, taxable: 100, tax: 12, net: 112 },
      { id: 3, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 0, taxable: 100, tax: 18, net: 118 }
    ]
  });
  assert.deepEqual(invoice.computeInvoiceFigures({ items }), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100, gstPercent: 5, line: 100, lineTax: 5 },
      { name: 'Ghee', sku: '-', hsn: '0405', qty: 1, price: 100, gstPercent: 12, line: 100, lineTax: 12 },
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
});

test('CURRENT BEHAVIOUR: FLAT50 reduces taxable value before GST in billing and invoice', () => {
  const items = [item({ price: 300 })];
  assert.deepEqual(pricing.computeTotals(items, 'FLAT50'), {
    subtotal: 300, discount: 50, taxable: 250, tax: 45, cgst: 22.5, sgst: 22.5, total: 295,
    lines: [{ id: 1, name: 'Synthetic item', hsn: '', gstPercent: 18,
      gross: 300, discount: 50, taxable: 250, tax: 45, net: 295 }]
  });
  const figures = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 45);
  assert.equal(figures.total, 295);
});

test('CURRENT BEHAVIOUR: SAVE10 caps both discounts at 150 before GST', () => {
  const items = [item({ price: 2000 })];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });
  assert.equal(billed.discount, 150);
  assert.equal(billed.taxable, 1850);
  assert.equal(billed.tax, 333);
  assert.equal(billed.total, 2183);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 333);
  assert.equal(printed.total, 2183);
});

for (const scenario of [
  { name: 'normalizes coupon codes', price: 300, coupon: ' flat50 ', billedDiscount: 50, billedTotal: 295, invoiceDiscount: 50, invoiceTotal: 295 },
  { name: 'enforces minimum-order eligibility', price: 100, coupon: 'FLAT50', billedDiscount: 0, billedTotal: 118, invoiceDiscount: 0, invoiceTotal: 118 },
  { name: 'rejects expired coupons', price: 1000, coupon: 'DIWALI20', billedDiscount: 0, billedTotal: 1180, invoiceDiscount: 0, invoiceTotal: 1180 },
  { name: 'ignores an ineligible flat coupon on a small subtotal', price: 10, coupon: 'FLAT50', billedDiscount: 0, billedTotal: 11.8, invoiceDiscount: 0, invoiceTotal: 11.8 }
]) {
  test('CURRENT BEHAVIOUR: invoice ' + scenario.name, () => {
    const items = [item({ price: scenario.price })];
    const billed = pricing.computeTotals(items, scenario.coupon);
    const printed = invoice.computeInvoiceFigures({ items, coupon: scenario.coupon });
    assert.equal(billed.discount, scenario.billedDiscount);
    assert.equal(billed.total, scenario.billedTotal);
    assert.equal(printed.discount, scenario.invoiceDiscount);
    assert.equal(printed.total, scenario.invoiceTotal);
  });
}

for (const scenario of [
  { rate: 12, billedTax: 12, billedTotal: 112, billedPercent: 12, invoiceTax: 12, invoiceTotal: 112, invoicePercent: 12 },
  { rate: 0.18, billedTax: 18, billedTotal: 118, billedPercent: 18, invoiceTax: 18, invoiceTotal: 118, invoicePercent: 18 },
  { rate: 0, billedTax: 0, billedTotal: 100, billedPercent: 0, invoiceTax: 0, invoiceTotal: 100, invoicePercent: 0 }
]) {
  test('CURRENT BEHAVIOUR: explicit GST rate ' + scenario.rate + ' overrides the HSN consistently', () => {
    const items = [item({ hsn: '1006', gstRate: scenario.rate })];
    const billed = pricing.computeTotals(items);
    const printed = invoice.computeInvoiceFigures({ items });
    assert.equal(billed.tax, scenario.billedTax);
    assert.equal(billed.total, scenario.billedTotal);
    assert.equal(billed.lines[0].gstPercent, scenario.billedPercent);
    assert.equal(printed.tax, scenario.invoiceTax);
    assert.equal(printed.total, scenario.invoiceTotal);
    assert.equal(printed.rows[0].gstPercent, scenario.invoicePercent);
    assert.equal(printed.rows[0].lineTax, scenario.invoiceTax);
  });
}

test('CURRENT BEHAVIOUR: billing and invoice both round GST per line', () => {
  const items = [1, 2, 3].map(id => item({ id, price: 0.03 }));
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });
  assert.equal(billed.subtotal, 0.09);
  assert.equal(billed.tax, 0.03);
  assert.equal(billed.total, 0.12);
  assert.equal(billed.cgst, 0.02);
  assert.equal(billed.sgst, 0.01);
  assert.deepEqual(billed.lines.map(line => line.tax), [0.01, 0.01, 0.01]);
  assert.equal(printed.tax, 0.03);
  assert.equal(printed.total, 0.12);
  assert.equal(printed.cgst, 0.02);
  assert.equal(printed.sgst, 0.01);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01, 0.01]);
  assert.equal(printed.rows.reduce((sum, row) => sum + row.lineTax, 0), 0.03);
});

test('CURRENT BEHAVIOUR: empty items produce zero figures', () => {
  assert.deepEqual(pricing.computeTotals([]), {
    subtotal: 0, discount: 0, taxable: 0, tax: 0, cgst: 0, sgst: 0, total: 0, lines: []
  });
  const expected = { subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: [] };
  assert.deepEqual(invoice.computeInvoiceFigures({ items: [] }), expected);
  assert.deepEqual(invoice.computeInvoiceFigures({}), expected);
});

test('CURRENT BEHAVIOUR: invoice recomputes figures instead of using stored order totals', () => {
  const stored = order({ subtotal: 999, discount: 777, taxable: 222, tax: 666, cgst: 333, sgst: 333, total: 888 });
  assert.deepEqual(invoice.computeInvoiceFigures(stored), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [{ name: 'Synthetic item', sku: '-', hsn: '-', qty: 1, price: 100,
      gstPercent: 18, line: 100, lineTax: 18 }]
  });
  assert.equal(stored.total, 888);
  assert.equal(stored.tax, 666);
});

for (const scenario of [
  { total: 286, difference: '+₹9.00' },
  { total: 304, difference: '-₹9.00' },
  { total: 295, difference: null }
]) {
  test('CURRENT BEHAVIOUR: rendered invoice reconciles recorded total ' + scenario.total, () => {
    const html = invoice.render(order({ items: [item({ price: 300 })], coupon: 'FLAT50', total: scenario.total }));
    assert.ok(html.includes('<tr><td>Gross Subtotal</td><td class="r">₹300.00</td></tr>'));
    assert.ok(html.includes('<tr><td>CGST + SGST (Total GST)</td><td class="r">₹45.00</td></tr>'));
    assert.ok(html.includes('Coupon Discount (FLAT50)</td><td class="r" style="color:#16a34a">-₹50.00'));
    assert.ok(html.includes('<tr class="grand"><td>Invoice Total</td><td class="r">₹295.00</td></tr>'));
    if (scenario.difference) {
      assert.ok(html.includes('<strong>Accountant Reconciliation Notice:</strong> Invoice computed total (₹295.00) ' +
        'differs from Order Ledger recorded total (₹' + scenario.total.toFixed(2) + ') by ' + scenario.difference + '.'));
    } else {
      assert.ok(!html.includes('Accountant Reconciliation Notice:'));
      assert.ok(!html.includes('<div class="warn-box">'));
    }
  });
}

test('CURRENT BEHAVIOUR: reconciliation detects total or tax differences and sums absolute total deltas', () => {
  const db = { orders: [
    order({ id: 1, total: 108 }),
    order({ id: 2, total: 128, status: 'pending' }),
    order({ id: 3, tax: 17 }),
    order({ id: 4 }),
    order({ id: 5, total: 0, tax: 0, status: 'cancelled' })
  ] };
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 4, mismatchCount: 3, totalDelta: 20,
    rows: [
      { orderId: 1, date: '01/01/2021', customer: 'Test customer', coupon: '', ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 18, ledgerTotal: 108, invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: 10, matched: false },
      { orderId: 2, date: '01/01/2021', customer: 'Test customer', coupon: '', ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 18, ledgerTotal: 128, invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: -10, matched: false },
      { orderId: 3, date: '01/01/2021', customer: 'Test customer', coupon: '', ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 17, ledgerTotal: 118, invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: 0, matched: false },
      { orderId: 4, date: '01/01/2021', customer: 'Test customer', coupon: '', ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 18, ledgerTotal: 118, invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: 0, matched: true }
    ]
  });
});

test('CURRENT BEHAVIOUR: reconciliation with no orders has no discrepancies', () => {
  const expected = { totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: [] };
  assert.deepEqual(reports.getGstReconciliation({}), expected);
  assert.deepEqual(reports.getGstReconciliation({ orders: [] }), expected);
});
