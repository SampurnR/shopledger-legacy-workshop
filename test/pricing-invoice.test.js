var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function assertInvoiceMatchesPricing(items, coupon) {
  var billed = pricing.computeTotals(items, coupon);
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: coupon });

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total,
    rows: printed.rows.map(function (row) {
      return { gstPercent: row.gstPercent, line: row.line, lineTax: row.lineTax };
    })
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    rows: billed.lines.map(function (line) {
      return { gstPercent: line.gstPercent, line: line.gross, lineTax: line.tax };
    })
  });
}

test('invoice total and GST breakdown match checkout for HSN GST', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }];
  assertInvoiceMatchesPricing(items, '');
});

test('invoice total and GST breakdown match checkout for SAVE10', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }];
  assertInvoiceMatchesPricing(items, 'SAVE10');
});

test('invoice total and GST breakdown match checkout when SAVE10 reaches its cap', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 3000, qty: 1 }];
  assertInvoiceMatchesPricing(items, 'SAVE10');
});

test('invoice total and GST breakdown match checkout for FLAT50', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 400, qty: 1 }];
  assertInvoiceMatchesPricing(items, 'FLAT50');
});
