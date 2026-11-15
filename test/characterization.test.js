var test = require('node:test');
var assert = require('node:assert/strict');

var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('characterization: coupon eligibility and caps follow the configured rules', function () {
  assert.deepEqual(coupons.validate(' save10 ', 499), {
    valid: false,
    error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500'
  });
  assert.equal(coupons.calculateDiscount(600, 'save10'), 60);
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.equal(coupons.calculateDiscount(30, 'FLAT50'), 0);
  assert.equal(coupons.calculateDiscount(300, 'FLAT50'), 50);
});

test('characterization: totals apportion discounts before applying per-HSN GST', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 33.3,
    cgst: 16.65,
    sgst: 16.65,
    total: 573.3,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 500, discount: 50, taxable: 450, tax: 22.5, net: 472.5 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 100, discount: 10, taxable: 90, tax: 10.8, net: 100.8 }
    ]
  });
});

test('characterization: inventory retains one sellable unit as a safety buffer', function () {
  var products = [{ id: 1, name: 'Rice', stock: 10, reserved: 2 }];
  assert.equal(inventory.getSellableStock(products[0]), 8);
  assert.equal(inventory.check(products, [{ id: 1, qty: 7 }]).ok, true);
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 8 }]), {
    ok: false,
    msg: 'Rice is out of stock (8 sellable available)'
  });
});

test('characterization: cancelling persisted order lines does not restore physical stock', function () {
  var db = {
    products: [{ id: 1, stock: 10, reserved: 2 }],
    orders: [{ id: 10, status: 'completed', items: [{ id: 1, qty: 3 }], paymentMode: 'cash' }]
  };

  assert.equal(orders.cancel(db, 10, 'test cancellation').ok, true);
  assert.equal(db.products[0].stock, 10);
  assert.equal(db.products[0].reserved, 2);
});

test('characterization: invoice resolves persisted HSN order lines with the POS GST slabs', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ];
  var pos = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: items
  });

  assert.deepEqual({ tax: pos.tax, cgst: pos.cgst, sgst: pos.sgst, total: pos.total }, {
    tax: 33.3,
    cgst: 16.65,
    sgst: 16.65,
    total: 573.3
  });
  assert.deepEqual({ tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total }, {
    tax: 33.3,
    cgst: 16.65,
    sgst: 16.65,
    total: 573.3
  });
  assert.deepEqual(printed.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
});

test('characterization: invoice applies the POS capped coupon before GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1, gstRate: 5 }];
  var pos = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ coupon: 'SAVE10', items: items });

  assert.deepEqual({ discount: pos.discount, tax: pos.tax, total: pos.total }, {
    discount: 150,
    tax: 92.5,
    total: 1942.5
  });
  assert.deepEqual({ discount: printed.discount, tax: printed.tax, total: printed.total }, {
    discount: 150,
    tax: 92.5,
    total: 1942.5
  });
});

test('characterization: GST reconciliation marks matching invoice and billed figures', function () {
  var db = {
    orders: [{
      id: 42,
      date: '2026-11-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      status: 'completed',
      subtotal: 600,
      discount: 60,
      tax: 33.3,
      total: 573.3,
      items: [
        { name: 'Rice', hsn: '1006', price: 500, qty: 1 },
        { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
      ]
    }]
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 42,
      date: '2026-11-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 600,
      ledgerDiscount: 60,
      ledgerTax: 33.3,
      ledgerTotal: 573.3,
      invoiceDiscount: 60,
      invoiceTax: 33.3,
      invoiceTotal: 573.3,
      delta: 0,
      matched: true
    }]
  });
});

test('invoice totals and GST breakdown match the amount billed for persisted HSN order lines', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Butter', hsn: '0405', price: 260, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures({ coupon: 'SAVE10', items: items });

  assert.deepEqual({
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total
  }, {
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
});
