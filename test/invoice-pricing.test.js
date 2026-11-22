const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice figures match the billed HSN rate and capped SAVE10 discount', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ];
  const order = { items, coupon: 'SAVE10' };

  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      gstPercent: invoiceFigures.rows[0].gstPercent,
      lineTax: invoiceFigures.rows[0].lineTax
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      gstPercent: billed.lines[0].gstPercent,
      lineTax: billed.lines[0].tax
    }
  );
  assert.equal(invoiceFigures.total, 1942.5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});
test('invoice applies WELCOME discount to taxable value before GST, matching billing', () => {
  const items = [
    { id: 2, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ];
  const order = { items, coupon: 'WELCOME' };

  const billed = pricing.computeTotals(items, 'WELCOME');
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 5, tax: 4.75, total: 99.75 }
  );
});

test('rendered invoice shows a reconciliation notice when its recomputed total differs from the stored billed total', () => {
  const html = invoice.render({
    id: 3,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    items: [
      { id: 3, name: 'Rice', hsn: '1006', sku: 'RICE-1', price: 100, qty: 1 }
    ],
    coupon: '',
    total: 104
  });

  assert.match(html, /Invoice computed total/);
  assert.match(html, /differs from Order Ledger recorded total/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
});

