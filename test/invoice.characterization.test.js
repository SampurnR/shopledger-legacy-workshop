var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');

function historicalOrder() {
  return {
    id: 71,
    date: '2026-11-20',
    customer: 'Fixture Customer',
    paymentMode: 'cash',
    coupon: 'WELCOME',
    items: [
      { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 140, qty: 1 },
      { id: 3, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
    ],
    // These are the figures persisted when this customer was billed.
    subtotal: 1230,
    discount: 72.57,
    tax: 221.4,
    total: 1378.83
  };
}

test('invoice figures use item HSN rates and apportion the WELCOME coupon', function () {
  var figures = invoice.computeInvoiceFigures(historicalOrder());

  assert.deepEqual(figures, {
    subtotal: 1230,
    discount: 61.5,
    tax: 105.64,
    cgst: 52.82,
    sgst: 52.82,
    total: 1274.14,
    rows: [
      {
        name: 'Rice', sku: 'RICE-1', hsn: '1006', qty: 1, price: 640,
        gstPercent: 5, line: 640, lineDiscount: 32, taxable: 608,
        lineTax: 30.4, net: 638.4
      },
      {
        name: 'Tea', sku: 'TEA-1', hsn: '0902', qty: 1, price: 140,
        gstPercent: 18, line: 140, lineDiscount: 7, taxable: 133,
        lineTax: 23.94, net: 156.94
      },
      {
        name: 'Ghee', sku: 'GHEE-1', hsn: '0405', qty: 1, price: 450,
        gstPercent: 12, line: 450, lineDiscount: 22.5, taxable: 427.5,
        lineTax: 51.3, net: 478.8
      }
    ]
  });
});

test('CURRENT BEHAVIOUR: invoice figures ignore persisted billed total and GST', function () {
  var order = historicalOrder();
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 1378.83);
  assert.equal(order.tax, 221.4);
  assert.equal(figures.total, 1274.14);
  assert.equal(figures.tax, 105.64);
  assert.notEqual(figures.total, order.total);
  assert.notEqual(figures.tax, order.tax);
});

test('CURRENT BEHAVIOUR: printable invoice aggregates GST and warns about the billed mismatch', function () {
  var html = invoice.render(historicalOrder());

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹105\.64<\/td>/);
  assert.doesNotMatch(html, /CGST \(₹52\.82\)/);
  assert.doesNotMatch(html, /SGST \(₹52\.82\)/);
  assert.match(
    html,
    /Invoice computed total \(₹1274\.14\) differs from Order Ledger recorded total \(₹1378\.83\) by -₹104\.69\./
  );
});
