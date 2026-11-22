const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function figures({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

function invoiceLineTaxes(rows) {
  return rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax }));
}

test('CURRENT BEHAVIOUR: #1001 invoice uses the 5% and 12% HSN slabs', () => {
  const items = [
    { id: 2, name: 'Toor dal', price: 165, qty: 2, hsn: '0713' },
    { id: 6, name: 'Ghee', price: 280, qty: 1, hsn: '0405' },
  ];
  const coupon = '';

  const printed = invoice.computeInvoiceFigures({ items, coupon });
  const checkout = pricing.computeTotals(items, coupon);

  assert.deepEqual(figures(printed), {
    subtotal: 610, discount: 0, tax: 50.10, cgst: 25.05, sgst: 25.05, total: 660.10,
  });
  assert.deepEqual(invoiceLineTaxes(printed.rows), [
    { gstPercent: 5, lineTax: 16.50 },
    { gstPercent: 12, lineTax: 33.60 },
  ]);
  assert.deepEqual(figures(checkout), {
    subtotal: 610, discount: 0, tax: 50.10, cgst: 25.05, sgst: 25.05, total: 660.10,
  });
  assert.deepEqual(checkout.lines.map(line => line.gstPercent), [5, 12]);
});

test('CURRENT BEHAVIOUR: #1002 invoice applies SAVE10 before GST', () => {
  const items = [
    { id: 1, name: 'Rice', price: 640, qty: 1, hsn: '1006' },
    { id: 4, name: 'Sunflower oil', price: 190, qty: 2, hsn: '1512' },
  ];
  const coupon = 'SAVE10';

  const printed = invoice.computeInvoiceFigures({ items, coupon });
  const checkout = pricing.computeTotals(items, coupon);

  assert.deepEqual(figures(printed), {
    subtotal: 1020, discount: 102, tax: 45.90, cgst: 22.95, sgst: 22.95, total: 963.90,
  });
  assert.deepEqual(invoiceLineTaxes(printed.rows), [
    { gstPercent: 5, lineTax: 28.80 },
    { gstPercent: 5, lineTax: 17.10 },
  ]);
  assert.deepEqual(figures(checkout), {
    subtotal: 1020, discount: 102, tax: 45.90, cgst: 22.95, sgst: 22.95, total: 963.90,
  });
});

test('CURRENT BEHAVIOUR: #1004 invoice caps SAVE10 on a 2240 subtotal', () => {
  const items = [
    { id: 5, name: 'Groundnut oil', price: 560, qty: 4, hsn: '1508' },
  ];
  const coupon = 'SAVE10';

  const printed = invoice.computeInvoiceFigures({ items, coupon });
  const checkout = pricing.computeTotals(items, coupon);

  assert.deepEqual(figures(printed), {
    subtotal: 2240, discount: 150, tax: 104.50, cgst: 52.25, sgst: 52.25, total: 2194.50,
  });
  assert.deepEqual(invoiceLineTaxes(printed.rows), [
    { gstPercent: 5, lineTax: 104.50 },
  ]);
  assert.deepEqual(figures(checkout), {
    subtotal: 2240, discount: 150, tax: 104.50, cgst: 52.25, sgst: 52.25, total: 2194.50,
  });
});

test('CURRENT BEHAVIOUR: #1008 invoice matches checkout for 18% items without a coupon', () => {
  const items = [
    { id: 8, name: 'Tea', price: 140, qty: 2, hsn: '0902' },
    { id: 9, name: 'Coffee', price: 220, qty: 1, hsn: '0901', gstRate: 18 },
  ];
  const coupon = '';

  const printed = invoice.computeInvoiceFigures({ items, coupon });
  const checkout = pricing.computeTotals(items, coupon);

  assert.deepEqual(figures(printed), {
    subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590,
  });
  assert.deepEqual(invoiceLineTaxes(printed.rows), [
    { gstPercent: 18, lineTax: 50.40 },
    { gstPercent: 18, lineTax: 39.60 },
  ]);
  assert.deepEqual(figures(checkout), figures(printed));
});

test('invoice matches checkout for mixed GST slabs and capped SAVE10', () => {
  const items = [
    { id: 1, name: 'Rice', price: 500, qty: 2, hsn: '1006' },
    { id: 6, name: 'Ghee', price: 620, qty: 2, hsn: '0405' },
  ];
  const coupon = 'SAVE10';
  const checkout = pricing.computeTotals(items, coupon);
  const order = { id: 1, items, coupon, ...figures(checkout) };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures(printed), {
    subtotal: 2240, discount: 150, tax: 185.49, cgst: 92.75, sgst: 92.74, total: 2275.49,
  });
  assert.deepEqual(figures(printed), figures(checkout));
  assert.deepEqual(invoiceLineTaxes(printed.rows), [
    { gstPercent: 5, lineTax: 46.65 },
    { gstPercent: 12, lineTax: 138.84 },
  ]);
  assert.match(invoice.render(order), /₹2275\.49/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
