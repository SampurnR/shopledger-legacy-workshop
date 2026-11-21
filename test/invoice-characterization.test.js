const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const coupons = require('../lib/coupons');
const reports = require('../lib/reports');

test('invoice adapter preserves row metadata, gross amount and input objects', () => {
  const order = { coupon: 'SAVE10', items: [
    { name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 500, qty: 2 }
  ] };
  const before = structuredClone(order);
  assert.deepEqual(invoice.computeInvoiceFigures(order).rows, [
    { name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 500, qty: 2,
      gstPercent: 18, line: 1000, lineTax: 162 }
  ]);
  assert.deepEqual(order, before);
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('invoice calculates a standard order without a coupon', () => {
  const result = invoice.computeInvoiceFigures({ items: [
    { name: 'Tea', hsn: '0902', price: 100, qty: 2, gstRate: 18 }
  ] });
  assert.deepEqual({ subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total },
  { subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236 });
  assert.equal(result.rows[0].gstPercent, 18);
  assert.equal(result.rows[0].lineTax, 36);
});

test('absent invoice gstRate resolves 5%, 12% and 18% HSN slabs', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  const bill = invoice.computeInvoiceFigures({ items });
  const order = pricing.computeTotals(items, '');
  assert.deepEqual(items.map(tax.getRateForItem), [0.05, 0.12, 0.18]);
  assert.deepEqual(order.lines.map(line => line.gstPercent), [5, 12, 18]);
  assert.deepEqual(order.lines.map(line => line.tax), [5, 12, 18]);
  assert.deepEqual(bill.rows.map(row => row.gstPercent), [5, 12, 18]);
  assert.deepEqual(bill.rows.map(row => row.lineTax), [5, 12, 18]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.cgst, order.sgst, order.total], [300, 0, 35, 17.5, 17.5, 335]);
  assert.deepEqual([bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, bill.total], [300, 0, 35, 17.5, 17.5, 335]);
});

test('invoice honors zero and decimal gstRate consistently with pricing', () => {
  const items = [
    { name: 'Zero', hsn: '1006', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal', hsn: '1006', price: 100, qty: 1, gstRate: 0.05 }
  ];
  const bill = invoice.computeInvoiceFigures({ items });
  const order = pricing.computeTotals(items, '');
  assert.deepEqual(bill.rows.map(row => row.lineTax), [0, 5]);
  assert.deepEqual(order.lines.map(line => line.tax), [0, 5]);
  assert.deepEqual([bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, bill.total], [200, 0, 5, 2.5, 2.5, 205]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.cgst, order.sgst, order.total], [200, 0, 5, 2.5, 2.5, 205]);
});

test('SAVE10 invoice discounts taxable value before calculating tax', () => {
  const items = [{ id: 1, name: 'Tea', hsn: '0902', price: 1000, qty: 1 }];
  const bill = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });
  const order = pricing.computeTotals(items, 'SAVE10');
  assert.equal(coupons.validate(' save10 ', 1000).discount, 100);
  assert.deepEqual([bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, bill.total], [1000, 100, 162, 81, 81, 1062]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.cgst, order.sgst, order.total], [1000, 100, 162, 81, 81, 1062]);
  assert.deepEqual([order.lines[0].discount, order.lines[0].taxable, order.lines[0].tax], [100, 900, 162]);
});

test('invoice applies SAVE10 cap consistently with order pricing', () => {
  const items = [{ id: 1, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  const bill = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });
  const order = pricing.computeTotals(items, 'SAVE10');
  assert.equal(coupons.calculateDiscount(2000, 'SAVE10'), 150);
  assert.deepEqual([bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, bill.total], [2000, 150, 333, 166.5, 166.5, 2183]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.cgst, order.sgst, order.total], [2000, 150, 333, 166.5, 166.5, 2183]);
});

test('invoice rejects inactive or below-minimum configured coupon discounts', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  assert.equal(coupons.validate('SAVE10', 100).valid, false);
  assert.equal(coupons.validate('DIWALI20', 100).valid, false);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' }).discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(pricing.computeTotals(items, 'SAVE10').discount, 0);
  assert.equal(pricing.computeTotals(items, 'DIWALI20').discount, 0);
});

test('invoice rounds each line consistently with pricing and splits odd tax paise', () => {
  const items = [
    { id: 1, name: 'A', hsn: '0902', price: 0.03, qty: 1 },
    { id: 2, name: 'B', hsn: '0902', price: 0.03, qty: 1 }
  ];
  const bill = invoice.computeInvoiceFigures({ items });
  const order = pricing.computeTotals(items, '');
  assert.deepEqual(bill.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, bill.total], [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.cgst, order.sgst, order.total], [0.06, 0, 0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(tax.splitCgstSgst(0.01), { cgst: 0.01, sgst: 0 });
});

test('reconciliation matches corrected representative order and rendering preserves invoice fields', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
  ];
  const totals = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 42, date: '05/01/2022', customer: 'Customer', status: 'completed', items,
    coupon: 'SAVE10', subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total };
  const bill = invoice.computeInvoiceFigures(order);
  assert.deepEqual([totals.subtotal, totals.discount, totals.tax, totals.cgst, totals.sgst, totals.total], [1020, 102, 45.9, 22.95, 22.95, 963.9]);
  assert.deepEqual([bill.subtotal, bill.discount, bill.tax, bill.cgst, bill.sgst, bill.total], [1020, 102, 45.9, 22.95, 22.95, 963.9]);
  const result = reports.getGstReconciliation({ orders: [order, { ...order, id: 43, status: 'cancelled' }] });
  assert.deepEqual([result.totalChecked, result.mismatchCount, result.totalDelta], [1, 0, 0]);
  assert.equal(result.rows[0].matched, true);
  assert.deepEqual([result.rows[0].ledgerTax, result.rows[0].invoiceTax, result.rows[0].delta], [45.9, 45.9, 0]);
  const html = invoice.render(order);
  assert.match(html, /₹963\.90/);
  assert.match(html, /₹45\.90/);
  assert.match(html, /Print Invoice/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(invoice.render({ ...order, total: 900 }), /Accountant Reconciliation Notice/);
});

test('reconciliation still flags an inconsistent stored tax even when total matches', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }];
  const totals = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 1, items, coupon: 'SAVE10', ...totals, tax: 180 };
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
});
