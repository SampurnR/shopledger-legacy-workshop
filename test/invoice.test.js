var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

// This is the line-item shape routes/orders.js stores: it has HSN, but no gstRate.
function makeItem(price, hsn) {
  return {
    id: 1,
    sku: 'TEST-001',
    name: 'Test Rice',
    hsn: hsn || '1006',
    price: price,
    qty: 1
  };
}

function makeOrder(item, values) {
  values = values || {};
  return {
    id: 42,
    date: '22/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    items: [item],
    coupon: values.coupon || '',
    subtotal: values.subtotal,
    discount: values.discount,
    tax: values.tax,
    total: values.total
  };
}

test('invoice uses the billed HSN slab and GST split', function () {
  var item = makeItem(100, '1006');
  var billed = pricing.computeTotals([item], '');
  var invoiceFigures = invoice.computeInvoiceFigures(makeOrder(item, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }));

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    lineGstPercent: invoiceFigures.rows[0].gstPercent,
    lineTax: invoiceFigures.rows[0].lineTax
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    lineGstPercent: billed.lines[0].gstPercent,
    lineTax: billed.lines[0].tax
  });
});

test('invoice uses the billed coupon cap and post-discount GST', function () {
  var item = makeItem(3000, '1006');
  var billed = pricing.computeTotals([item], 'WHOLESALE15');
  var invoiceFigures = invoice.computeInvoiceFigures(makeOrder(item, {
    coupon: 'WHOLESALE15',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }));

  assert.equal(billed.discount, 400);
  assert.equal(billed.tax, 130);
  assert.equal(billed.cgst, 65);
  assert.equal(billed.sgst, 65);
  assert.equal(billed.total, 2730);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('rendered invoice shows billed GST and total without a mismatch notice', function () {
  var item = makeItem(100, '1006');
  var billed = pricing.computeTotals([item], '');
  var html = invoice.render(makeOrder(item, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }));

  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.match(html, /5\.00/);
  assert.match(html, /105\.00/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('in-memory GST reconciliation matches invoice figures to the billed order', function () {
  var item = makeItem(100, '1006');
  var billed = pricing.computeTotals([item], '');
  var order = makeOrder(item, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  var result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
