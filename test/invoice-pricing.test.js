'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function riceItem(price, qty) {
  return {
    id: 1,
    sku: 'RICE-1',
    name: 'Rice',
    hsn: '1006',
    price,
    qty
  };
}

function orderFrom(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '22/11/2026',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('Invoice figures use the billed HSN slab when gstRate is absent', () => {
  const order = orderFrom([riceItem(100, 1)]);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineGstPercent: invoiceFigures.rows[0].gstPercent,
      lineTax: invoiceFigures.rows[0].lineTax
    },
    {
      subtotal: order.subtotal,
      tax: order.tax,
      cgst: 2.5,
      sgst: 2.5,
      total: order.total,
      lineGstPercent: 5,
      lineTax: 5
    }
  );
});

test('Invoice coupon discount and GST breakdown match the billed totals', () => {
  const order = orderFrom([riceItem(100, 1)], 'WELCOME');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    },
    {
      discount: order.discount,
      tax: order.tax,
      cgst: 2.38,
      sgst: 2.37,
      total: order.total
    }
  );
});

test('Invoice applies the same coupon cap and HSN GST as order pricing', () => {
  const order = orderFrom([riceItem(6000, 1)], 'WHOLESALE15');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lineGstPercent: invoiceFigures.rows[0].gstPercent,
      lineTax: invoiceFigures.rows[0].lineTax
    },
    {
      discount: order.discount,
      tax: order.tax,
      cgst: 140,
      sgst: 140,
      total: order.total,
      lineGstPercent: 5,
      lineTax: 280
    }
  );
});

test('GST reconciliation reports a match when invoice figures equal the billed order', () => {
  const order = orderFrom([riceItem(100, 1)]);
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(
    {
      ledgerTax: result.rows[0].ledgerTax,
      invoiceTax: result.rows[0].invoiceTax,
      ledgerTotal: result.rows[0].ledgerTotal,
      invoiceTotal: result.rows[0].invoiceTotal,
      delta: result.rows[0].delta,
      matched: result.rows[0].matched
    },
    {
      ledgerTax: 5,
      invoiceTax: 5,
      ledgerTotal: 105,
      invoiceTotal: 105,
      delta: 0,
      matched: true
    }
  );
});
