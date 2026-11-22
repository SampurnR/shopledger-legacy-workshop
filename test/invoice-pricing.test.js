const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: reported order 1002 invoice matches capped SAVE10 and 5% HSN GST billed', () => {
  const order = {
    id: 1002,
    items: [
      { id: 1, name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
  };

  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 28.8], [5, 17.1]]);
});

test('CURRENT BEHAVIOUR: reported order 1004 invoice matches SAVE10 cap and groundnut oil HSN GST', () => {
  const order = {
    id: 1004,
    items: [{ id: 5, name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 104.5);
});

test('CURRENT BEHAVIOUR: invoice and GST reconciliation agree for mixed HSN slabs and capped coupon orders', () => {
  const db = {
    orders: [
      {
        id: 1001, status: 'completed', items: [
          { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 2 },
          { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2 }
        ], coupon: '', subtotal: 610, discount: 0, tax: 66.9, total: 676.9
      },
      {
        id: 1002, status: 'completed', items: [
          { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
          { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
        ], coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
      },
      {
        id: 1004, status: 'completed', items: [
          { id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }
        ], coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5
      },
      {
        id: 1007, status: 'pending', items: [
          { id: 6, name: 'Ghee', hsn: '0405', price: 450, qty: 2 },
          { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
        ], coupon: '', subtotal: 1280, discount: 0, tax: 127, total: 1407
      },
      {
        id: 1008, status: 'completed', items: [
          { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1 },
          { id: 12, name: 'Sherbet', hsn: '2106', price: 180, qty: 2 }
        ], coupon: '', subtotal: 500, discount: 0, tax: 90, total: 590
      }
    ]
  };

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 5);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.ok(reconciliation.rows.every(function (row) { return row.matched; }));
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

