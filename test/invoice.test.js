const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

function billedOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [] };
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return orders.add(db, {
    date: '2026-11-21', items, coupon, subtotal, discount, tax, total
  });
}

test('invoice agrees with billing at the default GST rate without a coupon', () => {
  const order = billedOrder([{ name: 'Tea', qty: 2, price: 50 }]);

  assert.equal(order.total, 118);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 18,
    cgst: 9,
    sgst: 9,
    total: 118,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 50,
      gstPercent: 18, line: 100, lineTax: 18
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies HSN slabs to saved items without explicit GST rates', () => {
  const order = billedOrder([
    { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 50 },
    { name: 'Butter', hsn: '0405', qty: 1, price: 100 }
  ]);

  assert.equal(order.tax, 17);
  assert.equal(order.total, 217);
  const { tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ tax, cgst, sgst, total }, { tax: 17, cgst: 8.5, sgst: 8.5, total: 217 });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => [hsn, gstPercent, lineTax]), [
    ['1006', 5, 5],
    ['0405', 12, 12]
  ]);

  const html = invoice.render(order);
  assert.match(html, /1006<\/td><td class="r">2<\/td><td class="r">₹50\.00<\/td><td class="r">5%<\/td><td class="r">₹5\.00/);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹17.00'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹217.00'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('percentage coupon reduces taxable value on the invoice', () => {
  const order = billedOrder([{ name: 'Tea', qty: 1, price: 500 }], 'SAVE10');

  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual([discount, tax, total], [50, 81, 531]);
  const html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹81.00'));
  assert.ok(html.includes('Coupon Discount (SAVE10)</td><td class="r" style="color:#16a34a">-₹50.00'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice applies the percentage coupon cap', () => {
  const order = billedOrder([{ name: 'Tea', qty: 1, price: 2000 }], 'SAVE10');

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual([discount, tax, total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('flat coupon reduces taxable value on the invoice', () => {
  const order = billedOrder([{ name: 'Tea', qty: 1, price: 300 }], 'FLAT50');

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual([discount, tax, total], [50, 45, 295]);
});

test('invoice accepts percentage, decimal, and zero GST rates', () => {
  const order = billedOrder([
    { name: 'Percentage rate', qty: 1, price: 100, gstRate: 5 },
    { name: 'Decimal rate', qty: 1, price: 100, gstRate: 0.05 },
    { name: 'Zero rate', qty: 1, price: 100, gstRate: 0 }
  ]);

  assert.equal(order.tax, 10);
  const { tax, total, rows } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5], [5, 5], [0, 0]
  ]);
  assert.deepEqual([tax, total], [10, 310]);
});

test('invoice GST total sums rounded line taxes', () => {
  const order = billedOrder([
    { name: 'Item A', qty: 1, price: 0.03 },
    { name: 'Item B', qty: 1, price: 0.03 }
  ]);

  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  const { tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([tax, cgst, sgst, total], [0.02, 0.01, 0.01, 0.08]);
});

test('invoice uses the billing split for an odd paise of GST', () => {
  const items = [{ name: 'Item', qty: 1, price: 0.03 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(billedOrder(items));

  assert.deepEqual([billed.tax, billed.cgst, billed.sgst], [0.01, 0.01, 0]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst], [0.01, 0.01, 0]);
});

test('mixed-GST invoice with SAVE10 reconciles with the order ledger', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', qty: 4, price: 100 },
    { name: 'Butter', hsn: '0405', qty: 1, price: 100 }
  ], 'SAVE10');

  assert.equal(order.total, 478.8);
  const { subtotal, discount, tax, total, rows } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ subtotal, discount, tax, total }, {
    subtotal: 500, discount: 50, tax: 28.8, total: 478.8
  });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 18], [12, 10.8]
  ]);

  const html = invoice.render(order);
  assert.ok(html.includes('Invoice Total</td><td class="r">₹478.80'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice reports a one-paise difference from the recorded total in either direction', () => {
  const order = billedOrder([{ name: 'Tea', qty: 2, price: 50 }]);

  for (const [recordedTotal, difference] of [[117.99, '+₹0.01'], [118.01, '-₹0.01']]) {
    const html = invoice.render({ ...order, total: recordedTotal });
    assert.ok(html.includes(
      'Invoice computed total (₹118.00) differs from Order Ledger recorded total ' +
      '(₹' + recordedTotal.toFixed(2) + ') by ' + difference + '.'
    ));
  }
});
