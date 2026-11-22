var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function lineItem(price, qty, hsn) {
  return {
    id: 1,
    sku: 'RICE-001',
    name: 'Rice',
    hsn: hsn || '1006',
    price: price,
    qty: qty
  };
}

function invoiceOrder(items, coupon, total) {
  return {
    id: 1001,
    date: '22/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    total: total
  };
}

test('invoice matches the ledger HSN slab when gstRate is absent', function () {
  var items = [lineItem(250, 2)];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures(invoiceOrder(items, '', billed.total));

  assert.deepEqual(printed, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    taxable: billed.taxable,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    rows: [{
      name: 'Rice',
      sku: 'RICE-001',
      hsn: '1006',
      qty: 2,
      price: 250,
      gstPercent: 5,
      line: 500,
      lineTax: 25
    }]
  });
});

test('invoice matches the ledger coupon base and maxDiscount cap', function () {
  var items = [lineItem(3000, 1)];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var printed = invoice.computeInvoiceFigures(invoiceOrder(items, 'SAVE10', billed.total));

  assert.deepEqual(printed, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    taxable: billed.taxable,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    rows: [{
      name: 'Rice',
      sku: 'RICE-001',
      hsn: '1006',
      qty: 1,
      price: 3000,
      gstPercent: 5,
      line: 3000,
      lineTax: 142.5
    }]
  });
});

test('rendered invoice shows the ledger CGST and SGST amounts separately', function () {
  var items = [lineItem(250, 2)];
  var billed = pricing.computeTotals(items, '');
  var html = invoice.render(invoiceOrder(items, '', billed.total));

  assert.match(html, /<td>CGST<\/td><td class="r">[^<]*12\.50<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">[^<]*12\.50<\/td>/);
});
