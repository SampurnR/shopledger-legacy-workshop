const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice uses the same HSN GST as checkout when gstRate is omitted', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 10);
  assert.equal(billed.total, 210);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice uses checkout coupon discount and post-discount GST calculations', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 5 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.subtotal, 500);
  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 22.5);
  assert.equal(billed.total, 472.5);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('invoice applies the SAVE10 maxDiscount cap on a ₹2,240 subtotal', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2240, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.subtotal, 2240);
  assert.equal(billed.discount, 150);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('in-memory Order #1002 equivalent now matches reported checkout figures', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1020, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1002,
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.total, 963.9);
  assert.equal(billed.tax, 45.9);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, 963.9);
  assert.equal(printed.tax, 45.9);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('GST reconciliation reports matching invoice and stored order totals after calculation is unified', function () {
  const order = {
    id: 42,
    date: '21/11/2026',
    customer: 'Test customer',
    status: 'completed',
    coupon: 'SAVE10',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 5 }],
    subtotal: 500,
    discount: 50,
    tax: 22.5,
    total: 472.5
  };
  const result = reports.getGstReconciliation({
    orders: [order],
    products: [],
    customers: [],
    settlements: []
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 42,
    date: '21/11/2026',
    customer: 'Test customer',
    coupon: 'SAVE10',
    ledgerSubtotal: 500,
    ledgerDiscount: 50,
    ledgerTax: 22.5,
    ledgerTotal: 472.5,
    invoiceDiscount: 50,
    invoiceTax: 22.5,
    invoiceTotal: 472.5,
    delta: 0,
    matched: true
  });
});
