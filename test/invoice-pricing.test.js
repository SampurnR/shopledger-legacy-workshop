'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: invoice applies the same HSN GST and totals as billing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 200, tax: 10, cgst: 5, sgst: 5, total: 210 }
  );
  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineGstPercent: invoiceFigures.rows[0].gstPercent
    },
    { subtotal: billed.subtotal, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total, lineGstPercent: 5 }
  );

  const html = invoice.render({ id: 1001, items: items, coupon: '', total: billed.total });
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*210\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice applies order coupon before GST and matches billing', function () {
  const items = [{ id: 2, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 1000, discount: 50, tax: 171, cgst: 85.5, sgst: 85.5, total: 1121 }
  );
  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineTax: invoiceFigures.rows[0].lineTax
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      lineTax: billed.lines[0].tax
    }
  );
  assert.equal(invoiceFigures.total, billed.total);
});

test('CURRENT BEHAVIOUR: flat coupon invoice GST and total match billing', function () {
  const items = [{ id: 3, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 50, tax: 47.5, total: 997.5 }
  );
  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      total: invoiceFigures.total,
      lineTax: invoiceFigures.rows[0].lineTax
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total,
      lineTax: billed.lines[0].tax
    }
  );
});
