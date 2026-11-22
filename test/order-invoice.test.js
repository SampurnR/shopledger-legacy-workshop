'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// This matches the line-item shape created by routes/orders.js. All data stays
// in memory; these tests do not use lib/store.js or data/db.json.
const items = [
  {
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: 2500,
    qty: 1
  }
];

test('CURRENT BEHAVIOUR: order pricing uses HSN GST and caps SAVE10 before tax', function () {
  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxable: totals.taxable,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      line: totals.lines[0]
    },
    {
      subtotal: 2500,
      discount: 150,
      taxable: 2350,
      tax: 117.5,
      cgst: 58.75,
      sgst: 58.75,
      total: 2467.5,
      line: {
        id: 1,
        name: 'Rice',
        hsn: '1006',
        gstPercent: 5,
        gross: 2500,
        discount: 150,
        taxable: 2350,
        tax: 117.5,
        net: 2467.5
      }
    }
  );
});

test('invoice uses HSN GST and the billed subtotal, discount, tax, and total', function () {
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      row: figures.rows[0]
    },
    {
      subtotal: 2500,
      discount: 150,
      tax: 117.5,
      cgst: 58.75,
      sgst: 58.75,
      total: 2467.5,
      row: {
        name: 'Rice',
        sku: 'RICE-001',
        hsn: '1006',
        qty: 1,
        price: 2500,
        gstPercent: 5,
        line: 2500,
        lineTax: 117.5
      }
    }
  );
});

test('rendered invoice shows billed GST and total without a reconciliation warning', function () {
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    date: '22/11/2026',
    status: 'completed',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  const html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*117\.50/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*2467\.50/);
});
