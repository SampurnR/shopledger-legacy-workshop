'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: order pricing applies the HSN GST slab, while invoice uses the default rate', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 1000, tax: 50, cgst: 25, sgst: 25, total: 1050 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: 1000, tax: 180, cgst: 90, sgst: 90, total: 1180 }
  );
  assert.equal(printed.rows[0].gstPercent, 18);
});

test('CURRENT BEHAVIOUR: invoice calculates SAVE10 on subtotal plus tax', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 600, discount: 60, tax: 27, total: 567 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 600, discount: 70.8, tax: 108, total: 637.2 }
  );
});

test('CURRENT BEHAVIOUR: SAVE10 pricing and invoice totals differ for a ₹2,240 subtotal', function () {
  var items = [{ id: 5, name: 'Groundnut Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: 2240, discount: 264.32, tax: 403.2, total: 2378.88 }
  );
});

test('CURRENT BEHAVIOUR: GST reconciliation reports the calculated invoice mismatch against billed totals', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var order = {
    id: 42,
    date: '28/11/2026',
    customer: 'In-memory customer',
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total,
    items: items
  };
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.deepEqual(
    {
      ledgerTax: result.rows[0].ledgerTax,
      invoiceTax: result.rows[0].invoiceTax,
      ledgerTotal: result.rows[0].ledgerTotal,
      invoiceTotal: result.rows[0].invoiceTotal,
      delta: result.rows[0].delta,
      matched: result.rows[0].matched
    },
    { ledgerTax: 50, invoiceTax: 180, ledgerTotal: 1050, invoiceTotal: 1180, delta: 130, matched: false }
  );
});

test('CURRENT BEHAVIOUR: rendered invoice displays its independently computed GST and mismatch notice', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var html = invoice.render({
    id: 42,
    date: '28/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    coupon: '',
    items: items,
    total: billed.total
  });

  assert.match(html, /18%/);
  assert.match(html, /180\.00/);
  assert.match(html, /Invoice computed total/);
  assert.match(html, /1,180\.00|1180\.00/);
  assert.match(html, /1,050\.00|1050\.00/);
});
