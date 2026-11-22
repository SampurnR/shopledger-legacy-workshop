const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('Invoice figures match the billed HSN GST and coupon totals for a mixed-rate basket', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1000,
    items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.deepEqual(printed.rows.map((row) => [row.gstPercent, row.lineTax]), [
    [5, billed.lines[0].tax],
    [12, billed.lines[1].tax]
  ]);
});

test('Invoice computes HSN GST and applies the coupon using the order pricing rules', () => {
  const items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 1000,
    qty: 1
  }];

  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const printed = invoice.computeInvoiceFigures(order);

  // Order pricing uses 5% HSN GST after the ₹100 discount.
  assert.equal(billed.subtotal, 1000);
  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 45);
  assert.equal(billed.cgst, 22.5);
  assert.equal(billed.sgst, 22.5);
  assert.equal(billed.total, 945);

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.total, billed.total);
});

test('Invoice displays the billed total without a reconciliation warning when figures match', () => {
  const order = {
    id: 1002,
    date: '22/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: [{ name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 100,
    tax: 45,
    total: 945
  };

  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹945\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('Invoice and order totals agree at the fallback rate when no HSN slab matches', () => {
  const items = [{ name: 'Other item', hsn: '9999', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(billed.tax, 18);
  assert.equal(printed.tax, 18);
  assert.equal(billed.total, 118);
  assert.equal(printed.total, 118);
});
