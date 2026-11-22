const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice matches the checkout total and GST breakdown for the billed order', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const order = {
    id: 1001,
    items,
    coupon: 'SAVE10',
    total: pricing.computeTotals(items, 'SAVE10').total
  };

  const checkout = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.total, checkout.total);
  assert.equal(invoiceFigures.tax, checkout.tax);
  assert.equal(invoiceFigures.cgst, checkout.cgst);
  assert.equal(invoiceFigures.sgst, checkout.sgst);
});

test('CURRENT BEHAVIOUR: checkout uses HSN GST and discounts before tax', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];

  const billed = pricing.computeTotals(items, 'SAVE10');

  assert.equal(billed.subtotal, 640);
  assert.equal(billed.discount, 64);
  assert.equal(billed.tax, 28.8);
  assert.equal(billed.cgst, 14.4);
  assert.equal(billed.sgst, 14.4);
  assert.equal(billed.total, 604.8);
});

test('invoice uses the same HSN rate and discount-before-tax calculation as checkout', () => {
  const order = {
    id: 1001,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: 'SAVE10',
    total: 604.8
  };

  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 28.8);
  assert.equal(invoiceFigures.cgst, 14.4);
  assert.equal(invoiceFigures.sgst, 14.4);
  assert.equal(invoiceFigures.discount, 64);
  assert.equal(invoiceFigures.total, order.total);
});

test('invoice honors the flat coupon minimum order', () => {
  const order = {
    items: [{ name: 'Tea', price: 100, qty: 1, gstRate: 5 }],
    coupon: 'FLAT50'
  };

  const checkout = pricing.computeTotals(order.items, 'FLAT50');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.discount, 0);
  assert.equal(invoiceFigures.discount, 0);
  assert.equal(invoiceFigures.total, checkout.total);
});

test('CURRENT BEHAVIOUR: GST reconciliation flags invoice variance and excludes cancelled orders', () => {
  const db = {
    orders: [
      {
        id: 1,
        date: '01/01/2022',
        items: [{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
        subtotal: 640,
        discount: 64,
        tax: 20,
        total: 600,
        coupon: 'SAVE10'
      },
      {
        id: 2,
        status: 'cancelled',
        items: [{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
        subtotal: 640,
        discount: 0,
        tax: 32,
        total: 672
      }
    ]
  };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 4.8);
  assert.equal(result.rows[0].orderId, 1);
  assert.equal(result.rows[0].invoiceTax, 28.8);
  assert.equal(result.rows[0].matched, false);
});
