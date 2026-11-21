const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const bill = pricing.computeTotals(items, coupon);
  const order = orders.add(db, { ...bill, items, coupon, date: '2021-11-15' });
  return { bill, order };
}

test('invoice total matches an undiscounted bill at the default GST rate', () => {
  const { order } = billOrder([{ name: 'Tea', price: 50, qty: 2 }]);
  assert.equal(order.total, 118);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118,
    rows: [
      { name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 50, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
  assert.doesNotMatch(invoice.render(order), /class="warn-box"/);
});

test('invoice applies HSN GST slabs and the percentage coupon cap', () => {
  const { bill, order } = billOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(
    bill.lines.map(({ gstPercent, discount, taxable, tax }) => ({ gstPercent, discount, taxable, tax })),
    [
      { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
      { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
    ]
  );
  assert.deepEqual(
    [order.subtotal, order.discount, order.tax, bill.cgst, bill.sgst, order.total],
    [2000, 150, 157.25, 78.63, 78.62, 2007.25]
  );

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 }
  ]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /class="warn-box"/);
});

test('invoice applies a flat coupon before calculating GST', () => {
  const { bill, order } = billOrder([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');
  assert.deepEqual([bill.discount, bill.taxable, bill.tax, order.total], [50, 250, 45, 295]);

  const { discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ discount, tax, cgst, sgst, total }, {
    discount: 50, tax: 45, cgst: 22.5, sgst: 22.5, total: 295
  });
});

test('invoice respects legacy fractional and zero GST rates', () => {
  const { bill, order } = billOrder([
    { name: 'Fractional rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);
  assert.deepEqual(bill.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 5], [0, 0]]);
  assert.equal(order.total, 205);

  const { rows, tax, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 5], [0, 0]]);
  assert.equal(tax, 5);
  assert.equal(total, 205);
});

test('invoice GST matches the sum of its displayed rounded line taxes', () => {
  const { order } = billOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ]);
  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);

  const { rows, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual({ tax, cgst, sgst, total }, { tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  assert.doesNotMatch(invoice.render(order), /class="warn-box"/);
});
