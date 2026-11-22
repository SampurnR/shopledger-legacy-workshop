const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function orderWith(items, coupon = '') {
  return {
    id: 7,
    date: '01/04/2022',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    total: 0
  };
}

test('Invoice uses the billed HSN GST rate when no coupon is applied', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(orderWith(items));

  assert.equal(billed.tax, 32);
  assert.equal(printed.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});

test('Invoice uses the billed coupon discount and GST amounts', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(orderWith(items, 'SAVE10'));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 1000, discount: 100, tax: 45, total: 945 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('Invoice renders the billed order total without a false mismatch notice', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }];
  const order = orderWith(items);
  order.total = pricing.computeTotals(items, '').total;

  const html = invoice.render(order);

  assert.match(html, /Invoice Total[\s\S]*?672\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /672\.00/);
});

test('Invoice CGST and SGST match the billed GST split', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(orderWith(items));

  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
});

test('Invoice figures and line breakdown match the billed GST calculation', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(orderWith(items, 'SAVE10'));

  assert.equal(printed.subtotal, billed.subtotal);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.cgst, billed.cgst);
  assert.equal(printed.sgst, billed.sgst);
  assert.equal(printed.total, billed.total);
  assert.deepEqual(
    printed.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })),
    billed.lines.map(({ gstPercent, tax }) => ({ gstPercent, lineTax: tax }))
  );
});
