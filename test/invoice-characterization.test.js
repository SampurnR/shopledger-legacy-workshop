var test = require('node:test');
var assert = require('node:assert/strict');


var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderFromCheckout(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return {
    id: 41,
    date: '2026-11-21',
    customer: 'In-memory customer',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN GST slab when a line has no gstRate', function () {
  var order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], '');

  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: order.tax, total: order.total },
    { tax: 5, total: 105 }
  );
  assert.deepEqual(
    { tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies a percent coupon to taxable totals before GST', function () {
  var order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 500, qty: 1 }
  ], 'WELCOME');

  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: order.discount, tax: order.tax, total: order.total },
    { discount: 75, tax: 104.5, total: 1529.5 }
  );
  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { discount: 75, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 1529.5 }
  );
});

test('GST reconciliation reports the invoice and billed order as matched', function () {
  var order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], '');

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(reconciliation, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 41,
      date: '2026-11-21',
      customer: 'In-memory customer',
      coupon: '',
      ledgerSubtotal: 100,
      ledgerDiscount: 0,
      ledgerTax: 5,
      ledgerTotal: 105,
      invoiceDiscount: 0,
      invoiceTax: 5,
      invoiceTotal: 105,
      delta: 0,
      matched: true
    }]
  });
});

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

var items = [
  { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
  { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 1000, qty: 1 }
];

function billedOrder() {
  var ledgerFigures = pricing.computeTotals(items, 'SAVE10');
  return {
    id: 41,
    date: '2026-11-21',
    customer: 'Example Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: 'SAVE10',
    items: items,
    subtotal: ledgerFigures.subtotal,
    discount: ledgerFigures.discount,
    tax: ledgerFigures.tax,
    total: ledgerFigures.total
  };
}

test('order pricing applies capped coupon to subtotal and HSN GST to discounted lines', function () {
  var figures = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(figures, {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 212.75,
    cgst: 106.38,
    sgst: 106.37,
    total: 2062.75,
    lines: [
      {
        id: 1,
        name: 'Rice',
        hsn: '1006',
        gstPercent: 5,
        gross: 1000,
        discount: 75,
        taxable: 925,
        tax: 46.25,
        net: 971.25
      },
      {
        id: 2,
        name: 'Tea',
        hsn: '0902',
        gstPercent: 18,
        gross: 1000,
        discount: 75,
        taxable: 925,
        tax: 166.5,
        net: 1091.5
      }
    ]
  });
});

test('invoice figures match checkout pricing for HSN GST and coupon discount', function () {
  var order = billedOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 212.75);
  assert.equal(order.total, 2062.75);

  assert.deepEqual(figures, {
    subtotal: 2000,
    discount: 150,
    tax: 212.75,
    cgst: 106.38,
    sgst: 106.37,
    total: 2062.75,
    rows: [
      {
        name: 'Rice',
        sku: 'RICE-1',
        hsn: '1006',
        qty: 1,
        price: 1000,
        gstPercent: 5,
        line: 1000,
        lineTax: 46.25
      },
      {
        name: 'Tea',
        sku: 'TEA-1',
        hsn: '0902',
        qty: 1,
        price: 1000,
        gstPercent: 18,
        line: 1000,
        lineTax: 166.5
      }
    ]
  });
});

test('GST reconciliation reports matching invoice and ledger totals', function () {
  var order = billedOrder();
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(result, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [
      {
        orderId: 41,
        date: '2026-11-21',
        customer: 'Example Customer',
        coupon: 'SAVE10',
        ledgerSubtotal: 2000,
        ledgerDiscount: 150,
        ledgerTax: 212.75,
        ledgerTotal: 2062.75,
        invoiceDiscount: 150,
        invoiceTax: 212.75,
        invoiceTotal: 2062.75,
        delta: 0,
        matched: true
      }
    ]
  });
});

test('rendered invoice shows checkout GST, coupon discount, and ledger total without a mismatch', function () {
  var html = invoice.render(billedOrder());

  assert.match(html, /GST %<\/th><th class="r">GST Amt/);
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td class="r">18%<\/td><td class="r">₹166\.50<\/td>/);
  assert.match(html, /<td>CGST \+ SGST \(Total GST\)<\/td><td class="r">₹212\.75<\/td>/);
  assert.match(html, /<td class="r" style="color:#16a34a">-₹150\.00<\/td>/);
  assert.match(html, /<td>Invoice Total<\/td><td class="r">₹2062\.75<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

