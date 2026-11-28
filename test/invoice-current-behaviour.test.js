const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice and order pricing agree on HSN GST and coupon totals', function () {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }
  ];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const order = {
    id: 1,
    date: '2026-11-28',
    customer: 'Test Customer',
    items: items,
    coupon: 'WELCOME',
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: ledger.subtotal, discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { subtotal: 600, discount: 30, tax: 28.5, total: 598.5 }
  );
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 600, discount: 30, tax: 28.5, cgst: 14.25, sgst: 14.25, total: 598.5 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.5);
});

test('invoice interprets a decimal gstRate as a fractional rate', function () {
  const items = [{ name: 'Oil', price: 100, qty: 1, gstRate: 0.05 }];
  const order = { items: items, coupon: '' };
  const ledger = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(ledger.tax, 5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('GST reconciliation matches invoice and ledger totals for an in-memory order', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const db = {
    orders: [{
      id: 7,
      date: '2026-11-28',
      customer: 'Test Customer',
      items: items,
      coupon: 'WELCOME',
      subtotal: ledger.subtotal,
      discount: ledger.discount,
      tax: ledger.tax,
      total: ledger.total
    }],
    products: [],
    customers: []
  };
  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTax, 28.5);
  assert.equal(reconciliation.rows[0].invoiceTax, 28.5);
  assert.equal(reconciliation.rows[0].ledgerTotal, 598.5);
  assert.equal(reconciliation.rows[0].invoiceTotal, 598.5);
  assert.equal(reconciliation.rows[0].delta, 0);
});
