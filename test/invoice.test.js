const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function makeRecordedOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [], customers: [{ id: 1, name: 'Asha' }] };
  const billed = pricing.computeTotals(items, coupon);
  const charge = ledger.chargeOrderToKhata(db, 1, billed.total);
  assert.equal(charge.ok, true);
  const order = orders.add(db, {
    date: '2026-01-15',
    customer: 'Asha',
    customerId: 1,
    paymentMode: 'khata',
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  return { db, order, billed };
}

test('a mixed-rate Khata invoice matches the checkout charge and line GST', () => {
  const { db, order } = makeRecordedOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 200, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 1 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 579.6);
  assert.equal(db.customers[0].totalBilled, order.total);
  assert.equal(figures.total, order.total);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual([figures.cgst, figures.sgst], [19.8, 19.8]);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 18], [12, 21.6]]);

  const html = invoice.render(order);
  assert.ok(html.includes('<td class="r">5%</td><td class="r">₹18.00</td>'));
  assert.ok(html.includes('<td class="r">12%</td><td class="r">₹21.60</td>'));
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹39.60</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹579.60</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 0);
});

test('an order at the default GST rate without a coupon agrees with its invoice', () => {
  const { order } = makeRecordedOrder([{ name: 'Tea', hsn: '0902', price: 50, qty: 2 }]);

  assert.equal(order.total, 118);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 18,
    cgst: 9,
    sgst: 9,
    total: 118,
    rows: [
      { name: 'Tea', sku: '-', hsn: '0902', qty: 2, price: 50, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
  const html = invoice.render(order);
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹118.00</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
});

test('a flat coupon reduces taxable value before invoice GST is calculated', () => {
  const { order } = makeRecordedOrder([{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }], 'FLAT50');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 45, 295]);
});

test('the invoice honors the SAVE10 discount cap', () => {
  const { order } = makeRecordedOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
});

test('invoice calculations normalize coupon codes and check eligibility', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }];

  assert.equal(pricing.discount(100, 'DIWALI20'), 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'DIWALI20' }).discount, 0);
  assert.equal(pricing.discount(100, 'FLAT50'), 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' }).discount, 0);
  assert.equal(pricing.discount(100, ' welcome '), 5);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: ' welcome ' }).discount, 5);
});

test('invoices honor explicit zero, decimal, and whole-number GST rates', () => {
  const items = [
    { name: 'Zero-rated item', price: 100, qty: 1, gstRate: 0 },
    { name: 'Item with decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Item with whole-number rate', price: 100, qty: 1, gstRate: 12 }
  ];
  const billed = pricing.computeTotals(items);
  const figures = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[0, 0], [5, 5], [12, 12]]);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[0, 0], [5, 5], [12, 12]]);
  assert.equal(billed.total, 317);
  assert.equal(figures.total, 317);
});

test('the invoice sums rounded line GST amounts', () => {
  const { order, billed } = makeRecordedOrder([
    { name: 'Tea A', hsn: '0902', price: 0.03, qty: 1 },
    { name: 'Tea B', hsn: '0902', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(line => line.tax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('a pre-HSN order retains the billed flat-rate GST and recorded coupon discount', () => {
  const order = {
    id: 1,
    date: '28/06/2021',
    coupon: 'SAVE10',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 10,
    tax: 16.2,
    total: 106.2
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.discount, figures.tax, figures.total], [10, 16.2, 106.2]);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[18, 16.2]]);
  const html = invoice.render(order);
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹106.20</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice'));
  assert.equal(reports.getDashboardSummary({ orders: [order] }).reconciliationMismatchCount, 0);
});

test('a legacy invoice distributes the billed order-level GST rounding across the lines', () => {
  const order = {
    items: [
      { name: 'Tea A', price: 10.03, qty: 1 },
      { name: 'Tea B', price: 10.03, qty: 1 }
    ],
    subtotal: 20.06,
    discount: 0,
    tax: 3.61,
    total: 23.67
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [3.61, 1.81, 1.8, 23.67]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [1.81, 1.8]);
});

test('a WELCOME invoice reconciles both total and GST with the recorded order', () => {
  const { db, order } = makeRecordedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'WELCOME');

  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice'));
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1,
      date: '2026-01-15',
      customer: 'Asha',
      coupon: 'WELCOME',
      ledgerSubtotal: 100,
      ledgerDiscount: 5,
      ledgerTax: 17.1,
      ledgerTotal: 112.1,
      invoiceDiscount: 5,
      invoiceTax: 17.1,
      invoiceTotal: 112.1,
      delta: 0,
      matched: true
    }]
  });
});

test('CURRENT BEHAVIOUR: a difference in recorded GST alone is flagged only in reconciliation', () => {
  const { db, order } = makeRecordedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'WELCOME');
  order.tax = 18;

  const report = reports.getGstReconciliation(db);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice'));
});

test('the invoice warns when the recorded total differs by one paisa', () => {
  const { order } = makeRecordedOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }]);
  order.total = 118.01;

  assert.ok(invoice.render(order).includes(
    'Invoice computed total (₹118.00) differs from Order Ledger recorded total (₹118.01) by -₹0.01.'
  ));
});
