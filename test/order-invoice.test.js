'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR — order totals apply HSN GST after coupon discount', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];
  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.subtotal, 600);
  assert.equal(totals.discount, 60);
  assert.equal(totals.taxable, 540);
  assert.equal(totals.tax, 27);
  assert.equal(totals.cgst, 13.5);
  assert.equal(totals.sgst, 13.5);
  assert.equal(totals.total, 567);
  assert.deepEqual(totals.lines[0], {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    gstPercent: 5,
    gross: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    net: 567
  });
});

test('CURRENT BEHAVIOUR — invoice uses HSN GST when item gstRate is absent', function () {
  const order = {
    id: 1001,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }],
    coupon: ''
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 600);
  assert.equal(figures.tax, 30);
  assert.equal(figures.cgst, 15);
  assert.equal(figures.sgst, 15);
  assert.equal(figures.total, 630);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR — invoice with SAVE10 uses order pricing discount and tax', function () {
  const order = {
    id: 1002,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }],
    coupon: 'SAVE10'
  };
  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 60);
  assert.equal(billed.tax, 27);
  assert.equal(billed.total, 567);
  assert.equal(figures.discount, 60);
  assert.equal(figures.tax, 27);
  assert.equal(figures.total, 567);
});

test('CURRENT BEHAVIOUR — GST reconciliation matches in-memory order and invoice figures', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const db = {
    products: [],
    customers: [],
    orders: [{
      id: 1003,
      date: '22/11/2026',
      customer: 'Test customer',
      status: 'completed',
      coupon: 'SAVE10',
      items: items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].invoiceTax, 27);
  assert.equal(reconciliation.rows[0].ledgerTax, 27);
  assert.equal(reconciliation.rows[0].invoiceTotal, 567);
  assert.equal(reconciliation.rows[0].ledgerTotal, 567);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});

test('invoice matches the total and GST figures used to bill an HSN-rated coupon order', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 600, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.equal(figures.rows[0].gstPercent, billed.lines[0].gstPercent);
});

test('CURRENT BEHAVIOUR — invoice matches the reported order and GST audit examples', async function (t) {
  const cases = [
    {
      id: 1001,
      coupon: '',
      items: [
        { id: 1, name: 'Packaged tea', hsn: '0902', price: 140, qty: 2 },
        { id: 2, name: 'Toor dal', hsn: '0713', price: 165, qty: 2 }
      ],
      expected: { subtotal: 610, discount: 0, tax: 66.9, total: 676.9, rates: [18, 5] }
    },
    {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
        { id: 2, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
      ],
      expected: { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9, rates: [5, 5] }
    },
    {
      id: 1004,
      coupon: 'SAVE10',
      items: [
        { id: 1, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }
      ],
      expected: { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5, rates: [5] }
    },
    {
      id: 1007,
      coupon: '',
      items: [
        { id: 1, name: 'Ghee', hsn: '0405', price: 450, qty: 2 },
        { id: 2, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
      ],
      expected: { subtotal: 1280, discount: 0, tax: 127, total: 1407, rates: [12, 5] }
    },
    {
      id: 1008,
      coupon: '',
      items: [
        { id: 1, name: 'Packaged tea', hsn: '0902', price: 140, qty: 1 },
        { id: 2, name: 'Sherbet concentrate', hsn: '2106', price: 180, qty: 2 }
      ],
      expected: { subtotal: 500, discount: 0, tax: 90, total: 590, rates: [18, 18] }
    }
  ];

  await Promise.all(cases.map(function (order) {
    return t.test('order #' + order.id, function () {
      const billed = pricing.computeTotals(order.items, order.coupon);
      const figures = invoice.computeInvoiceFigures(order);

      assert.equal(billed.subtotal, order.expected.subtotal);
      assert.equal(billed.discount, order.expected.discount);
      assert.equal(billed.tax, order.expected.tax);
      assert.equal(billed.total, order.expected.total);
      assert.equal(figures.subtotal, order.expected.subtotal);
      assert.equal(figures.discount, order.expected.discount);
      assert.equal(figures.tax, order.expected.tax);
      assert.equal(figures.cgst, billed.cgst);
      assert.equal(figures.sgst, billed.sgst);
      assert.equal(figures.total, order.expected.total);
      assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), order.expected.rates);
      assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), billed.lines.map(function (line) { return line.tax; }));
    });
  }));
});
