const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

const riceAndOil = {
  id: 1002, coupon: 'SAVE10', tax: 45.90, total: 963.90,
  items: [
    { name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
    { name: 'Oil', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
  ]
};

test('CURRENT BEHAVIOUR: #1002 taxes gross lines and discounts the tax-inclusive subtotal', () => {
  const bill = invoice.computeInvoiceFigures(riceAndOil);
  assert.equal(bill.subtotal, 1020);
  assert.equal(bill.discount, 120.36);
  assert.equal(bill.tax, 183.60);
  assert.equal(bill.total, 1083.24);
  assert.deepEqual(bill.rows.map(row => row.lineTax), [115.20, 68.40]);
});

test('CURRENT BEHAVIOUR: #1004 exceeds the SAVE10 cap on a wholesale order', () => {
  const bill = invoice.computeInvoiceFigures({
    coupon: 'SAVE10', items: [{ hsn: '1508', price: 1120, qty: 2 }]
  });
  assert.equal(bill.discount, 264.32);
  assert.equal(bill.tax, 403.20);
  assert.equal(bill.total, 2378.88);
});

test('CURRENT BEHAVIOUR: #1007 prints 18% on both ghee and oil without a coupon', () => {
  const bill = invoice.computeInvoiceFigures({
    items: [{ hsn: '0405', price: 450, qty: 2 }, { hsn: '1512', price: 190, qty: 2 }]
  });
  assert.deepEqual(bill.rows.map(row => row.gstPercent), [18, 18]);
  assert.deepEqual(bill.rows.map(row => row.lineTax), [162, 68.40]);
  assert.equal(bill.total, 1510.40);
});

test('#1008 already balances for tea and syrup at 18% with no coupon', () => {
  const bill = invoice.computeInvoiceFigures({
    items: [{ hsn: '0902', price: 140, qty: 1 }, { hsn: '2106', price: 180, qty: 2 }]
  });
  assert.equal(bill.subtotal, 500);
  assert.equal(bill.discount, 0);
  assert.equal(bill.tax, 90);
  assert.equal(bill.cgst, 45);
  assert.equal(bill.sgst, 45);
  assert.equal(bill.total, 590);
});

test('a legacy line without HSN or SKU retains its printable row and fallback rate', () => {
  const bill = invoice.computeInvoiceFigures({ items: [{ name: 'Loose item', price: 1.50, qty: 1 }] });
  assert.deepEqual(bill.rows, [{
    name: 'Loose item', sku: '-', hsn: '-', qty: 1, price: 1.50,
    gstPercent: 18, line: 1.50, lineTax: 0.27
  }]);
  assert.equal(bill.cgst, 0.14);
  assert.equal(bill.sgst, 0.13);
});

test('a missing item list yields an empty zero-value invoice', () => {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('#1002 reconciles against the recorded bill and prints the same GST and total', () => {
  const audit = reports.getGstReconciliation({ orders: [{ ...riceAndOil, subtotal: 1020, discount: 102 }] });
  assert.equal(audit.rows[0].delta, 0, 'invoice must match the recorded checkout total');
  assert.equal(audit.rows[0].matched, true);
  const html = invoice.render(riceAndOil);
  assert.match(html, /Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('a flat discount is shared across 12% and 18% lines before GST rounds', () => {
  const bill = invoice.computeInvoiceFigures({
    coupon: 'FLAT50', items: [{ hsn: '0405', price: 260, qty: 1 }, { hsn: '0902', price: 140, qty: 1 }]
  });
  assert.deepEqual(bill.rows.map(row => row.lineTax), [27.30, 22.05]);
  assert.equal(bill.tax, 49.35);
  assert.equal(bill.cgst, 24.68);
  assert.equal(bill.sgst, 24.67);
  assert.equal(bill.total, 399.35);
});

test('explicit zero and fractional rates override HSN, and ineligible coupons give no discount', () => {
  const bill = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ hsn: '0902', gstRate: 0, price: 100, qty: 1 }, { hsn: '0902', gstRate: 0.05, price: 100, qty: 1 }]
  });
  assert.deepEqual(bill.rows.map(row => row.gstPercent), [0, 5]);
  assert.equal(bill.discount, 0);
  assert.equal(bill.total, 205);
});

test('a genuine discrepancy in the stored ledger still raises a reconciliation notice', () => {
  const order = { ...riceAndOil, total: 963.89 };
  const audit = reports.getGstReconciliation({ orders: [order] });
  assert.equal(audit.rows[0].delta, 0.01);
  assert.equal(audit.mismatchCount, 1);
  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
});
