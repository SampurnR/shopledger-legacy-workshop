'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// Mirrors the line-item fields stored by POST /api/orders: HSN is copied, but
// gstRate is not. These are in-memory fixtures; tests must not use db.json.
const mixedHsnItems = [
  { id: 1, sku: 'GRN-TEST', name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
  { id: 2, sku: 'BEV-TEST', name: 'Tea', hsn: '0902', price: 1000, qty: 1 }
];

test('CURRENT BEHAVIOUR: order pricing calculates GST from HSN slabs and splits it evenly', () => {
  const billed = pricing.computeTotals(mixedHsnItems, '');

  assert.deepEqual(
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      lines: billed.lines.map(({ gstPercent, tax }) => ({ gstPercent, tax }))
    },
    {
      subtotal: 2000,
      discount: 0,
      tax: 230,
      cgst: 115,
      sgst: 115,
      total: 2230,
      lines: [{ gstPercent: 5, tax: 50 }, { gstPercent: 18, tax: 180 }]
    }
  );
});

test('invoice figures match the billed total, GST split, discount, and line breakdown', () => {
  const billed = pricing.computeTotals(mixedHsnItems, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({ items: mixedHsnItems, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { discount: 150, tax: 212.75, cgst: 106.38, sgst: 106.37, total: 2062.75 }
  );
  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      lines: figures.rows.map((row) => ({
        gstPercent: row.gstPercent,
        lineTax: row.lineTax
      }))
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      lines: billed.lines.map((line) => ({
        gstPercent: line.gstPercent,
        lineTax: line.tax
      }))
    }
  );
});

test('rendered invoice shows the billed amount without a reconciliation warning', () => {
  const billed = pricing.computeTotals(mixedHsnItems, 'SAVE10');
  const html = invoice.render({
    id: 7,
    date: '01/01/2022',
    customer: 'Test customer',
    items: mixedHsnItems,
    coupon: 'SAVE10',
    total: billed.total
  });

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹212\.75/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2062\.75/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
