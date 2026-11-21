const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billOrder(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  const { subtotal, discount, tax, total } = billed;
  const order = { id: 1001, items, coupon, subtotal, discount, tax, total };
  return { billed, order };
}

test('a mixed-GST order with a capped coupon prints the amount and GST billed', () => {
  const { order } = billOrder([
    { name: 'Rice', hsn: '1006', price: 300, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 1900, qty: 1 }
  ], 'SAVE10');
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 2592.52);
  assert.equal(figures.total, order.total);
  assert.deepEqual(figures, {
    subtotal: 2500, discount: 150, tax: 242.52, cgst: 121.26, sgst: 121.26, total: 2592.52
  });
  assert.deepEqual(rows.map(row => row.gstPercent), [5, 12]);
  assert.deepEqual(rows.map(row => row.lineTax), [28.2, 214.32]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹242\.52/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2592\.52/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('an uncouponed order at the default GST rate matches its invoice', () => {
  const { order } = billOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }]);
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 236);
  assert.deepEqual(figures, {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236
  });
  assert.equal(rows[0].gstPercent, 18);
  assert.equal(rows[0].lineTax, 36);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses the same HSN rates as billing', () => {
  const { billed, order } = billOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ]);
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(line => line.gstPercent), [5, 12]);
  assert.deepEqual(billed.lines.map(line => line.tax), [10, 12]);
  assert.equal(billed.cgst, 11);
  assert.equal(billed.sgst, 11);
  assert.equal(order.total, 322);
  assert.deepEqual(rows.map(row => row.gstPercent), [5, 12]);
  assert.deepEqual(rows.map(row => row.lineTax), [10, 12]);
  assert.deepEqual(figures, {
    subtotal: 300, discount: 0, tax: 22, cgst: 11, sgst: 11, total: 322
  });
});

test('invoice applies the recorded capped percentage discount before GST', () => {
  const { order } = billOrder([{ name: 'Tea', hsn: '0902', price: 1000, qty: 2 }], 'SAVE10');
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.equal(rows[0].lineTax, 333);
  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183
  });
});

test('a flat coupon reduces both billed and invoice GST', () => {
  const { order } = billOrder([{ name: 'Tea', hsn: '0902', price: 400, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(order.tax, 63);
  assert.equal(order.total, 413);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 63);
  assert.equal(figures.total, 413);
});

test('invoice keeps a recorded zero discount when a coupon code is present', () => {
  const { order } = billOrder([{ name: 'Tea', hsn: '0902', price: 400, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures({ ...order, coupon: 'FLAT50' });

  assert.equal(order.total, 472);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 472);
});

test('invoice keeps a recorded discount when the coupon is now inactive', () => {
  const order = {
    items: [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 200);
  assert.equal(figures.tax, 144);
  assert.equal(figures.total, 944);
});

test('invoice follows billing for percentage, decimal, and zero GST rates', () => {
  const { billed, order } = billOrder([
    { name: 'Ghee', price: 1000, qty: 1, gstRate: 12 },
    { name: 'Spices', price: 1000, qty: 1, gstRate: 0.12 },
    { name: 'Rice', price: 1000, qty: 1, gstRate: 0 }
  ]);
  const { rows, tax, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(line => line.tax), [120, 120, 0]);
  assert.equal(order.tax, 240);
  assert.equal(order.total, 3240);
  assert.deepEqual(rows.map(row => row.gstPercent), [12, 12, 0]);
  assert.deepEqual(rows.map(row => row.lineTax), [120, 120, 0]);
  assert.equal(tax, 240);
  assert.equal(total, 3240);
});

test('invoice sums rounded line GST amounts just as billing does', () => {
  const { billed, order } = billOrder([
    { name: 'Tea', hsn: '0902', price: 10.03, qty: 1 },
    { name: 'Coffee', hsn: '0901', price: 10.03, qty: 1 }
  ]);
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(line => line.tax), [1.81, 1.81]);
  assert.equal(order.tax, 3.62);
  assert.equal(order.total, 23.68);
  assert.deepEqual(rows.map(row => row.lineTax), [1.81, 1.81]);
  assert.deepEqual(figures, {
    subtotal: 20.06, discount: 0, tax: 3.62, cgst: 1.81, sgst: 1.81, total: 23.68
  });
});

test('invoice preserves a recorded flat-GST sale from before HSN-based billing', () => {
  const order = {
    id: 1001,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 118
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.rows[0].lineTax, 18);
  assert.equal(figures.tax, 18);
  assert.equal(figures.total, 118);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('invoice allocates the recorded GST of a legacy sale rounded at the order level', () => {
  const order = {
    items: [
      { name: 'Tea', hsn: '0902', price: 10.03, qty: 1 },
      { name: 'Coffee', hsn: '0901', price: 10.03, qty: 1 }
    ],
    subtotal: 20.06,
    discount: 0,
    tax: 3.61,
    total: 23.67
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(row => row.lineTax), [1.81, 1.8]);
  assert.equal(figures.tax, 3.61);
  assert.equal(figures.total, 23.67);
});

test('CURRENT BEHAVIOUR: a GST-only difference is reported without an invoice notice', () => {
  const order = {
    id: 1001,
    items: [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 19,
    total: 118
  };
  const { rows, ...summary } = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(summary, { totalChecked: 1, mismatchCount: 1, totalDelta: 0 });
  assert.equal(rows[0].ledgerTax, 19);
  assert.equal(rows[0].invoiceTax, 18);
  assert.equal(rows[0].delta, 0);
  assert.equal(rows[0].matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
