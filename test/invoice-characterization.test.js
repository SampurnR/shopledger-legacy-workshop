'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const config = require('../config');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('CORRECT BEHAVIOUR: invoice figures match the GST breakdown and total billed by order pricing', function () {
  const cases = [
    {
      items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }],
      coupon: ''
    },
    {
      items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }],
      coupon: 'SAVE10'
    }
  ];

  for (const orderCase of cases) {
    const billed = pricing.computeTotals(orderCase.items, orderCase.coupon);
    const printed = invoice.computeInvoiceFigures({
      id: 1,
      items: orderCase.items,
      coupon: orderCase.coupon
    });

    assert.equal(printed.subtotal, billed.subtotal);
    assert.equal(printed.discount, billed.discount);
    assert.equal(printed.tax, billed.tax);
    assert.equal(printed.cgst, billed.cgst);
    assert.equal(printed.sgst, billed.sgst);
    assert.equal(printed.total, billed.total);
    assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
    assert.equal(printed.rows[0].lineTax, billed.lines[0].tax);
  }
});

test('invoice uses the same HSN GST slab as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];

  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ id: 1, items: items, coupon: '' });

  assert.equal(config.tax.hsnSlabs['1006'], 5);
  assert.equal(billed.subtotal, 100);
  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.total, 105);
});

test('invoice uses the same pre-tax coupon discount as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];

  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ id: 2, items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 60);
  assert.equal(billed.tax, 27);
  assert.equal(billed.total, 567);
  assert.equal(printed.discount, 60);
  assert.equal(printed.tax, 27);
  assert.equal(printed.total, 567);
});

test('invoice applies the same coupon maxDiscount cap as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }];

  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures({ id: 3, items: items, coupon: 'SAVE10' });

  assert.equal(config.coupons.SAVE10.maxDiscount, 150);
  assert.equal(billed.discount, 150);
  assert.equal(printed.discount, 150);
  assert.equal(billed.total, 1942.5);
  assert.equal(printed.tax, 92.5);
  assert.equal(printed.total, 1942.5);
});

test('rendered invoice shows the billed total without a reconciliation warning', function () {
  const order = {
    id: 42,
    date: '01/01/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: '',
    total: 105,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }]
  };

  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

