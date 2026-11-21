var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

test('invoice applies HSN GST to discounted taxable value and matches the order total', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME', total: 99.75
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    rows: [{
      name: 'Rice', sku: 'RICE-1', hsn: '1006', qty: 1, price: 100,
      gstPercent: 5, line: 95, lineTax: 4.75
    }]
  });
});

test('billed pricing uses HSN GST and discounts taxable value before tax', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME'
  };

  assert.deepEqual(pricing.computeTotals(order.items, order.coupon), {
    subtotal: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    lines: [{
      id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
      gross: 100, discount: 5, taxable: 95, tax: 4.75, net: 99.75
    }]
  });
});

test('invoice uses HSN slab and discounts subtotal before tax', function () {
  var order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME', total: 99.75
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    rows: [{
      name: 'Rice', sku: '-', hsn: '1006', qty: 1, price: 100,
      gstPercent: 5, line: 95, lineTax: 4.75
    }]
  });
});

test('invoice and pricing interpret decimal gstRate values consistently', function () {
  var items = [{ name: 'Oil', hsn: '1512', price: 100, qty: 1, gstRate: 0.05 }];
  assert.equal(pricing.computeTotals(items, '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: items }).tax, 5);
});

test('rendered invoice agrees with the stored billed total', function () {
  var html = invoice.render({
    id: 7, date: '2026-11-21', status: 'completed', customer: 'Customer',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME', total: 99.75
  });

  assert.match(html, /GST %<\/th><th class="r">GST Amt/);
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹4\.75/);
  assert.match(html, /Coupon Discount \(WELCOME\)<\/td><td class="r" style="color:#16a34a">-₹5\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹99\.75/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('couponed invoice row shows the discounted taxable amount beside GST', function () {
  var order = {
    id: 8,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME',
    total: 99.75,
    tax: 4.75
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.rows[0].line, 95);
  assert.match(html, /₹95\.00<\/strong>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹99\.75/);
});

test('discounted invoice line gross matches billed taxable amount', function () {
  var order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME'
  };

  assert.equal(invoice.computeInvoiceFigures(order).rows[0].line, 95);
});
