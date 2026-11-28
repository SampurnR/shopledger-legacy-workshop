const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// Use the item shape saved by the order route, with HSN but no gstRate.
const items = [
  { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 600, qty: 2 },
  { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 800, qty: 1 }
];
const order = {
  id: 1,
  items,
  coupon: 'SAVE10',
  subtotal: 2000,
  discount: 150,
  tax: 144.30,
  total: 1994.30
};

test('invoice shows the billed total and discounted GST for each HSN', () => {
  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹1994\.30/);
  assert.match(html, /5%<\/td><td class="r">₹55\.50/);
  assert.match(html, /12%<\/td><td class="r">₹88\.80/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹144\.30/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('checkout caps the coupon and applies each HSN rate after discount', () => {
  const { lines, ...totals } = pricing.computeTotals(items, order.coupon);

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850,
    tax: 144.30, cgst: 72.15, sgst: 72.15, total: 1994.30
  });
  assert.deepEqual(lines.map(({ gstPercent, discount, taxable, tax }) => (
    { gstPercent, discount, taxable, tax }
  )), [
    { gstPercent: 5, discount: 90, taxable: 1110, tax: 55.50 },
    { gstPercent: 12, discount: 60, taxable: 740, tax: 88.80 }
  ]);
});

test('invoice uses the saved discount and resolves GST by HSN on discounted lines', () => {
  const { rows, ...totals } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, tax: 144.30, cgst: 72.15, sgst: 72.15, total: 1994.30
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => (
    { hsn, gstPercent, lineTax }
  )), [
    { hsn: '1006', gstPercent: 5, lineTax: 55.50 },
    { hsn: '0405', gstPercent: 12, lineTax: 88.80 }
  ]);
});

test('invoice resolves both whole percentages and fractional explicit GST rates', () => {
  const line = { ...items[0], price: 100, qty: 1 };
  const explicit = { ...line, gstRate: 5 };
  const fractional = { ...line, gstRate: 0.05 };

  assert.equal(invoice.computeInvoiceFigures({ items: [explicit] }).tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: [fractional] }).tax, 5);
  assert.equal(pricing.computeTotals([fractional], '').tax, 5);
});

test('invoice preserves historical billed amounts and flags a GST breakdown it cannot reproduce', () => {
  const historical = { ...order, discount: 100, tax: 300, total: 2200 };
  const figures = invoice.computeInvoiceFigures(historical);

  assert.equal(figures.discount, 100);
  assert.equal(figures.tax, 300);
  assert.equal(figures.total, 2200);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [57, 91.20]);
  assert.match(invoice.render(historical), /differs from the billed GST/);
});

test('reconciliation matches the invoice and ledger for the checkout fixture', () => {
  const { totalChecked, mismatchCount, totalDelta, rows } =
    reports.getGstReconciliation({ orders: [order] });
  const [{ ledgerTax, invoiceTax, ledgerTotal, invoiceTotal, delta, matched }] = rows;

  assert.deepEqual({ totalChecked, mismatchCount, totalDelta }, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0
  });
  assert.deepEqual({ ledgerTax, invoiceTax, ledgerTotal, invoiceTotal, delta, matched }, {
    ledgerTax: 144.30, invoiceTax: 144.30, ledgerTotal: 1994.30,
    invoiceTotal: 1994.30, delta: 0, matched: true
  });
});

test('invoice matches checkout for an 18% item without a coupon', () => {
  const tea = { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 };
  const billed = { id: 2, items: [tea], tax: 18, total: 118 };

  assert.equal(pricing.computeTotals([tea], '').total, 118);
  assert.equal(invoice.computeInvoiceFigures(billed).total, 118);
  assert.doesNotMatch(invoice.render(billed), /Accountant Reconciliation Notice/);
});
