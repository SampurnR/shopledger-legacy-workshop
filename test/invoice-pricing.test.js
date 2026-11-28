'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function assertInvoiceMatchesBilledTotals(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: coupon });

  assert.deepEqual(
    {
      subtotal: printed.subtotal,
      taxable: printed.taxable,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total
    },
    {
      subtotal: billed.subtotal,
      taxable: billed.taxable,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total
    }
  );

  assert.deepEqual(
    printed.rows.map(function (row) {
      return {
        gstPercent: row.gstPercent,
        discount: row.discount,
        taxable: row.taxable,
        tax: row.lineTax
      };
    }),
    billed.lines.map(function (line) {
      return {
        gstPercent: line.gstPercent,
        discount: line.discount,
        taxable: line.taxable,
        tax: line.tax
      };
    })
  );

  return { billed: billed, printed: printed };
}

test('invoice uses the billed HSN slab and splits GST consistently', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }
  ];
  const result = assertInvoiceMatchesBilledTotals(items, '');

  assert.deepEqual(
    {
      tax: result.printed.tax,
      cgst: result.printed.cgst,
      sgst: result.printed.sgst,
      rowGstPercent: result.printed.rows[0].gstPercent,
      total: result.printed.total
    },
    { tax: 32, cgst: 16, sgst: 16, rowGstPercent: 5, total: 672 }
  );
});

test('invoice applies SAVE10 to the taxable value before GST, matching the billed order', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }
  ];
  const result = assertInvoiceMatchesBilledTotals(items, 'SAVE10');

  assert.deepEqual(
    {
      discount: result.printed.discount,
      taxable: result.printed.rows[0].taxable,
      tax: result.printed.tax,
      total: result.printed.total
    },
    { discount: 64, taxable: 576, tax: 28.8, total: 604.8 }
  );
});

test('invoice applies the WHOLESALE15 discount cap and billed HSN rate', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 5 }
  ];
  const result = assertInvoiceMatchesBilledTotals(items, 'WHOLESALE15');

  assert.deepEqual(
    {
      subtotal: result.printed.subtotal,
      discount: result.printed.discount,
      tax: result.printed.tax,
      rowGstPercent: result.printed.rows[0].gstPercent,
      total: result.printed.total
    },
    { subtotal: 3200, discount: 400, tax: 140, rowGstPercent: 5, total: 2940 }
  );
});

test('rendered invoice shows taxable line values and separate CGST and SGST without a mismatch warning', function () {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const html = invoice.render({
    id: 1001,
    date: '01/01/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    items: items,
    total: billed.total
  });

  assert.match(html, /<th class="r">Discount<\/th>/);
  assert.match(html, /<th class="r">Taxable Value<\/th>/);
  assert.match(html, /<td>CGST<\/td>/);
  assert.match(html, /<td>SGST<\/td>/);
  assert.doesNotMatch(html, /differs from Order Ledger/);
});
