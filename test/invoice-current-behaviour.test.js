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

test('CURRENT BEHAVIOUR: invoice defaults missing line GST rates to 18% instead of resolving HSN slabs', function () {
  var lowRateOrder = order(1001, [item('Rice', '1006', 100, 1)]);
  var midRateOrder = order(1007, [item('Ghee', '0405', 100, 1)]);
  var highRateOrder = order(1008, [item('Tea', '0902', 100, 1)]);

  assert.equal(pricing.computeTotals(lowRateOrder.items, '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures(lowRateOrder).rows[0].gstPercent, 18);
  assert.equal(invoice.computeInvoiceFigures(lowRateOrder).tax, 18);
  assert.equal(pricing.computeTotals(midRateOrder.items, '').tax, 12);
  assert.equal(invoice.computeInvoiceFigures(midRateOrder).rows[0].gstPercent, 18);
  assert.equal(invoice.computeInvoiceFigures(midRateOrder).tax, 18);
  assert.equal(pricing.computeTotals(highRateOrder.items, '').tax, 18);
  assert.equal(invoice.computeInvoiceFigures(highRateOrder).tax, 18);
  assert.equal(invoice.computeInvoiceFigures(highRateOrder).total, highRateOrder.total);
});

test('CURRENT BEHAVIOUR: invoice calculates coupon on subtotal plus GST and ignores coupon caps', function () {
  var oil = item('Groundnut oil', '1508', 1120, 2);
  var billed = order(1004, [oil], 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures(billed);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 264.32, tax: 403.2, total: 2378.88 }
  );
});

test('CURRENT BEHAVIOUR: reconciliation flags the invoice figures against stored ledger totals', function () {
  var mismatched = order(1001, [item('Rice', '1006', 100, 1)]);
  var matching = order(1008, [item('Tea', '0902', 100, 1)]);
  var result = reports.getGstReconciliation({ orders: [mismatched, matching] });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 18);
  assert.equal(result.rows[1].matched, true);
});

test('CURRENT BEHAVIOUR: rendered invoice shows computed figures and a ledger mismatch notice', function () {
  var billed = order(1004, [item('Groundnut oil', '1508', 1120, 2)], 'SAVE10');
  var html = invoice.render(billed);

  assert.match(html, /GST %<\/th>/);
  assert.match(html, /18%/);
  assert.match(html, /2378\.88/);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /differs from Order Ledger recorded total/);
});

