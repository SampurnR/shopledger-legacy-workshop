const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function figures(items, coupon = '') {
  return {
    printed: invoice.computeInvoiceFigures({ items, coupon }),
    billed: pricing.computeTotals(items, coupon)
  };
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('REGRESSION: #1001 invoice uses mixed HSN slabs', () => {
  const { printed, billed } = figures([
    { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 2 }
  ]);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [12, 24]]);
  assert.deepEqual(amounts(printed), { subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329 });
  assert.equal(billed.total, 329);
});

test('REGRESSION: #1002 invoice applies SAVE10 before GST', () => {
  const { printed, billed } = figures([
    { name: 'Tea', hsn: '0902', price: 250, qty: 2 }
  ], 'SAVE10');
  assert.deepEqual(amounts(printed), { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 });
  assert.equal(printed.rows[0].lineTax, 81);
  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 81);
  assert.equal(billed.total, 531);
});

test('REGRESSION: #1004 invoice honours the SAVE10 cap', () => {
  const { printed, billed } = figures([
    { name: 'Coffee', hsn: '0901', gstRate: 18, price: 560, qty: 4 }
  ], 'SAVE10');
  assert.deepEqual(amounts(printed), { subtotal: 2240, discount: 150, tax: 376.2, cgst: 188.1, sgst: 188.1, total: 2466.2 });
  assert.equal(printed.rows[0].lineTax, 376.2);
  assert.equal(billed.discount, 150);
  assert.equal(billed.total, 2466.2);
});

test('CURRENT BEHAVIOUR: #1008 invoice agrees for all-18% lines with no coupon', () => {
  const { printed, billed } = figures([
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 },
    { name: 'Coffee', hsn: '0901', gstRate: 18, price: 100, qty: 2 }
  ]);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[18, 18], [18, 36]]);
  assert.deepEqual(amounts(printed), { subtotal: 300, discount: 0, tax: 54, cgst: 27, sgst: 27, total: 354 });
  assert.deepEqual(amounts(printed), amounts(billed));
});

test('invoice matches checkout for mixed HSN slabs and a capped SAVE10 coupon', () => {
  const items = [
    { name: 'Rice', hsn: '1006', price: 120, qty: 10 },
    { name: 'Ghee', hsn: '0405', price: 520, qty: 2 }
  ];
  const { printed, billed } = figures(items, 'SAVE10');

  assert.equal(billed.subtotal, 2240);
  assert.equal(billed.discount, 150);
  assert.deepEqual(amounts(printed), amounts(billed));
  assert.deepEqual(
    printed.rows.map(row => [row.gstPercent, row.lineTax]),
    [[5, 55.98], [12, 116.44]]
  );

  const reprint = invoice.render({ ...billed, id: 1, items, coupon: 'RETIRED' });
  assert.match(reprint, /Coupon Discount \(RETIRED\)<\/td><td[^>]*>-₹150\.00/);
  assert.match(reprint, /Total GST\)<\/td><td[^>]*>₹172\.42/);
  assert.match(reprint, /Invoice Total<\/td><td[^>]*>₹2262\.42/);
});
