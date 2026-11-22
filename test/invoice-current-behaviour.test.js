const test = require('node:test');
const assert = require('node:assert/strict');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const tax = require('../lib/tax');

function riceOrder(overrides = {}) {
  return Object.assign({
    id: 9001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: 'SAVE10',
    items: [{
      id: 1,
      sku: 'TEST-RICE',
      name: 'In-memory rice',
      hsn: '1006',
      price: 1000,
      qty: 1
    }],
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945
  }, overrides);
}

test('CURRENT BEHAVIOUR: pricing applies the HSN GST slab after the coupon discount', () => {
  const totals = pricing.computeTotals(riceOrder().items, riceOrder().coupon);

  assert.deepStrictEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total
  }, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945
  });
});

test('invoice calculation uses the item HSN rate from pricing', () => {
  const figures = invoice.computeInvoiceFigures(riceOrder());

  assert.deepStrictEqual({
    gstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst
  }, {
    gstPercent: 5,
    lineTax: 45,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5
  });
});

test('invoice coupon discount matches the customer billing calculation', () => {
  const figures = invoice.computeInvoiceFigures(riceOrder());

  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 945);
});

test('invoice and ledger totals match for the same in-memory order', () => {
  const order = riceOrder();
  const ledgerTotals = pricing.computeTotals(order.items, order.coupon);
  const invoiceTotals = invoice.computeInvoiceFigures(order);

  assert.equal(ledgerTotals.total, 945);
  assert.equal(invoiceTotals.total, 945);
  assert.equal(invoiceTotals.total - ledgerTotals.total, 0);
});

test('invoice total and GST breakdown match the customer billing calculation', () => {
  const order = riceOrder();
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('GST reconciliation reports matching calculations', () => {
  const order = riceOrder();
  const db = { orders: [order] };
  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: coupon validation accepts SAVE10 at the in-memory subtotal', () => {
  const result = coupons.validate('save10', 1000);

  assert.equal(result.valid, true);
  assert.equal(result.code, 'SAVE10');
  assert.equal(result.discount, 100);
});

test('CURRENT BEHAVIOUR: the 1006 HSN maps to a 5 percent rate and equal GST split', () => {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.deepStrictEqual(tax.splitCgstSgst(45), { cgst: 22.5, sgst: 22.5 });
});
