'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const orders = require('../lib/orders');
const reports = require('../lib/reports');
const ledger = require('../lib/ledger');

// Deliberately import neither store nor server: every order and database is in memory.
// Corrected cases are named REGRESSION; unchanged behavior keeps its original name.
function item(overrides = {}) {
  return { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1, ...overrides };
}

function order(items = [item()], overrides = {}) {
  return {
    id: 1001, date: '15/11/2026', customer: 'Test Customer',
    paymentMode: 'cash', status: 'completed', items, coupon: '',
    subtotal: 100, discount: 0, tax: 5, total: 105, ...overrides
  };
}

function amounts(result) {
  const { subtotal, discount, tax, cgst, sgst, total } = result;
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('CURRENT BEHAVIOUR: missing items produce zero figures and no rows', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('REGRESSION: invoice and billing use HSN slabs of 5%, 12%, and 18%', () => {
  const items = [item(), item({ id: 2, hsn: '0405' }), item({ id: 3, hsn: '0902' })];
  const billed = pricing.computeTotals(items, '');
  assert.deepEqual(amounts(billed), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  const printed = invoice.computeInvoiceFigures(order(items));
  assert.deepEqual(amounts(printed), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(printed.rows.map(r => [r.hsn, r.gstPercent, r.lineTax]), [
    ['1006', 5, 5], ['0405', 12, 12], ['0902', 18, 18]
  ]);
});

for (const [label, gstRate, invoicePercent, invoiceTax, billedTax] of [
  ['percentage', 5, 5, 5, 5],
  ['decimal', 0.05, 5, 5, 5],
  ['zero', 0, 0, 0, 0],
  ['numeric string', '5', 12, 12, 12]
]) {
  test(`REGRESSION: ${label} gstRate yields invoice tax ${invoiceTax} and billed tax ${billedTax}`, () => {
    const line = item({ gstRate, hsn: '0405' });
    const printed = invoice.computeInvoiceFigures(order([line]));
    assert.equal(printed.tax, invoiceTax);
    assert.equal(printed.rows[0].gstPercent, invoicePercent);
    assert.equal(pricing.computeTotals([line], '').tax, billedTax);
  });
}

test('REGRESSION: invoice recomputes HSN tax from items and ignores stored monetary figures', () => {
  const printed = invoice.computeInvoiceFigures(order([item()], {
    subtotal: 999, discount: 888, tax: 777, total: 666
  }));
  assert.deepEqual(amounts(printed), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.deepEqual(printed.rows, [{
    name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 100,
    gstPercent: 5, line: 100, lineTax: 5
  }]);
});

test('CURRENT BEHAVIOUR: unknown HSN falls back to 18% in both calculators', () => {
  const items = [item({ hsn: '9999', qty: 2 })];
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order(items))), {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236
  });
  assert.equal(pricing.computeTotals(items, '').total, 236);
});

test('REGRESSION: percent coupon reduces taxable value before invoice GST', () => {
  const items = [item({ price: 1000, gstRate: 18 })];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
  const printed = invoice.computeInvoiceFigures(order(items, { coupon: 'SAVE10' }));
  assert.deepEqual(amounts(printed), {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
  assert.equal(printed.rows[0].lineTax, 162);
  assert.equal(printed.rows[0].line, 1000);
});

for (const [label, price, coupon, expected] of [
  ['respects minimum order', 100, 'SAVE10', [0, 18, 118]],
  ['respects percent discount cap', 2000, 'SAVE10', [150, 333, 2183]],
  ['ignores expired coupon', 1000, 'DIWALI20', [0, 180, 1180]],
  ['flat coupon reduces taxable value', 500, 'FLAT50', [50, 81, 531]],
  ['ineligible flat coupon cannot make total negative', 10, 'FLAT50', [0, 1.8, 11.8]],
  ['normalizes coupon case and whitespace', 1000, ' save10 ', [100, 162, 1062]],
  ['unknown coupon gives no discount', 1000, 'UNKNOWN', [0, 180, 1180]]
]) {
  test(`REGRESSION: invoice ${label}`, () => {
    const items = [item({ price, gstRate: 18 })];
    const printed = invoice.computeInvoiceFigures(order(items, { coupon }));
    const charged = pricing.computeTotals(items, coupon);
    assert.deepEqual([printed.discount, printed.tax, printed.total], expected);
    assert.deepEqual([charged.discount, charged.tax, charged.total], expected);
  });
}

test('REGRESSION: invoice sums rounded row GST like checkout', () => {
  const items = [item({ price: 0.03, gstRate: 18 }), item({ id: 2, price: 0.03, gstRate: 18 })];
  const printed = invoice.computeInvoiceFigures(order(items));
  assert.deepEqual(printed.rows.map(r => r.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(printed), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  assert.equal(pricing.computeTotals(items, '').tax, 0.02);
  assert.equal(pricing.computeTotals(items, '').total, 0.08);
});

test('REGRESSION: invoice splits rounded GST like checkout', () => {
  const printed = invoice.computeInvoiceFigures(order([item({ price: 0.05, gstRate: 18 })]));
  assert.deepEqual(amounts(printed), {
    subtotal: 0.05, discount: 0, tax: 0.01, cgst: 0.01, sgst: 0, total: 0.06
  });
  assert.equal(pricing.computeTotals([item({ price: 0.05, gstRate: 18 })], '').cgst, 0.01);
});

test('REGRESSION: stored billed order and rendered invoice both show 105 without mutation', () => {
  const items = [item()];
  const billed = pricing.computeTotals(items, '');
  const db = { nextOrderId: 1001, orders: [] };
  const stored = orders.add(db, { ...order(items), ...billed });
  const before = JSON.stringify(db);
  const html = invoice.render(stored);
  assert.equal(stored.total, 105);
  assert.equal(db.orders[0], stored);
  assert.ok(html.includes('<tr class="grand"><td>Invoice Total</td><td class="r">₹105.00</td></tr>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.equal(JSON.stringify(db), before);
});

test('CURRENT BEHAVIOUR: render shows negative delta and warns at a one-paise difference', () => {
  const html = invoice.render(order([item()], { total: 105.01 }));
  assert.ok(html.includes('by -₹0.01.'));
  assert.ok(html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: render suppresses notice for sub-paise differences after rounding', () => {
  const html = invoice.render(order([item()], { total: 105.004 }));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('REGRESSION: coupon invoice GST and discount match ledger as well as total', () => {
  const stored = order([item({ price: 1000, gstRate: 18 })], {
    coupon: 'SAVE10', subtotal: 1000, discount: 100, tax: 162, total: 1062
  });
  const html = invoice.render(stored);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹162.00'));
  assert.ok(html.includes('Coupon Discount (SAVE10)</td><td class="r" style="color:#16a34a">-₹100.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.deepEqual(reports.getGstReconciliation({ orders: [stored] }), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1001, date: '15/11/2026', customer: 'Test Customer', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 162, ledgerTotal: 1062,
      invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: true
    }]
  });
});

test('CURRENT BEHAVIOUR: render uses row gross, fallback codes, and escaped item text', () => {
  const html = invoice.render(order([item({ name: '<Rice & Dal>', sku: '', hsn: '', gstRate: 5 })]));
  assert.ok(html.includes('<strong>&lt;Rice &amp; Dal&gt;</strong>'));
  assert.ok(html.includes('SKU: -</div>'));
  assert.ok(html.includes('<td>-</td>'));
  assert.ok(html.includes('<td class="r">5%</td><td class="r">₹5.00</td><td class="r"><strong>₹100.00</strong></td>'));
  assert.ok(!html.includes('Coupon Discount ('));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

// Reconstructed carts reproduce the ticket's amounts; they are not database snapshots.
for (const fixture of [
  {
    id: 1002, customer: 'Anil Kulkarni', date: '05/01/2022',
    line: { name: 'Rice', hsn: '1006', price: 204, qty: 5 },
    billed: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    printed: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    delta: 0
  },
  {
    id: 1004, customer: 'Kalyani Foods', date: '30/01/2022',
    line: { name: 'Groundnut oil', hsn: '1508', price: 224, qty: 10 },
    billed: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    printed: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    delta: 0
  }
]) {
  test(`REGRESSION: ticket #${fixture.id} invoice matches checkout and preserves Khata charge`, () => {
    const items = [item(fixture.line)];
    const billed = pricing.computeTotals(items, 'SAVE10');
    assert.deepEqual(amounts(billed), fixture.billed);

    const db = {
      nextOrderId: fixture.id, orders: [],
      customers: [{ id: 1, name: fixture.customer, creditLimit: 10000, totalBilled: 0 }]
    };
    const stored = orders.add(db, {
      ...order(items), ...billed, id: fixture.id, date: fixture.date,
      customer: fixture.customer, customerId: 1, paymentMode: 'khata', coupon: 'SAVE10'
    });
    assert.equal(ledger.chargeOrderToKhata(db, 1, stored.total).ok, true);
    assert.equal(db.customers[0].totalBilled, fixture.billed.total);
    assert.equal(db.customers[0].balance, fixture.billed.total);
    const before = JSON.stringify(db);

    const printed = invoice.computeInvoiceFigures(stored);
    assert.deepEqual(amounts(printed), fixture.printed);
    assert.equal(printed.rows[0].gstPercent, 5);
    assert.equal(printed.rows[0].lineTax, fixture.printed.tax);
    const html = invoice.render(stored);
    assert.ok(html.includes(`Invoice Total</td><td class="r">₹${fixture.printed.total.toFixed(2)}`));
    assert.ok(html.includes(`CGST + SGST (Total GST)</td><td class="r">₹${fixture.printed.tax.toFixed(2)}`));
    assert.ok(html.includes(`Coupon Discount (SAVE10)</td><td class="r" style="color:#16a34a">-₹${fixture.printed.discount.toFixed(2)}`));
    assert.ok(!html.includes('Accountant Reconciliation Notice:'));
    assert.deepEqual(reports.getGstReconciliation(db), {
      totalChecked: 1, mismatchCount: 0, totalDelta: fixture.delta,
      rows: [{
        orderId: fixture.id, date: fixture.date, customer: fixture.customer, coupon: 'SAVE10',
        ledgerSubtotal: fixture.billed.subtotal, ledgerDiscount: fixture.billed.discount,
        ledgerTax: fixture.billed.tax, ledgerTotal: fixture.billed.total,
        invoiceDiscount: fixture.printed.discount, invoiceTax: fixture.printed.tax,
        invoiceTotal: fixture.printed.total, delta: fixture.delta, matched: true
      }]
    });
    assert.equal(JSON.stringify(db), before);
  });
}

test('REGRESSION: mixed HSN invoice allocates coupon before GST like checkout', () => {
  const items = ['1006', '0405', '0902'].map((hsn, index) => item({ id: index + 1, hsn, price: 250, qty: 2 }));
  const billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(amounts(billed), {
    subtotal: 1500, discount: 150, tax: 157.5, cgst: 78.75, sgst: 78.75, total: 1507.5
  });
  assert.deepEqual(billed.lines.map(line => ({
    gross: line.gross, discount: line.discount, taxable: line.taxable,
    gstPercent: line.gstPercent, tax: line.tax, net: line.net
  })), [
    { gross: 500, discount: 50, taxable: 450, gstPercent: 5, tax: 22.5, net: 472.5 },
    { gross: 500, discount: 50, taxable: 450, gstPercent: 12, tax: 54, net: 504 },
    { gross: 500, discount: 50, taxable: 450, gstPercent: 18, tax: 81, net: 531 }
  ]);
  const printed = invoice.computeInvoiceFigures(order(items, { ...billed, coupon: 'SAVE10' }));
  assert.deepEqual(amounts(printed), {
    subtotal: 1500, discount: 150, tax: 157.5, cgst: 78.75, sgst: 78.75, total: 1507.5
  });
  assert.deepEqual(printed.rows.map(line => [line.line, line.gstPercent, line.lineTax]), [
    [500, 5, 22.5], [500, 12, 54], [500, 18, 81]
  ]);
});

test('CURRENT BEHAVIOUR: all 18% HSN items without a coupon match checkout, printed invoice, and GST audit', () => {
  const items = [item({ hsn: '0902' }), item({ id: 2, hsn: '0901' })];
  const billed = pricing.computeTotals(items, '');
  const stored = order(items, { ...billed, id: 1008 });
  const expected = { subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236 };
  assert.deepEqual(amounts(billed), expected);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(stored)), expected);
  const html = invoice.render(stored);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹236.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  const audit = reports.getGstReconciliation({ orders: [stored] });
  assert.equal(audit.totalChecked, 1);
  assert.equal(audit.mismatchCount, 0);
  assert.equal(audit.totalDelta, 0);
  assert.equal(audit.rows[0].matched, true);
  assert.equal(audit.rows[0].delta, 0);
});
