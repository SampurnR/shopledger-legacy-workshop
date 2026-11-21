'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: a GST mismatch produces no invoice warning when the recorded total matches', function () {
  const order = {
    id: 45,
    subtotal: 100,
    discount: 13,
    tax: 18,
    total: 105,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 0);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, order.total);
  assert.notEqual(printed.tax, order.tax);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹5\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice HTML combines GST without displaying the calculated CGST and SGST amounts', function () {
  const order = {
    id: 46,
    total: 318.25,
    coupon: 'WELCOME',
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ]
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.cgst, 16.63);
  assert.equal(printed.sgst, 16.62);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹33\.25/);
  assert.doesNotMatch(html, /₹16\.63|₹16\.62/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹318\.25/);
});

test('CURRENT BEHAVIOUR: invoice recalculates GST and total despite different recorded figures', function () {
  const order = {
    id: 43,
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  };
  const before = structuredClone(order);
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.tax, 5);
  assert.equal(printed.cgst, 2.5);
  assert.equal(printed.sgst, 2.5);
  assert.equal(printed.total, 105);
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.match(html, /Order Ledger recorded total \(₹118\.00\) by -₹13\.00/);
  assert.deepEqual(order, before);
});

test('CURRENT BEHAVIOUR: an expired coupon loses its recorded discount when printed', function () {
  const order = {
    id: 44,
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840,
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
  };
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 0);
  assert.equal(printed.tax, 50);
  assert.equal(printed.total, 1050);
  const html = invoice.render(order);
  assert.match(html, /Order Ledger recorded total \(₹840\.00\) by \+₹210\.00/);
  assert.doesNotMatch(html, /Coupon Discount/);
});

test('invoice apportions a coupon across mixed GST slabs and splits the resulting tax', function () {
  const items = [
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'WELCOME' });
  assert.equal(printed.subtotal, 300);
  assert.equal(printed.discount, 15);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [4.75, 11.4, 17.1]);
  assert.deepEqual(printed.rows.map(row => row.gstPercent), [5, 12, 18]);
  assert.equal(printed.tax, 33.25);
  assert.equal(printed.cgst, 16.63);
  assert.equal(printed.sgst, 16.62);
  assert.equal(printed.total, 318.25);
});

test('invoice figures match the totals billed for an HSN-rated coupon order', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({
    id: 42,
    items: items,
    coupon: 'WELCOME',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.deepEqual(
    {
      subtotal: printed.subtotal,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total,
      rowTax: printed.rows[0].lineTax,
      rowGstPercent: printed.rows[0].gstPercent
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      rowTax: billed.lines[0].tax,
      rowGstPercent: billed.lines[0].gstPercent
    }
  );
});

test('invoice uses the same HSN GST slab and totals as billing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(printed.total, billed.total);
});

test('invoice uses the billed coupon discount and discounted line GST', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 47.5);
  assert.equal(billed.total, 997.5);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(printed.total, billed.total);
});

test('invoice displays the billed total without a reconciliation warning', function () {
  const order = {
    id: 42,
    date: '21/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: '',
    subtotal: 100,
    tax: 5,
    total: 105,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }]
  };

  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
