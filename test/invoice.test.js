const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function createOrder(items, coupon = '') {
  const db = { nextOrderId: 1001, orders: [] };
  const billed = pricing.computeTotals(items, coupon);
  orders.add(db, { ...billed, items, coupon, date: '2021-11-15' });
  return { billed, order: orders.get(db, '1001') };
}

test('an undiscounted order at the default GST rate matches the printed invoice', () => {
  const { order } = createOrder([{ name: 'Coffee', price: 25, qty: 2 }]);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 50,
    discount: 0,
    tax: 9,
    cgst: 4.5,
    sgst: 4.5,
    total: 59,
    rows: [{
      name: 'Coffee', sku: '-', hsn: '-', qty: 2, price: 25,
      gstPercent: 18, line: 50, lineTax: 9
    }]
  });
  assert.equal(order.total, 59);
  assert.equal(order.tax, 9);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹9\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹59\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice|Coupon Discount/);
});

test('the printed invoice shows the total and GST that checkout billed', () => {
  const { order } = createOrder([
    { name: 'Rice', hsn: '1006', price: 200, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 200, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ], 'SAVE10');
  const html = invoice.render(order);
  const printed = {
    total: html.match(/Invoice Total<\/td><td class="r">₹([\d.]+)/)[1],
    gst: html.match(/Total GST\)<\/td><td class="r">₹([\d.]+)/)[1]
  };

  assert.deepEqual(printed, {
    total: order.total.toFixed(2),
    gst: order.tax.toFixed(2)
  });
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses HSN slabs and apportions SAVE10 before GST', () => {
  // Checkout saves HSN codes on order lines and omits gstRate.
  const { billed, order } = createOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 200, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 1 },
    { id: 3, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(billed.lines.map(({ gstPercent, discount, taxable, tax }) =>
    [gstPercent, discount, taxable, tax]), [
    [5, 40, 360, 18],
    [12, 20, 180, 21.6],
    [18, 10, 90, 16.2]
  ]);
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total],
    [700, 70, 55.8, 685.8]);
  assert.deepEqual([billed.cgst, billed.sgst], [27.9, 27.9]);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(({ hsn, gstPercent, line, lineTax }) =>
    [hsn, gstPercent, line, lineTax]), [
    ['1006', 5, 400, 18],
    ['0405', 12, 200, 21.6],
    ['0902', 18, 100, 16.2]
  ]);
  assert.deepEqual(
    [printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total],
    [700, 70, 55.8, 27.9, 27.9, 685.8]
  );

  const html = invoice.render(order);
  assert.match(html, /<td>1006<\/td><td class="r">2<\/td><td class="r">₹200\.00<\/td><td class="r">5%<\/td><td class="r">₹18\.00/);
  assert.doesNotMatch(html, /<td>(?:CGST|SGST)<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td [^>]+>-₹70\.00/);

  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '2021-11-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 700,
      ledgerDiscount: 70,
      ledgerTax: 55.8,
      ledgerTotal: 685.8,
      invoiceDiscount: 70,
      invoiceTax: 55.8,
      invoiceTotal: 685.8,
      delta: 0,
      matched: true
    }]
  });
});

test('a flat coupon reduces the invoice taxable value before GST', () => {
  const { order } = createOrder([{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }], 'FLAT50');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 45, 295]);
});

test('the invoice honors the same coupon cap as checkout', () => {
  const { order } = createOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
});

test('invoice normalizes historical coupon codes and honors coupon eligibility rules', () => {
  const cases = [
    { coupon: ' welcome ', price: 100, discount: 5, total: 112.1 },
    { coupon: 'SAVE10', price: 100, discount: 0, total: 118 },
    { coupon: 'DIWALI20', price: 1500, discount: 0, total: 1770 },
    { coupon: 'FLAT50', price: 100, discount: 0, total: 118 }
  ];

  // Historical records can contain codes that checkout would normalize or reject.
  for (const { coupon, price, discount, total } of cases) {
    const { order } = createOrder([{ name: 'Tea', price, qty: 1 }], coupon);
    const printed = invoice.computeInvoiceFigures(order);

    assert.deepEqual([order.discount, order.total], [discount, total], coupon);
    assert.deepEqual([printed.discount, printed.total], [discount, total], coupon);
  }
});

test('invoice honors explicit percent, decimal and zero GST rates', () => {
  const { billed, order } = createOrder([
    { name: 'Rice', price: 100, qty: 1, gstRate: 5 },
    { name: 'Ghee', price: 100, qty: 1, gstRate: 0.12 },
    { name: 'Exempt item', price: 100, qty: 1, gstRate: 0 }
  ]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]),
    [[5, 5], [12, 12], [0, 0]]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]),
    [[5, 5], [12, 12], [0, 0]]);
  assert.deepEqual([order.tax, order.total], [17, 317]);
  assert.deepEqual([printed.tax, printed.total], [17, 317]);
});

test('invoice sums rounded line GST and splits the billed tax into CGST and SGST', () => {
  const { billed, order } = createOrder([
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.09, qty: 1 }
  ]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ tax }) => tax), [0.01, 0.02]);
  assert.deepEqual([order.tax, order.total], [0.03, 0.15]);
  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [0.01, 0.02]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total],
    [0.03, 0.02, 0.01, 0.15]);
});

test('the printed reconciliation notice shows a one-paisa difference from the stored total', () => {
  const { order } = createOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  assert.match(invoice.render({ ...order, total: 117.99 }),
    /Accountant Reconciliation Notice:.*by \+₹0\.01\./);
  assert.match(invoice.render({ ...order, total: 118.01 }),
    /Accountant Reconciliation Notice:.*by -₹0\.01\./);
});

test('CURRENT BEHAVIOUR: reconciliation flags a GST-only mismatch that the printed notice omits', () => {
  const { order: matched } = createOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  const gstMismatch = { ...matched, id: 1002, discount: 2, tax: 20 };
  const cancelled = { ...gstMismatch, id: 1003, status: 'cancelled' };

  const report = reports.getGstReconciliation({ orders: [matched, gstMismatch, cancelled] });

  assert.equal(report.totalChecked, 2);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.deepEqual(report.rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) =>
    [orderId, ledgerTax, invoiceTax, delta, matched]), [
    [1001, 18, 18, 0, true],
    [1002, 20, 18, 0, false]
  ]);
  assert.doesNotMatch(invoice.render(gstMismatch), /Accountant Reconciliation Notice/);
});
