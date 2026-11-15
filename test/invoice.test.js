var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the billed HSN GST and coupon figures', function () {
  // This mirrors the line saved by routes/orders.js: it stores HSN but no gstRate.
  var order = {
    id: 1001,
    total: 997.5,
    coupon: 'WELCOME',
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }]
  };

  var billed = pricing.computeTotals(order.items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 50, tax: 47.5, total: 997.5 }
  );
  assert.deepEqual(
    {
      subtotal: printed.subtotal,
      discount: printed.discount,
      tax: printed.tax,
      cgst: printed.cgst,
      sgst: printed.sgst,
      total: printed.total,
      gstPercent: printed.rows[0].gstPercent,
      lineTax: printed.rows[0].lineTax
    },
    { subtotal: 1000, discount: 50, tax: 47.5, cgst: 23.75, sgst: 23.75, total: 997.5, gstPercent: 5, lineTax: 47.5 }
  );

  var html = invoice.render(order);
  assert.match(html, /GST Amt<\/th>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹997\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies capped coupon discount before calculating GST', function () {
  var items = [{ id: 2, name: 'Tea', hsn: '0902', gstRate: 5, price: 3000, qty: 1 }];
  var order = { id: 1002, coupon: 'SAVE10', items: items };

  var billed = pricing.computeTotals(items, order.coupon);
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 150, tax: 142.5, total: 2992.5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 150, tax: 142.5, total: 2992.5 }
  );
  assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
});
