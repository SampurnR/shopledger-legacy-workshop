const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function mixedGstOrder() {
  // New orders snapshot HSN but do not copy gstRate from the catalog.
  const items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1001, status: 'completed', items, coupon, subtotal, discount, tax, total };
}

test('printed invoice matches the billed total and per-line GST for a discounted mixed-rate order', () => {
  const order = mixedGstOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    total: figures.total,
    gst: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    lines: figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax])
  }, {
    total: 2007.25,
    gst: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    lines: [[5, 46.25], [12, 111]]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('checkout caps SAVE10 and applies each HSN rate after the allocated discount', () => {
  const order = mixedGstOrder();
  const { lines, ...totals } = pricing.computeTotals(order.items, order.coupon);

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850,
    tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(lines.map(({ gstPercent, discount, taxable, tax }) => ({
    gstPercent, discount, taxable, tax
  })), [
    { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
    { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
  ]);
});

test('invoice uses the checkout HSN rates and capped SAVE10 discount', () => {
  const order = mixedGstOrder();
  const { rows, ...figures } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({
    hsn, gstPercent, lineTax
  })), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 }
  ]);
});

test('a flat coupon reduces GST on both checkout and the invoice', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }];
  const coupon = 'FLAT50';
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items, coupon });

  assert.equal(billed.discount, 50);
  assert.equal(printed.discount, 50);
  assert.equal(billed.tax, 45);
  assert.equal(printed.tax, 45);
  assert.equal(billed.total, 295);
  assert.equal(printed.total, 295);
});

test('invoice HTML prints both checkout GST rates and the billed total', () => {
  const html = invoice.render(mixedGstOrder());

  assert.match(html, /GST %/);
  assert.match(html, /5%<\/td><td class="r">₹46\.25/);
  assert.match(html, /12%<\/td><td class="r">₹111\.00/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
});

test('GST reconciliation matches checkout and still flags differing stored amounts', () => {
  const order = mixedGstOrder();
  const differingOrder = { ...order, id: 1003, tax: 160, total: 2010 };
  const result = reports.getGstReconciliation({ orders: [order, differingOrder] });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 2.75);
  assert.equal(result.rows[0].matched, true);
  const { ledgerTax, invoiceTax, ledgerTotal, invoiceTotal, delta, matched } = result.rows[1];
  assert.deepEqual({ ledgerTax, invoiceTax, ledgerTotal, invoiceTotal, delta, matched }, {
    ledgerTax: 160, invoiceTax: 157.25,
    ledgerTotal: 2010, invoiceTotal: 2007.25, delta: -2.75, matched: false
  });
  assert.match(invoice.render(differingOrder), /Accountant Reconciliation Notice/);
});

test('invoice and checkout agree for an explicit whole-percent rate with no coupon', () => {
  const items = [{ name: 'Rice', hsn: '1006', gstRate: 5, price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const order = { id: 1002, items, coupon: '', total: billed.total };
  const printed = invoice.computeInvoiceFigures(order);

  assert.equal(billed.total, 105);
  assert.equal(printed.total, 105);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.tax, 5);
  assert.equal(printed.cgst, 2.5);
  assert.equal(printed.sgst, 2.5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
