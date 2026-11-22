var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');

function riceLine(price, qty) {
  return {
    id: 1,
    sku: 'RICE-01',
    name: 'Rice',
    hsn: '1006',
    price: price,
    qty: qty
  };
}

test('invoice uses the HSN GST rate and applies the coupon before tax', function () {
  var items = [riceLine(100, 10)];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({
    id: 9001,
    items: items,
    coupon: 'SAVE10',
    total: ledger.total
  });

  assert.deepEqual(ledger, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 1000,
      discount: 100,
      taxable: 900,
      tax: 45,
      net: 945
    }]
  });

  assert.deepEqual(printedInvoice, {
    subtotal: 1000,
    discount: 100,
    tax: 45,
    cgst: 22.5,
    sgst: 22.5,
    total: 945,
    rows: [{
      name: 'Rice',
      sku: 'RICE-01',
      hsn: '1006',
      qty: 10,
      price: 100,
      gstPercent: 5,
      line: 1000,
      lineTax: 45
    }]
  });
});

test('invoice applies the SAVE10 maximum discount just like checkout', function () {
  var items = [riceLine(500, 10)];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({
    id: 9002,
    items: items,
    coupon: 'SAVE10',
    total: ledger.total
  });

  assert.equal(ledger.discount, 150);
  assert.equal(ledger.tax, 242.5);
  assert.equal(ledger.total, 5092.5);

  assert.equal(printedInvoice.discount, 150);
  assert.equal(printedInvoice.tax, 242.5);
  assert.equal(printedInvoice.total, 5092.5);
});

test('rendered invoice has no reconciliation notice when its computed total matches the billed total', function () {
  var order = {
    id: 9003,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [riceLine(100, 10)],
    coupon: 'SAVE10',
    total: 945
  };

  var html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses the same GST and coupon calculation as the billed order', function () {
  var items = [riceLine(500, 10)];
  var ledger = pricing.computeTotals(items, 'SAVE10');
  var printedInvoice = invoice.computeInvoiceFigures({
    id: 9004,
    items: items,
    coupon: 'SAVE10',
    total: ledger.total
  });

  assert.equal(printedInvoice.tax, ledger.tax);
  assert.equal(printedInvoice.discount, ledger.discount);
  assert.equal(printedInvoice.total, ledger.total);
  assert.equal(printedInvoice.rows[0].gstPercent, ledger.lines[0].gstPercent);
});
