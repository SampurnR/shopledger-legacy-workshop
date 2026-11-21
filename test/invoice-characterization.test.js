var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice uses the item HSN GST slab recorded by order pricing', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var order = { items: items, coupon: '' };
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 10);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice uses the same coupon allocation and totals as order pricing', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var order = { items: items, coupon: 'WELCOME' };
  var billed = pricing.computeTotals(items, 'WELCOME');
  var invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 200, discount: 10, tax: 9.5, total: 199.5 }
  );
  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      total: invoiceFigures.total,
      rowLine: invoiceFigures.rows[0].line,
      rowDiscount: invoiceFigures.rows[0].discount,
      rowTaxable: invoiceFigures.rows[0].taxable,
      rowTax: invoiceFigures.rows[0].lineTax
    },
    { subtotal: 200, discount: 10, tax: 9.5, total: 199.5, rowLine: 200, rowDiscount: 10, rowTaxable: 190, rowTax: 9.5 }
  );
});
