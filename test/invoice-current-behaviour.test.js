'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice uses the same HSN slab as ledger pricing', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items });

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice applies the same post-discount taxable base and totals as checkout', function () {
  const items = [{ id: 2, name: 'Spice', hsn: '0904', price: 600, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual(
    { subtotal: ledger.subtotal, discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { subtotal: 600, discount: 30, tax: 68.4, total: 638.4 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 600, discount: 30, tax: 68.4, total: 638.4 }
  );
  assert.equal(ledger.cgst + ledger.sgst, ledger.tax);
  assert.equal(printed.cgst + printed.sgst, printed.tax);
});

test('invoice row line shows taxable amount and line tax uses checkout rounding', function () {
  const printed = invoice.computeInvoiceFigures({
    items: [{ name: 'Odd price item', price: 0.05, qty: 1, gstRate: 18 }]
  });

  assert.deepEqual(printed.rows[0], {
    name: 'Odd price item',
    sku: '-',
    hsn: '-',
    qty: 1,
    price: 0.05,
    gstPercent: 18,
    line: 0.05,
    lineTax: 0.01
  });
  assert.equal(printed.total, 0.06);
});

test('invoice honors fractional gstRate in the same way as checkout', function () {
  const item = { id: 3, name: 'Special rate', price: 100, qty: 1, gstRate: 0.05 };
  const ledger = pricing.computeTotals([item], '');
  const printed = invoice.computeInvoiceFigures({ items: [item] });

  assert.equal(ledger.tax, 5);
  assert.equal(ledger.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('reconciliation reports no mismatch when invoice calculation matches billed order', function () {
  const order = {
    id: 42,
    date: '2026-11-28',
    customer: 'Test customer',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    {
      ledgerTax: result.rows[0].ledgerTax,
      invoiceTax: result.rows[0].invoiceTax,
      ledgerTotal: result.rows[0].ledgerTotal,
      invoiceTotal: result.rows[0].invoiceTotal,
      delta: result.rows[0].delta,
      matched: result.rows[0].matched
    },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true }
  );
});

test('invoice matches the billed HSN tax and total', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, total: ledger.total });

  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.total, ledger.total);
  assert.equal(printed.rows[0].gstPercent, 5);
});
