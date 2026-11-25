'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: order pricing applies HSN GST after coupon discount', function () {
  var items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 100,
    qty: 2
  }];

  var billed = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual({
    subtotal: billed.subtotal,
    discount: billed.discount,
    taxable: billed.taxable,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    gstPercent: billed.lines[0].gstPercent
  }, {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    gstPercent: 5
  });
});

test('invoice matches the billed HSN GST and coupon totals', function () {
  var order = {
    id: 7,
    coupon: 'WELCOME',
    items: [{
      id: 1,
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      price: 100,
      qty: 2
    }]
  };

  var figures = invoice.computeInvoiceFigures(order);

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
    subtotal: 200,
    discount: 10,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    gstPercent: 5,
    lineTax: 9.5
  });
});

test('invoice and order pricing use an explicit gstRate consistently', function () {
  var figures = invoice.computeInvoiceFigures({
    coupon: '',
    items: [{ name: 'Rice', hsn: '1006', gstRate: 12, price: 100, qty: 1 }]
  });

  assert.equal(figures.rows[0].gstPercent, 12);
  assert.equal(figures.tax, 12);
  assert.equal(figures.total, 112);
});

test('rendered invoice has no reconciliation warning when its figures match the billed order', function () {
  var html = invoice.render({
    id: 7,
    date: '01/02/2022',
    status: 'completed',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: 'WELCOME',
    total: 199.5,
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }]
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹199\.50/);
});
