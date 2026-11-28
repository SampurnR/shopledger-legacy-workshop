const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice figures match the order totals billed by pricing', function () {
  const order = {
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10'
  };
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice uses the same HSN slab as the billed order', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  const ledgerFigures = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(ledgerFigures.tax, 5);
  assert.equal(ledgerFigures.total, 105);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
});

test('invoice applies the billed coupon before calculating GST', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  const ledgerFigures = pricing.computeTotals(items, 'WELCOME');
  const invoiceFigures = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual(
    { discount: ledgerFigures.discount, tax: ledgerFigures.tax, total: ledgerFigures.total },
    { discount: 5, tax: 4.75, total: 99.75 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 5, tax: 4.75, total: 99.75 }
  );
});

test('invoice honors the SAVE10 maximum discount cap on mixed HSN items', function () {
  const items = [
    { id: 1, name: 'Groundnut oil', hsn: '1508', price: 2240, qty: 1 }
  ];
  const order = { items: items, coupon: 'SAVE10' };
  const billed = pricing.computeTotals(items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.total, billed.total);
});

test('invoice totals use the same per-line tax rounding as billed totals', function () {
  const items = [
    { id: 1, name: 'A', gstRate: 5, price: 0.05, qty: 1 },
    { id: 2, name: 'B', gstRate: 5, price: 0.05, qty: 1 }
  ];
  const figures = invoice.computeInvoiceFigures({ items: items });

  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0, 0]);
  assert.equal(figures.tax, 0);
  assert.equal(figures.cgst, 0);
  assert.equal(figures.sgst, 0);
});

test('GST reconciliation matches orders priced with the same HSN rules', function () {
  const order = {
    id: 17,
    date: '2026-11-28',
    customer: 'In-memory customer',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(
    { ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax, ledgerTotal: result.rows[0].ledgerTotal, invoiceTotal: result.rows[0].invoiceTotal, delta: result.rows[0].delta },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0 }
  );
});

test('rendered invoice total matches the recorded billed total', function () {
  const html = invoice.render({
    id: 18,
    date: '2026-11-28',
    customer: 'In-memory customer',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    total: 105
  });

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
