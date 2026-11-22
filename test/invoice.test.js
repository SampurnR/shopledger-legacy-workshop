const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Checkout saves the original items and aggregate amounts, without the computed tax lines.
function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1, items, coupon, subtotal, discount, tax, total };
}

function amounts({ discount, tax, cgst, sgst, total }) {
  return { discount, tax, cgst, sgst, total };
}

test('The invoice for a discounted rice order matches the amounts billed at checkout', () => {
  const order = {
    id: 1,
    items: [{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    coupon: 'SAVE10', subtotal: 640, discount: 64, tax: 28.80, total: 604.80
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(amounts(printed), {
    discount: order.discount, tax: order.tax, cgst: 14.40, sgst: 14.40, total: order.total
  });
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 28.80);
});

test('An undiscounted 18% item agrees down to the odd paise in the GST split', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100.50, qty: 1 }];
  const order = billedOrder(items);
  const expected = { discount: 0, tax: 18.09, cgst: 9.05, sgst: 9.04, total: 118.59 };

  assert.deepEqual(amounts(pricing.computeTotals(items)), expected);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order)), expected);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
});

test('Reprinting an expired coupon keeps the discount originally billed', () => {
  const order = {
    id: 2, coupon: 'DIWALI20',
    items: [
      { name: 'Rice', hsn: '1006', price: 600, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 400, qty: 1 }
    ],
    subtotal: 1000, discount: 200, tax: 62.40, total: 862.40
  };

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(printed), { discount: 200, tax: 62.40, cgst: 31.20, sgst: 31.20, total: 862.40 });
  assert.deepEqual(printed.rows.map(row => row.lineTax), [24, 38.40]);
});

test('A discrepancy in the saved total appears on the printable invoice', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]);
  order.total = 117;
  assert.match(invoice.render(order), /Order Ledger recorded total \(₹117\.00\) by \+₹1\.00/);
});

test('Reconciliation detects a GST discrepancy even when the saved total matches', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]);
  order.tax = 17;
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].matched, false);
  assert.equal(report.rows[0].delta, 0);
});

test('The printed invoice uses the billed 5% and 12% HSN slabs', () => {
  const items = [
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ];
  const order = billedOrder(items);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 22);
  assert.equal(order.total, 322);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 10], [12, 12]]);
  assert.deepEqual(amounts(printed), { discount: 0, tax: 22, cgst: 11, sgst: 11, total: 322 });

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹22\.00</);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹322\.00</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('FLAT50 reduces the taxable value of each invoice line proportionally', () => {
  const items = [
    { name: 'Rice', gstRate: 5, price: 100, qty: 3 },
    { name: 'Ghee', gstRate: 12, price: 200, qty: 1 }
  ];
  const bill = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures(billedOrder(items, 'FLAT50'));

  assert.deepEqual(bill.lines.map(line => [line.discount, line.taxable, line.tax]),
    [[30, 270, 13.50], [20, 180, 21.60]]);
  assert.deepEqual(amounts(bill), { discount: 50, tax: 35.10, cgst: 17.55, sgst: 17.55, total: 485.10 });
  assert.deepEqual(printed.rows.map(row => row.lineTax), [13.50, 21.60]);
  assert.deepEqual(amounts(printed), amounts(bill));
});

test('SAVE10 is capped at ₹150 before the invoice calculates GST', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 200, qty: 10 }];
  const order = billedOrder(items, 'SAVE10');
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(printed), { discount: 150, tax: 333, cgst: 166.50, sgst: 166.50, total: 2183 });
});

test('An uncapped SAVE10 order reconciles on both GST and grand total', () => {
  const order = billedOrder([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(order.tax, 81);
  assert.equal(printed.tax, 81);
  assert.equal(order.total, 531);
  assert.equal(printed.total, 531);

  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  const report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.rows[0].delta, 0);
});

test('Invoice GST includes each line rounded to the nearest paise', () => {
  const items = [
    { name: 'Tea', hsn: '0902', price: 0.03, qty: 1 },
    { name: 'Coffee', hsn: '0901', price: 0.03, qty: 1 }
  ];
  const order = billedOrder(items);
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.equal(printed.tax, 0.02);
  assert.equal(printed.total, 0.08);
});
