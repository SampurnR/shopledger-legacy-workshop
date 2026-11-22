'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function makeItem(overrides) {
  return Object.assign({
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: '1006',
    price: 640,
    qty: 1
  }, overrides || {});
}

function makeOrder(items, coupon) {
  const orderPricing = pricing.computeTotals(items, coupon || '');
  return {
    id: 101,
    date: '22/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: orderPricing.subtotal,
    discount: orderPricing.discount,
    tax: orderPricing.tax,
    total: orderPricing.total
  };
}

test('invoice uses HSN slab when order line has no gstRate', function () {
  const items = [makeItem()];
  const printed = invoice.computeInvoiceFigures(makeOrder(items, ''));

  assert.deepEqual(
    { gstPercent: printed.rows[0].gstPercent, lineTax: printed.rows[0].lineTax,
      cgst: printed.cgst, sgst: printed.sgst, tax: printed.tax, total: printed.total },
    { gstPercent: 5, lineTax: 32, cgst: 16, sgst: 16, tax: 32, total: 672 }
  );
});

test('invoice uses the billed coupon allocation for GST and total', function () {
  const items = [makeItem({ price: 1000 }), makeItem({
    id: 2, sku: 'GHEE-001', name: 'Ghee', hsn: '0405', price: 500
  })];
  const printed = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.deepEqual(
    { discount: printed.discount, lineTaxes: printed.rows.map(function (row) { return row.lineTax; }),
      cgst: printed.cgst, sgst: printed.sgst, tax: printed.tax, total: printed.total },
    { discount: 150, lineTaxes: [45, 54], cgst: 49.5, sgst: 49.5, tax: 99, total: 1449 }
  );
});

test('GST reconciliation marks aligned invoice figures as matched', function () {
  const order = makeOrder([makeItem()], '');
  const db = { orders: [order] };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 101,
      date: '22/11/2026',
      customer: 'Test Customer',
      coupon: '',
      ledgerSubtotal: 640,
      ledgerDiscount: 0,
      ledgerTax: 32,
      ledgerTotal: 672,
      invoiceDiscount: 0,
      invoiceTax: 32,
      invoiceTotal: 672,
      delta: 0,
      matched: true
    }]
  });
});

test('rendered invoice omits the reconciliation warning when it matches billed total', function () {
  const html = invoice.render(makeOrder([makeItem()], ''));

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, />5%<\/td><td class="r">₹32\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹32\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00/);
});
