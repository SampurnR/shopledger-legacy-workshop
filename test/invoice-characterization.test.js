var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function riceOrder(overrides) {
  return Object.assign({
    id: 41,
    date: '2026-11-28',
    customer: 'In-memory customer',
    status: 'completed',
    paymentMode: 'cash',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: '',
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  }, overrides || {});
}

test('CURRENT BEHAVIOUR: invoice defaults stored HSN-only lines to 18% instead of checkout HSN slab', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 18);
  assert.equal(printed.tax, 18);
  assert.equal(printed.total, 118);
});

test('CURRENT BEHAVIOUR: invoice coupon calculation is uncapped and discounts subtotal plus tax', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 45);
  assert.equal(billed.total, 945);
  assert.equal(printed.discount, 118);
  assert.equal(printed.tax, 180);
  assert.equal(printed.total, 1062);
});

test('CURRENT BEHAVIOUR: reconciliation reports the recalculated invoice mismatch for an HSN order', function () {
  var order = riceOrder();
  var result = reports.getGstReconciliation({ orders: [order], products: [], customers: [], settlements: [] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.deepEqual(result.rows[0], {
    orderId: 41,
    date: '2026-11-28',
    customer: 'In-memory customer',
    coupon: '',
    ledgerSubtotal: 100,
    ledgerDiscount: 0,
    ledgerTax: 5,
    ledgerTotal: 105,
    invoiceDiscount: 0,
    invoiceTax: 18,
    invoiceTotal: 118,
    delta: 13,
    matched: false
  });
});
