const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Model checkout's saved lines: they carry HSN codes and omit gstRate.
const mixedItems = [
  { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 2 },
  { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 300, qty: 1 },
];

function figures(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ ...billed, items, coupon });
  return { billed, printed };
}

test('#1001 invoice applies 5% and 12% GST to the respective lines', () => {
  const { billed, printed } = figures(mixedItems);

  assert.deepEqual(billed.lines.map(line => line.gstPercent), [5, 12]);
  assert.equal(billed.tax, 46);
  assert.equal(billed.total, 546);

  assert.deepEqual(printed.rows.map(row => row.gstPercent), [5, 12]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [10, 36]);
  assert.equal(printed.subtotal, 500);
  assert.equal(printed.discount, 0);
  assert.equal(printed.tax, 46);
  assert.equal(printed.cgst, 23);
  assert.equal(printed.sgst, 23);
  assert.equal(printed.total, 546);
});

test('#1002 invoice applies SAVE10 before calculating GST', () => {
  const items = [mixedItems[0], { ...mixedItems[1], price: 400 }];
  const { billed, printed } = figures(items, 'SAVE10');

  assert.equal(billed.discount, 60);
  assert.equal(billed.tax, 52.2);
  assert.equal(billed.total, 592.2);

  assert.deepEqual(printed.rows.map(row => row.lineTax), [9, 43.2]);
  assert.equal(printed.subtotal, 600);
  assert.equal(printed.discount, 60);
  assert.equal(printed.tax, 52.2);
  assert.equal(printed.cgst, 26.1);
  assert.equal(printed.sgst, 26.1);
  assert.equal(printed.total, 592.2);
});

test('#1004 invoice applies the ₹150 SAVE10 cap', () => {
  const items = [{ ...mixedItems[1], price: 560, qty: 4 }];
  const { billed, printed } = figures(items, 'SAVE10');

  assert.equal(billed.subtotal, 2240);
  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 250.8);
  assert.equal(billed.total, 2340.8);

  assert.equal(printed.rows[0].gstPercent, 12);
  assert.equal(printed.rows[0].lineTax, 250.8);
  assert.equal(printed.subtotal, 2240);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 250.8);
  assert.equal(printed.cgst, 125.4);
  assert.equal(printed.sgst, 125.4);
  assert.equal(printed.total, 2340.8);
});

test('CURRENT BEHAVIOUR: #1008 invoice matches checkout for 18% items without a coupon', () => {
  const items = [
    { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', gstRate: 18, price: 100, qty: 2 },
    { id: 4, sku: 'COFFEE', name: 'Coffee', hsn: '0901', price: 300, qty: 1 },
  ];
  const { billed, printed } = figures(items);

  assert.deepEqual(printed.rows.map(row => row.gstPercent), [18, 18]);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [36, 54]);

  const expected = { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 };
  for (const key of Object.keys(expected)) {
    assert.equal(printed[key], expected[key], `Invoice ${key}`);
    assert.equal(billed[key], expected[key], `Checkout ${key}`);
  }
});

test('invoice matches the billed total and GST breakdown for a mixed-rate cart with capped SAVE10', () => {
  const items = [mixedItems[0], { ...mixedItems[1], price: 680, qty: 3 }];
  const { billed, printed } = figures(items, 'SAVE10');

  assert.deepEqual(
    [printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total],
    [billed.subtotal, billed.discount, billed.tax, billed.cgst, billed.sgst, billed.total],
  );
  assert.deepEqual(
    printed.rows.map(row => [row.gstPercent, row.lineTax]),
    billed.lines.map(line => [line.gstPercent, line.tax]),
  );
});

test('reprinting a saved invoice preserves the discount after its coupon is deactivated', () => {
  const items = [{ ...mixedItems[1], price: 1000 }];
  const order = { items, coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 96, total: 896 };
  assert.equal(pricing.computeTotals(items, order.coupon).discount, 0);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 200);
  assert.equal(printed.rows[0].lineTax, 96);
  assert.equal(printed.cgst, 48);
  assert.equal(printed.sgst, 48);
  assert.equal(printed.total, 896);
});
