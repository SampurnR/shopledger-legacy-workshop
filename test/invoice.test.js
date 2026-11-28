const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice matches the customer-billed totals and HSN GST breakdown', function () {
  const items = [
    { id: 8, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 140, qty: 2 },
    { id: 2, name: 'Dal', sku: 'GRN-002', hsn: '0713', price: 165, qty: 2 }
  ];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [18, 5]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [50.4, 16.5]);
});

test('CURRENT BEHAVIOUR: order pricing uses HSN GST and applies coupon discount before tax', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }];
  const priced = pricing.computeTotals(items, 'WHOLESALE15');

  assert.deepEqual(
    { subtotal: priced.subtotal, discount: priced.discount, tax: priced.tax, total: priced.total },
    { subtotal: 2000, discount: 300, tax: 85, total: 1785 }
  );
});

test('invoice applies the order pricing HSN slab and coupon discount', function () {
  const order = {
    id: 1001,
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }],
    coupon: 'WHOLESALE15',
    subtotal: 2000,
    discount: 300,
    tax: 85,
    total: 1785
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 2000, discount: 300, tax: 85, cgst: 42.5, sgst: 42.5, total: 1785 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice preserves recorded totals when current coupon configuration would recalculate them differently', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 2000,
    discount: 250,
    tax: 87.5,
    total: 1837.5
  });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 2000, discount: 250, tax: 87.5, cgst: 43.75, sgst: 43.75, total: 1837.5 }
  );
  assert.equal(figures.rows[0].lineTax, 87.5);
});

test('reconciliation matches invoice figures with order totals for in-memory data', function () {
  const db = {
    orders: [{
      id: 1001,
      date: '01/04/2021',
      customer: 'Test Customer',
      items: [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 2000, qty: 1 }],
      coupon: 'WHOLESALE15',
      subtotal: 2000,
      discount: 300,
      tax: 85,
      total: 1785
    }]
  };
  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(
    { invoiceDiscount: result.rows[0].invoiceDiscount, invoiceTax: result.rows[0].invoiceTax, invoiceTotal: result.rows[0].invoiceTotal, delta: result.rows[0].delta, matched: result.rows[0].matched },
    { invoiceDiscount: 300, invoiceTax: 85, invoiceTotal: 1785, delta: 0, matched: true }
  );
});

test('invoice interprets decimal gstRate as a decimal rate', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', price: 100, qty: 1, gstRate: 0.05 }]
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
});
