var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function item(name, price, qty, hsn, gstRate) {
  return {
    name: name,
    price: price,
    qty: qty,
    hsn: hsn,
    gstRate: gstRate
  };
}

function calculate(order) {
  return {
    invoice: invoice.computeInvoiceFigures(order),
    checkout: pricing.computeTotals(order.items, order.coupon)
  };
}

test('CURRENT BEHAVIOUR: #1001 invoice uses explicit 5% and 12% item GST without a coupon', function () {
  var order = {
    coupon: '',
    items: [
      item('A2 Gir Cow Ghee 500ml', 450, 1, '0405', 12),
      item('Unpolished Toor Dal 1kg', 165, 2, '0713', 5)
    ]
  };
  var result = calculate(order);

  assert.deepEqual(result.invoice, {
    subtotal: 780,
    discount: 0,
    tax: 70.5,
    cgst: 35.25,
    sgst: 35.25,
    total: 850.5,
    rows: [
      { name: 'A2 Gir Cow Ghee 500ml', sku: '-', hsn: '0405', qty: 1, price: 450, gstPercent: 12, line: 450, lineTax: 54 },
      { name: 'Unpolished Toor Dal 1kg', sku: '-', hsn: '0713', qty: 2, price: 165, gstPercent: 5, line: 330, lineTax: 16.5 }
    ]
  });
  assert.equal(result.invoice.total, result.checkout.total);
  assert.equal(result.invoice.tax, result.checkout.tax);
});

test('CURRENT BEHAVIOUR: #1002 SAVE10 applies its discount before per-line GST', function () {
  var order = {
    coupon: 'SAVE10',
    items: [
      item('Indrayani Basmati Rice 5kg', 640, 1, '1006', 5),
      item('Cold-Pressed Sunflower Oil 1L', 190, 2, '1512', 5)
    ]
  };
  var result = calculate(order);

  assert.deepEqual(result.invoice, {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { name: 'Indrayani Basmati Rice 5kg', sku: '-', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Cold-Pressed Sunflower Oil 1L', sku: '-', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
  assert.equal(result.checkout.discount, 102);
  assert.equal(result.checkout.tax, 45.9);
  assert.equal(result.invoice.total, result.checkout.total);
  assert.equal(result.invoice.tax, result.checkout.tax);
});

test('CURRENT BEHAVIOUR: #1004 SAVE10 honours the configured 150 rupee coupon cap', function () {
  var order = {
    coupon: 'SAVE10',
    items: [
      item('Cold-Pressed Groundnut Oil 5L', 1120, 2, '1508', 5)
    ]
  };
  var result = calculate(order);

  assert.deepEqual(result.invoice, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [
      { name: 'Cold-Pressed Groundnut Oil 5L', sku: '-', hsn: '1508', qty: 2, price: 1120, gstPercent: 5, line: 2240, lineTax: 104.5 }
    ]
  });
  assert.equal(result.checkout.discount, 150);
  assert.equal(result.checkout.tax, 104.5);
  assert.equal(result.checkout.total, 2194.5);
  assert.equal(result.invoice.total, result.checkout.total);
});

test('CURRENT BEHAVIOUR: #1008 all-18% items without a coupon match checkout totals', function () {
  var order = {
    coupon: '',
    items: [
      item('Assam CTC Masala Chai 250g', 140, 1, '0902', 18),
      item('Kokum Sherbet Concentrate 750ml', 180, 2, '2106', 18)
    ]
  };
  var result = calculate(order);

  assert.deepEqual(result.invoice, {
    subtotal: 500,
    discount: 0,
    tax: 90,
    cgst: 45,
    sgst: 45,
    total: 590,
    rows: [
      { name: 'Assam CTC Masala Chai 250g', sku: '-', hsn: '0902', qty: 1, price: 140, gstPercent: 18, line: 140, lineTax: 25.2 },
      { name: 'Kokum Sherbet Concentrate 750ml', sku: '-', hsn: '2106', qty: 2, price: 180, gstPercent: 18, line: 360, lineTax: 64.8 }
    ]
  });
  assert.equal(result.invoice.total, result.checkout.total);
  assert.equal(result.invoice.tax, result.checkout.tax);
});

test('invoice matches checkout for #1004 HSN GST and capped SAVE10 discount', function () {
  var order = {
    coupon: 'SAVE10',
    items: [
      item('Cold-Pressed Groundnut Oil 5L', 1120, 2, '1508', 5)
    ]
  };
  var result = calculate(order);

  assert.deepEqual(result.invoice, {
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5,
    rows: [
      { name: 'Cold-Pressed Groundnut Oil 5L', sku: '-', hsn: '1508', qty: 2, price: 1120, gstPercent: 5, line: 2240, lineTax: 104.5 }
    ]
  });
  assert.deepEqual(result.invoice, {
    subtotal: result.checkout.subtotal,
    discount: result.checkout.discount,
    tax: result.checkout.tax,
    cgst: result.checkout.cgst,
    sgst: result.checkout.sgst,
    total: result.checkout.total,
    rows: result.invoice.rows
  });
});
