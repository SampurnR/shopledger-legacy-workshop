const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('REGRESSION: mixed HSN rates match the checkout GST', function () {
  const result = invoice.computeInvoiceFigures({
    items: [
      { name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
      { name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
    ]
  });

  assert.equal(result.tax, 66.9);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [18, 5]);
  assert.equal(result.total, 676.9);
});

test('REGRESSION: SAVE10 discounts the subtotal and calculates GST after discount', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [
      { name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  });

  assert.equal(result.discount, 102);
  assert.equal(result.tax, 45.9);
  assert.equal(result.total, 963.9);
});

test('REGRESSION: SAVE10 honors its configured maximum discount', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [
      { name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
    ]
  });

  assert.equal(result.discount, 150);
  assert.equal(result.tax, 104.5);
  assert.equal(result.total, 2194.5);
});

test('CURRENT BEHAVIOUR: 18% only items without a coupon match the checkout total', function () {
  const result = invoice.computeInvoiceFigures({
    items: [
      { name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
      { name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
    ]
  });

  assert.equal(result.tax, 90);
  assert.equal(result.total, 590);
});

test('REGRESSION: order 1007 combines 12% ghee and 5% sunflower oil GST', function () {
  const result = invoice.computeInvoiceFigures({
    items: [
      { name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
      { name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  });

  assert.equal(result.tax, 127);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [12, 5]);
  assert.equal(result.total, 1407);
});
