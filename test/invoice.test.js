'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function riceItem(overrides) {
  return Object.assign({
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 1000,
    qty: 1
  }, overrides || {});
}

test('order pricing uses the HSN slab and applies GST after coupon discount', function () {
  const totals = pricing.computeTotals([riceItem()], 'SAVE10');

  assert.deepEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    line: totals.lines[0]
  }, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    line: {
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 100,
      taxable: 900,
      tax: 45,
      net: 945
    }
  });
});

test('invoice uses HSN GST when gstRate is absent', function () {
  const figures = invoice.computeInvoiceFigures({ items: [riceItem()] });

  assert.deepEqual({
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    row: figures.rows[0]
  }, {
    tax: 50,
    cgst: 25,
    sgst: 25,
    total: 1050,
    row: {
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      qty: 1,
      price: 1000,
      gstPercent: 5,
      line: 1000,
      lineDiscount: 0,
      taxable: 1000,
      lineTax: 50
    }
  });
});

test('invoice follows the order coupon cap and calculates GST on discounted taxable value', function () {
  const figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [riceItem({ price: 3000 })]
  });

  assert.equal(figures.subtotal, 3000);
  assert.equal(figures.tax, 142.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2992.5);
});

test('invoice HTML shows allocated discount, taxable amount, and separate CGST and SGST', function () {
  const html = invoice.render({
    id: 42,
    date: '21/11/2026',
    status: 'completed',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    total: 945,
    items: [riceItem({ price: 640 })]
  });

  assert.match(html, /<th class="r">Discount<\/th><th class="r">Taxable<\/th><th class="r">GST Amt<\/th>/);
  assert.match(html, /<td class="r">₹64\.00<\/td><td class="r">₹576\.00<\/td><td class="r">₹28\.80<\/td>/);
  assert.match(html, /<tr><td>CGST<\/td><td class="r">₹14\.40<\/td><\/tr>/);
  assert.match(html, /<tr><td>SGST<\/td><td class="r">₹14\.40<\/td><\/tr>/);
});

test('GST reconciliation matches invoice figures to the ledger pricing', function () {
  const order = {
    id: 42,
    date: '21/11/2026',
    customer: 'Walk-in',
    status: 'completed',
    coupon: 'SAVE10',
    subtotal: 3000,
    discount: 150,
    tax: 142.5,
    total: 2992.5,
    items: [riceItem({ price: 3000 })]
  };

  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual({
    ledgerTax: result.rows[0].ledgerTax,
    invoiceTax: result.rows[0].invoiceTax,
    ledgerTotal: result.rows[0].ledgerTotal,
    invoiceTotal: result.rows[0].invoiceTotal,
    delta: result.rows[0].delta,
    matched: result.rows[0].matched
  }, {
    ledgerTax: 142.5,
    invoiceTax: 142.5,
    ledgerTotal: 2992.5,
    invoiceTotal: 2992.5,
    delta: 0,
    matched: true
  });
});

test('invoice figures match the amount and HSN GST charged by order pricing', function () {
  const item = riceItem({ price: 640 });
  const billed = pricing.computeTotals([item], 'SAVE10');
  const figures = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [item]
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    gstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    gstPercent: billed.lines[0].gstPercent,
    lineTax: billed.lines[0].tax
  });
});
