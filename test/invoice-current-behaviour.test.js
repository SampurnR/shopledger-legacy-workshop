var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function makeItem(hsn, price, qty) {
  return {
    id: 1,
    sku: 'SKU-1',
    name: 'In-memory test item',
    hsn: hsn,
    price: price,
    qty: qty
  };
}

function makeOrder(items, coupon) {
  return {
    id: 1002,
    items: items,
    coupon: coupon || ''
  };
}

test('invoice uses the configured 5% and 12% HSN rates', function () {
  var cases = [
    { hsn: '1006', checkoutTax: 5, checkoutTotal: 105 },
    { hsn: '0405', checkoutTax: 12, checkoutTotal: 112 }
  ];

  cases.forEach(function (example) {
    var items = [makeItem(example.hsn, 100, 1)];
    var checkout = pricing.computeTotals(items, '');
    var printedInvoice = invoice.computeInvoiceFigures(makeOrder(items, ''));

    assert.equal(checkout.tax, example.checkoutTax);
    assert.equal(checkout.total, example.checkoutTotal);
    assert.equal(printedInvoice.rows[0].gstPercent, example.checkoutTax);
    assert.equal(printedInvoice.tax, checkout.tax);
    assert.equal(printedInvoice.total, checkout.total);
  });
});

test('SAVE10 on a 5% HSN item matches checkout figures', function () {
  var items = [makeItem('1006', 1020, 1)];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.equal(checkout.discount, 102);
  assert.equal(checkout.tax, 45.9);
  assert.equal(checkout.total, 963.9);
  assert.equal(printedInvoice.discount, checkout.discount);
  assert.equal(printedInvoice.tax, checkout.tax);
  assert.equal(printedInvoice.total, checkout.total);
});

test('invoice enforces the SAVE10 maximum discount', function () {
  var items = [makeItem('0902', 2240, 1)];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.equal(checkout.discount, 150);
  assert.equal(printedInvoice.discount, checkout.discount);
  assert.equal(checkout.total, 2466.2);
  assert.equal(printedInvoice.total, checkout.total);
});

test('18% SAVE10 order uses the same discount and GST breakdown as checkout', function () {
  var items = [makeItem('0902', 1000, 1)];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.equal(checkout.total, 1062);
  assert.equal(printedInvoice.total, 1062);
  assert.equal(checkout.discount, 100);
  assert.equal(printedInvoice.discount, checkout.discount);
  assert.equal(checkout.tax, 162);
  assert.equal(printedInvoice.tax, checkout.tax);
});

test('18% item without a coupon matches checkout totals', function () {
  var items = [makeItem('0902', 100, 1)];
  var checkout = pricing.computeTotals(items, '');
  var printedInvoice = invoice.computeInvoiceFigures(makeOrder(items, ''));

  assert.equal(checkout.discount, 0);
  assert.equal(printedInvoice.discount, 0);
  assert.equal(checkout.tax, printedInvoice.tax);
  assert.equal(checkout.total, printedInvoice.total);
});

test('invoice shows checkout HSN rate and capped coupon breakdown', function () {
  var items = [makeItem('1006', 1020, 1)];
  var checkout = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures(makeOrder(items, 'SAVE10'));

  assert.deepEqual(
    {
      discount: printedInvoice.discount,
      tax: printedInvoice.tax,
      total: printedInvoice.total,
      gstPercent: printedInvoice.rows[0].gstPercent
    },
    {
      discount: checkout.discount,
      tax: checkout.tax,
      total: checkout.total,
      gstPercent: checkout.lines[0].gstPercent
    }
  );

  var html = invoice.render(makeOrder(items, 'SAVE10'));
  assert.match(html, /<th class="r">Discount<\/th>/);
  assert.match(html, /<th class="r">Taxable<\/th>/);
  assert.match(html, /₹918\.00/);
  assert.match(html, /₹45\.90/);
});
