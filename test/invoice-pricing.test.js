'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// These fixtures intentionally stay in memory. They mirror the item/order
// shapes built by routes/orders.js without reading or writing data/db.json.
function riceItem(price, qty) {
  return {
    id: 1,
    sku: 'GRN-001',
    name: 'Indrayani Basmati Rice 5kg',
    hsn: '1006',
    price: price,
    qty: qty
  };
}

function billedOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1001,
    date: '28/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('CURRENT BEHAVIOUR: order pricing applies HSN GST after the coupon discount', function () {
  const totals = pricing.computeTotals([riceItem(600, 1)], 'SAVE10');

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
      subtotal: 600,
      discount: 60,
      taxable: 540,
      tax: 27,
      cgst: 13.5,
      sgst: 13.5,
      total: 567,
      line: {
        id: 1,
        name: 'Indrayani Basmati Rice 5kg',
        hsn: '1006',
        gstPercent: 5,
        gross: 600,
        discount: 60,
        taxable: 540,
        tax: 27,
        net: 567
      }
    }
  );
});

test('invoice total and GST breakdown match the billed order', function () {
  const order = billedOrder([riceItem(640, 1)], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      invoiceSubtotal: figures.subtotal,
      invoiceDiscount: figures.discount,
      invoiceTax: figures.tax,
      invoiceCgst: figures.cgst,
      invoiceSgst: figures.sgst,
      invoiceTotal: figures.total,
      invoiceLineGstPercent: figures.rows[0].gstPercent,
      invoiceLineTax: figures.rows[0].lineTax,
      billedSubtotal: order.subtotal,
      billedDiscount: order.discount,
      billedTax: order.tax,
      billedTotal: order.total
    },
    {
      invoiceSubtotal: 640,
      invoiceDiscount: 64,
      invoiceTax: 28.8,
      invoiceCgst: 14.4,
      invoiceSgst: 14.4,
      invoiceTotal: 604.8,
      invoiceLineGstPercent: 5,
      invoiceLineTax: 28.8,
      billedSubtotal: 640,
      billedDiscount: 64,
      billedTax: 28.8,
      billedTotal: 604.8
    }
  );
});

test('invoice coupon discount respects the configured maximum and matches the billed total', function () {
  const order = billedOrder([riceItem(2000, 1)], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.total, 1942.5);
  assert.equal(figures.total, order.total);
});

test('stored billed amounts remain the invoice summary when a historical coupon is inactive', function () {
  const order = {
    ...billedOrder([riceItem(2000, 1)], 'DIWALI20'),
    discount: 250,
    tax: 87.5,
    total: 1837.5
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst + figures.sgst, order.tax);
  assert.equal(figures.total, order.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, order.tax);
});

test('GST reconciliation reports the in-memory billed order as matched', function () {
  const order = billedOrder([riceItem(600, 1)], 'SAVE10');
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 27);
  assert.equal(result.rows[0].invoiceTax, 27);
  assert.equal(result.rows[0].ledgerTotal, 567);
  assert.equal(result.rows[0].invoiceTotal, 567);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
