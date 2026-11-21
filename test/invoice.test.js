const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function compare(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  const order = { id: 1, items, coupon, ...billed };
  return { billed, printed: invoice.computeInvoiceFigures(order), order };
}

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('printable invoice matches a mixed-rate checkout with FLAT50', () => {
  const { order } = compare([
    { name: 'Rice', hsn: '1006', price: 50, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ], 'FLAT50');
  const html = invoice.render(order);
  assert.equal(Number(html.match(/Invoice Total<\/td><td class="r">₹([\d.]+)/)[1]), order.total);
  assert.equal(Number(html.match(/Total GST\)<\/td><td class="r">₹([\d.]+)/)[1]), order.tax);
  assert.match(html, /5%<\/td><td class="r">₹4\.17</);
  assert.match(html, /12%<\/td><td class="r">₹20\.00</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('an odd paisa goes to CGST at checkout and on the invoice', () => {
  const { billed, printed, order } = compare([{ price: 10.05, qty: 1, hsn: '0902' }]);
  const expected = { subtotal: 10.05, discount: 0, tax: 1.81, cgst: 0.91, sgst: 0.90, total: 11.86 };
  assert.deepEqual(amounts(billed), expected);
  assert.deepEqual(amounts(printed), expected);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies the rice and ghee HSN slabs', () => {
  const { billed, printed, order } = compare([
    { name: 'Rice', hsn: '1006', price: 50, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ]);
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[5, 5], [12, 24]]);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [12, 24]]);
  assert.deepEqual(amounts(billed), { subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329 });
  assert.deepEqual(amounts(printed), { subtotal: 300, discount: 0, tax: 29, cgst: 14.5, sgst: 14.5, total: 329 });
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹29\.00/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹329\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('SAVE10 discounts the taxable amount before GST', () => {
  const { billed, printed, order } = compare([{ price: 500, qty: 1, gstRate: 18 }], 'SAVE10');
  assert.deepEqual(amounts(billed), { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 });
  assert.deepEqual(amounts(printed), { subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a flat discount reduces invoice GST', () => {
  const { billed, printed } = compare([{ price: 300, qty: 1, gstRate: 18 }], 'FLAT50');
  assert.deepEqual(amounts(billed), { subtotal: 300, discount: 50, tax: 45, cgst: 22.5, sgst: 22.5, total: 295 });
  assert.deepEqual(amounts(printed), { subtotal: 300, discount: 50, tax: 45, cgst: 22.5, sgst: 22.5, total: 295 });
});

// Historical order fixtures can carry codes that checkout would reject today.
for (const [description, coupon, price, discount, total] of [
  ['honours the SAVE10 cap', 'SAVE10', 2000, 150, 2183],
  ['ignores expired DIWALI20', 'DIWALI20', 1000, 0, 1180],
  ['ignores FLAT50 below its minimum', 'FLAT50', 10, 0, 11.8],
  ['normalizes a coupon code', ' welcome ', 100, 5, 112.1]
]) {
  test('invoice ' + description, () => {
    const { billed, printed } = compare([{ price, qty: 1, gstRate: 18 }], coupon);
    assert.equal(billed.discount, discount);
    assert.equal(printed.discount, discount);
    assert.equal(printed.total, total);
  });
}

test('invoice preserves zero and fractional GST rates', () => {
  const { billed, printed } = compare([
    { price: 100, qty: 1, gstRate: 0 },
    { price: 100, qty: 1, gstRate: 0.05 }
  ]);
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[0, 0], [5, 5]]);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[0, 0], [5, 5]]);
});

test('invoice sums individually rounded line taxes', () => {
  const { billed, printed, order } = compare([
    { price: 0.02, qty: 1, gstRate: 18 },
    { price: 0.02, qty: 1, gstRate: 18 }
  ]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0, 0]);
  assert.deepEqual(amounts(billed), { subtotal: 0.04, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0.04 });
  assert.deepEqual(amounts(printed), { subtotal: 0.04, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0.04 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a historical invoice keeps the billed totals when GST rules have changed', () => {
  const order = {
    items: [{ name: 'Rice', price: 100, qty: 1, hsn: '1006' }],
    subtotal: 100, discount: 0, tax: 18, total: 118
  };
  const html = invoice.render(order);
  assert.match(html, /Total GST\)<\/td><td class="r">₹18\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹118\.00/);
  assert.match(html, /Line GST details are unavailable/);
  assert.doesNotMatch(html, /5%<\/td>/);
});

test('matching historical totals still label the line GST as reconstructed', () => {
  // Swapping these two rates would leave the recorded ₹17 GST unchanged.
  const order = {
    items: [
      { price: 100, qty: 1, hsn: '1006' },
      { price: 100, qty: 1, hsn: '0405' }
    ],
    subtotal: 200, discount: 0, tax: 17, total: 217
  };
  const html = invoice.render(order);
  assert.match(html, /GST % \(reconstructed\)/);
  assert.match(html, /GST Amt \(reconstructed\)/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹17\.00/);
});

test('a total-only ledger discrepancy keeps the recorded total and shows a notice', () => {
  const { order } = compare([{ price: 100, qty: 1, hsn: '0902' }]);
  order.total = 117;
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹117\.00/);
  assert.match(html, /billed components add up to ₹118\.00/);
  assert.match(html, /18%<\/td><td class="r">₹18\.00</);
});
