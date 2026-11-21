const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const orders = require('../lib/orders');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Checkout saves HSN on each item and the monetary totals on the order.
function bill(items, coupon = '') {
  const db = { orders: [], nextOrderId: 1 };
  const totals = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...totals, items, coupon, date: '2021-11-01' });
  return { totals, order, db };
}

test('checkout and invoice both allocate the odd paisa to CGST', () => {
  const { order, totals } = bill([{ name: 'Tea', hsn: '0902', price: 10.05, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);
  for (const calculation of [totals, figures]) {
    assert.equal(calculation.tax, 1.81);
    assert.equal(calculation.total, 11.86);
  }
  assert.equal(totals.cgst, 0.91);
  assert.equal(totals.sgst, 0.90);
  assert.equal(figures.cgst, 0.91);
  assert.equal(figures.sgst, 0.90);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('mixed HSN invoice matches the billed total and discounted GST for each slab', () => {
  const { order, totals } = bill([
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'G', hsn: '0405', price: 300, qty: 1 }
  ], 'SAVE10');
  assert.deepEqual(totals, {
    subtotal: 500, discount: 50, taxable: 450, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 200, discount: 20, taxable: 180, tax: 9, net: 189 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 300, discount: 30, taxable: 270, tax: 32.4, net: 302.4 }
    ]
  });
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, order.total);
  assert.deepEqual(figures, {
    subtotal: 500, discount: 50, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4,
    rows: [
      { name: 'Rice', sku: 'R', hsn: '1006', qty: 2, price: 100, gstPercent: 5, line: 200, lineTax: 9 },
      { name: 'Ghee', sku: 'G', hsn: '0405', qty: 1, price: 300, gstPercent: 12, line: 300, lineTax: 32.4 }
    ]
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹491\.40</);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹41\.40</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reconciliation matches both the total and GST on a discounted tea order', () => {
  const { db, order } = bill([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  assert.equal(order.total, 531);
  const report = reports.getGstReconciliation(db);
  assert.deepEqual(report, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1, date: '2021-11-01', customer: 'Walk-in', coupon: 'SAVE10',
      ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
      invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

for (const [rate, expectedTax, printedPercent] of [
  [5, 5, 5],
  [0.05, 5, 5],
  [0, 0, 0]
]) {
  test('explicit GST rate ' + rate + ' prints as ' + printedPercent + '%', () => {
    const { order } = bill([{ name: 'Item', price: 100, qty: 1, gstRate: rate }]);
    const figures = invoice.computeInvoiceFigures(order);
    assert.equal(order.tax, expectedTax);
    assert.equal(figures.tax, expectedTax);
    assert.equal(figures.rows[0].gstPercent, printedPercent);
  });
}

test('invoice GST sums the rounded line taxes', () => {
  const { order } = bill([
    { name: 'Tea', price: 0.02, qty: 1 },
    { name: 'Coffee', price: 0.02, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.tax, 0);
  assert.equal(order.total, 0.04);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0, 0]);
  assert.equal(figures.tax, 0);
  assert.equal(figures.total, 0.04);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a reprint keeps the discount billed before the coupon expired', () => {
  const order = {
    items: [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 144, total: 944
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 200);
  assert.equal(figures.rows[0].lineTax, 144);
  assert.equal(figures.total, 944);
});

// Older orders without a saved discount use the same coupon rules as checkout.
for (const [description, coupon, price, discount, invoiceTotal] of [
  ['flat discount reduces the taxable price', 'FLAT50', 300, 50, 295],
  ['percentage discount respects the cap', 'SAVE10', 2000, 150, 2183],
  ['flat discount requires the minimum order value', 'FLAT50', 20, 0, 23.6],
  ['expired coupon gives no discount', 'DIWALI20', 1000, 0, 1180],
  ['invoice coupon lookup normalizes the stored spelling', ' save10 ', 500, 50, 531]
]) {
  test(description, () => {
    const { order } = bill([{ name: 'Tea', price, qty: 1 }], coupon);
    assert.equal(order.discount, discount);
    delete order.discount;
    const figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.discount, discount);
    assert.equal(figures.total, invoiceTotal);
  });
}
