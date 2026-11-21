const test = require('node:test');
const assert = require('node:assert/strict');
const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// Use the same pricing and order-recording functions as checkout, with a fresh in-memory ledger.
function bill(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1, orders: [] };
  const order = orders.add(db, { items, coupon, date: '2021-11-15', ...totals });
  return { totals, order };
}

function printedText(order) {
  return invoice.render(order).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

test('An order with an unknown HSN and no coupon agrees at the default 18% GST', () => {
  const { order } = bill([{ id: 1, name: 'Groceries', hsn: '9999', qty: 2, price: 100 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 36);
  assert.equal(order.total, 236);
  assert.deepEqual(figures, {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236,
    rows: [{
      name: 'Groceries', sku: '-', hsn: '9999', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36
    }]
  });
  assert.doesNotMatch(printedText(order), /Accountant Reconciliation Notice/);
});

test('Invoice matches checkout for two HSN slabs after FLAT50', () => {
  const { totals, order } = bill([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 300, qty: 1 }
  ], 'FLAT50');

  assert.deepEqual(totals.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 20, taxable: 180, tax: 9 },
    { gstPercent: 12, discount: 30, taxable: 270, tax: 32.4 }
  ]);
  assert.equal(order.tax, 41.4);
  assert.equal(totals.cgst, 20.7);
  assert.equal(totals.sgst, 20.7);
  assert.equal(order.total, 491.4);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 9 },
    { gstPercent: 12, lineTax: 32.4 }
  ]);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 41.4);
  assert.equal(figures.cgst, 20.7);
  assert.equal(figures.sgst, 20.7);
  assert.equal(figures.total, 491.4);

  const text = printedText(order);
  assert.match(text, /CGST \+ SGST \(Total GST\) ₹41\.40/);
  assert.match(text, /Invoice Total ₹491\.40/);
  assert.doesNotMatch(text, /Accountant Reconciliation Notice/);
});

test('SAVE10 invoice discount and GST reconcile with checkout', () => {
  const { order } = bill([{ id: 1, name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'SAVE10');
  assert.equal(order.discount, 50);
  assert.equal(order.tax, 81);
  assert.equal(order.total, 531);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 81);
  assert.equal(figures.total, 531);

  const text = printedText(order);
  assert.match(text, /Coupon Discount \(SAVE10\) -₹50\.00/);
  assert.doesNotMatch(text, /Accountant Reconciliation Notice/);
  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.rows[0].matched, true);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
});

test('The invoice respects the SAVE10 discount cap', () => {
  const { order } = bill([{ id: 1, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 333);
  assert.equal(figures.total, 2183);
});

// Exercise saved coupon codes directly because checkout rejects these combinations today.
for (const [name, coupon, price, discount, total] of [
  ['FLAT50 below its minimum gives no discount', 'FLAT50', 20, 0, 23.6],
  ['Expired DIWALI20 gives no discount when pricing from items', 'DIWALI20', 1000, 0, 1180]
]) {
  test(name, () => {
    const items = [{ id: 1, name: 'Tea', hsn: '0902', price, qty: 1 }];
    assert.equal(coupons.validate(coupon, price).valid, false);
    const figures = invoice.computeInvoiceFigures({ items, coupon });
    assert.equal(figures.discount, discount);
    assert.equal(figures.total, total);
  });
}

test('Printed line taxes sum to invoice GST after paise rounding', () => {
  const { totals, order } = bill([
    { id: 1, name: 'Tea', hsn: '0902', price: 1.03, qty: 1 },
    { id: 2, name: 'Coffee', hsn: '0901', price: 1.03, qty: 1 }
  ]);
  assert.deepEqual(totals.lines.map(line => line.tax), [0.19, 0.19]);
  assert.equal(order.tax, 0.38);
  assert.equal(order.total, 2.44);

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.19, 0.19]);
  assert.equal(figures.tax, 0.38);
  assert.equal(figures.cgst, 0.19);
  assert.equal(figures.sgst, 0.19);
  assert.equal(figures.total, 2.44);
  const text = printedText(order);
  assert.equal(text.match(/18% ₹0\.19/g).length, 2);
  assert.match(text, /CGST \+ SGST \(Total GST\) ₹0\.38/);
  assert.doesNotMatch(text, /Accountant Reconciliation Notice/);
});

// Exercise explicit line rates directly because the order route supplies only HSN.
for (const [name, gstRate, billedTax, invoicePercent, invoiceTax] of [
  ['An explicit whole-number rate overrides the HSN on both calculations', 5, 5, 5, 5],
  ['A decimal GST rate is applied as a fraction', 0.05, 5, 5, 5],
  ['An explicit zero GST rate is preserved', 0, 0, 0, 0]
]) {
  test(name, () => {
    const items = [{ id: 1, name: 'Tea', hsn: '0902', price: 100, qty: 1, gstRate }];
    const totals = pricing.computeTotals(items);
    const figures = invoice.computeInvoiceFigures({ items });
    assert.equal(totals.tax, billedTax);
    assert.equal(figures.rows[0].gstPercent, invoicePercent);
    assert.equal(figures.tax, invoiceTax);
  });
}
