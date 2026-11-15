var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function item(name, hsn, price, qty) {
  return { name: name, hsn: hsn, sku: 'TEST-1', price: price, qty: qty };
}

function order(id, items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: id,
    date: '2022-01-30',
    customer: 'In-memory customer',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN GST rates for every line', function () {
  var lowRateOrder = order(1001, [item('Rice', '1006', 100, 1)]);
  var midRateOrder = order(1007, [item('Ghee', '0405', 100, 1)]);
  var highRateOrder = order(1008, [item('Tea', '0902', 100, 1)]);

  assert.equal(pricing.computeTotals(lowRateOrder.items, '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures(lowRateOrder).rows[0].gstPercent, 5);
  assert.equal(invoice.computeInvoiceFigures(lowRateOrder).tax, lowRateOrder.tax);
  assert.equal(pricing.computeTotals(midRateOrder.items, '').tax, 12);
  assert.equal(invoice.computeInvoiceFigures(midRateOrder).rows[0].gstPercent, 12);
  assert.equal(invoice.computeInvoiceFigures(midRateOrder).tax, midRateOrder.tax);
  assert.equal(pricing.computeTotals(highRateOrder.items, '').tax, 18);
  assert.equal(invoice.computeInvoiceFigures(highRateOrder).tax, 18);
  assert.equal(invoice.computeInvoiceFigures(highRateOrder).total, highRateOrder.total);
});

test('invoice uses the billed coupon discount and post-discount GST', function () {
  var oil = item('Groundnut oil', '1508', 1120, 2);
  var billed = order(1004, [oil], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(billed);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice interprets decimal gstRate values consistently with pricing', function () {
  var decimalRateItem = {
    name: 'Explicit five percent item',
    sku: 'TEST-RATE',
    hsn: '1006',
    price: 100,
    qty: 1,
    gstRate: 0.05
  };
  var billed = order(1009, [decimalRateItem]);
  var invoiceFigures = invoice.computeInvoiceFigures(billed);

  assert.equal(pricing.computeTotals(billed.items, '').tax, 5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice displays separate CGST and SGST amounts', function () {
  var billed = order(1010, [item('Groundnut oil', '1508', 1120, 2)], 'SAVE10');
  var html = invoice.render(billed);

  assert.match(html, /<td>CGST<\/td>/);
  assert.match(html, /<td>SGST<\/td>/);
  assert.match(html, /CGST<\/td><td class="r">₹52\.25/);
  assert.match(html, /SGST<\/td><td class="r">₹52\.25/);
  assert.doesNotMatch(html, /CGST \+ SGST \(Total GST\)/);
});

test('invoice GST breakdown and total match the amounts billed to the customer', function () {
  var billed = order(1004, [item('Groundnut oil', '1508', 1120, 2)], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(billed);

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 104.5);
});

test('GST reconciliation matches invoice figures with stored ledger totals', function () {
  var mismatched = order(1001, [item('Rice', '1006', 100, 1)]);
  var matching = order(1008, [item('Tea', '0902', 100, 1)]);
  var result = reports.getGstReconciliation({ orders: [mismatched, matching] });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[1].matched, true);
});

test('rendered invoice shows billed figures without a mismatch notice', function () {
  var billed = order(1004, [item('Groundnut oil', '1508', 1120, 2)], 'SAVE10');
  var html = invoice.render(billed);

  assert.match(html, /GST %<\/th>/);
  assert.match(html, /5%/);
  assert.match(html, /2194\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});
