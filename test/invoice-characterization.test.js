const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('invoice figures match order pricing for HSN slabs', function () {
  const items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 100,
    qty: 2
  }];

  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual({ tax: invoiceFigures.tax, cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst, total: invoiceFigures.total }, {
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total
  });
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice figures use the same coupon cap and post-discount tax as order pricing', function () {
  const items = [{
    id: 2,
    name: 'Bulk rice',
    sku: 'RICE-BULK',
    hsn: '1006',
    price: 2000,
    qty: 1
  }];

  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual({ subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  assert.deepEqual(invoiceFigures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, tax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, tax: line.tax };
  }));
});

test('rendered invoice shows the billed total without a reconciliation warning', function () {
  const html = invoice.render({
    id: 1001,
    date: '2026-11-28',
    status: 'completed',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    coupon: '',
    subtotal: 200,
    discount: 0,
    tax: 10,
    total: 210,
    items: [{
      name: 'Rice',
      sku: 'RICE-1',
      hsn: '1006',
      price: 100,
      qty: 2
    }]
  });

  const grandTotal = html.match(/<tr class="grand"><td>Invoice Total<\/td><td class="r">.*?([0-9,]+\.\d{2})<\/td><\/tr>/);
  assert.ok(grandTotal);
  assert.equal(grandTotal[1], '210.00');
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
});
