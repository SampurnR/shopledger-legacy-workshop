'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice figures match the checkout calculation for mixed GST slabs and a coupon', function () {
  const order = makeOrder([
    { id: 10, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 },
    { id: 11, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 100, qty: 1 }
  ], 'WELCOME');

  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: invoiced.subtotal,
      discount: invoiced.discount,
      tax: invoiced.tax,
      cgst: invoiced.cgst,
      sgst: invoiced.sgst,
      total: invoiced.total,
      rowTaxes: invoiced.rows.map(function (row) { return row.lineTax; })
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      rowTaxes: billed.lines.map(function (line) { return line.tax; })
    }
  );
});

function makeOrder(items, coupon) {
  const billed = pricing.computeTotals(items, coupon || '');
  return {
    id: 42,
    date: '22/11/2026',
    status: 'completed',
    customer: 'Test Customer',
    paymentMode: 'cash',
    coupon: coupon || '',
    items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('invoice applies the order line HSN GST slab when no gstRate is stored', function () {
  const order = makeOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);

  const billed = pricing.computeTotals(order.items, '');
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, tax: billed.tax, total: billed.total },
    { subtotal: 100, tax: 5, total: 105 }
  );
  assert.deepEqual(
    {
      subtotal: invoiced.subtotal,
      tax: invoiced.tax,
      cgst: invoiced.cgst,
      sgst: invoiced.sgst,
      total: invoiced.total,
      lineGstPercent: invoiced.rows[0].gstPercent
    },
    {
      subtotal: 100,
      tax: 5,
      cgst: 2.5,
      sgst: 2.5,
      total: 105,
      lineGstPercent: 5
    }
  );
});

test('invoice applies percentage coupon to subtotal before GST, matching the order', function () {
  const order = makeOrder([
    { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');

  const billed = pricing.computeTotals(order.items, 'WELCOME');
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 100, discount: 5, tax: 4.75, total: 99.75 }
  );
  assert.deepEqual(
    {
      subtotal: invoiced.subtotal,
      discount: invoiced.discount,
      tax: invoiced.tax,
      total: invoiced.total
    },
    { subtotal: 100, discount: 5, tax: 4.75, total: 99.75 }
  );
});

test('invoice line GST reflects the prorated coupon discount', function () {
  const order = makeOrder([
    { id: 3, name: 'Tea', sku: 'TEA-2', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');

  const invoiced = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual(
    {
      lineGross: invoiced.rows[0].line,
      lineTax: invoiced.rows[0].lineTax,
      invoiceDiscount: invoiced.discount,
      invoiceTotal: invoiced.total
    },
    { lineGross: 100, lineTax: 4.75, invoiceDiscount: 5, invoiceTotal: 99.75 }
  );
  assert.match(html, /<th class="r">GST Amt<\/th>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.equal(html.includes('CGST: ₹9.00'), false);
  assert.equal(html.includes('Invoice computed total'), false);
});

test('invoice accepts gstRate as a fraction', function () {
  const order = {
    items: [
      { name: 'Fraction rate item', hsn: '1006', price: 100, qty: 1, gstRate: 0.05 }
    ],
    coupon: ''
  };

  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.tax, 5);
  assert.equal(invoiced.total, 105);
});



