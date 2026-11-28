const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

const rice = {
  id: 1,
  sku: 'RICE-1',
  name: 'Rice',
  hsn: '1006',
  price: 100,
  qty: 1
};

test('checkout applies 5% rice GST to a ₹100 order', () => {
  const checkout = pricing.computeTotals([rice], '');

  assert.equal(checkout.tax, 5);
  assert.equal(checkout.cgst, 2.5);
  assert.equal(checkout.sgst, 2.5);
  assert.equal(checkout.total, 105);
});

test('invoice applies 5% HSN GST for a saved rice line', () => {
  const order = { items: [rice], coupon: '', subtotal: 100, discount: 0, tax: 5, total: 105 };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.cgst, 2.5);
  assert.equal(printed.sgst, 2.5);
  assert.equal(printed.total, 105);
});

test('invoice uses the saved SAVE10 discount cap and post-discount GST', () => {
  const items = [{ ...rice, qty: 20 }];
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const order = { ...checkout, items, coupon: 'SAVE10' };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 92.5);
  assert.equal(checkout.total, 1942.5);
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
});

test('invoice shows the same total and GST as the saved rice order', () => {
  const order = {
    id: 1, items: [rice], coupon: '', subtotal: 100, discount: 0, tax: 5, total: 105
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([printed.tax, printed.total], [5, 105]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹105\.00/);
});

test('invoice keeps historical billed totals and flags a different reconstructed GST', () => {
  const order = {
    id: 2, items: [rice], coupon: '', subtotal: 100, discount: 0, tax: 6, total: 106
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([printed.tax, printed.total], [6, 106]);
  assert.match(invoice.render(order), /Reconstructed line GST \(₹5\.00\).*recorded at checkout \(₹6\.00\)/);
});
