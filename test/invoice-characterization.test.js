const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice agrees with an undiscounted order at the default GST rate', () => {
  const items = [{ name: 'Tea', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items);
  const order = { id: 1, items, total: billed.total };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.total, 236);
  assert.deepEqual(figures, {
    subtotal: 200,
    discount: 0,
    tax: 36,
    cgst: 18,
    sgst: 18,
    total: 236,
    rows: [{
      name: 'Tea', sku: '-', hsn: '-', qty: 2, price: 100,
      gstPercent: 18, line: 200, lineTax: 36
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('mixed HSN and SAVE10 agree across Khata billing, invoice, and reconciliation', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 300, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  const db = { nextOrderId: 1, orders: [], customers: [{ id: 7 }] };
  const billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(
    billed.lines.map(({ gstPercent, discount, taxable, tax }) => (
      { gstPercent, discount, taxable, tax }
    )),
    [
      { gstPercent: 5, discount: 20, taxable: 180, tax: 9 },
      { gstPercent: 12, discount: 30, taxable: 270, tax: 32.4 },
      { gstPercent: 18, discount: 10, taxable: 90, tax: 16.2 }
    ]
  );
  assert.equal(billed.cgst, 28.8);
  assert.equal(billed.sgst, 28.8);

  assert.equal(ledger.chargeOrderToKhata(db, 7, billed.total).ok, true);
  assert.equal(db.customers[0].totalBilled, 597.6);
  const order = orders.add(db, {
    date: '2026-01-01',
    customerId: 7,
    paymentMode: 'khata',
    items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  assert.deepEqual(
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total },
    { subtotal: 600, discount: 60, tax: 57.6, total: 597.6 }
  );

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, {
    subtotal: 600, discount: 60, tax: 57.6, cgst: 28.8, sgst: 28.8, total: 597.6
  });
  assert.deepEqual(
    rows.map(({ hsn, gstPercent, lineTax }) => [hsn, gstPercent, lineTax]),
    [['1006', 5, 9], ['0405', 12, 32.4], ['0902', 18, 16.2]]
  );

  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  const [{ ledgerTax, invoiceTax, delta, matched }] = reconciliation.rows;
  assert.deepEqual({ ledgerTax, invoiceTax, delta, matched }, {
    ledgerTax: 57.6, invoiceTax: 57.6, delta: 0, matched: true
  });
});

test('invoice honors the SAVE10 cap and still flags a different recorded total', () => {
  const items = [{ name: 'Tea', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 1, items, coupon: 'SAVE10', total: 2184 };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.discount, billed.tax, billed.total], [150, 333, 2183]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
  assert.ok(invoice.render(order).includes(
    'Invoice computed total (₹2183.00) differs from Order Ledger recorded total (₹2184.00) by -₹1.00.'
  ));
});

test('invoice skips ineligible coupons on stored orders', () => {
  const belowMinimum = invoice.computeInvoiceFigures({
    items: [{ price: 25, qty: 1 }],
    coupon: 'FLAT50'
  });
  assert.deepEqual([belowMinimum.discount, belowMinimum.total], [0, 29.5]);

  const expired = invoice.computeInvoiceFigures({
    items: [{ price: 1000, qty: 1 }],
    coupon: 'DIWALI20'
  });
  assert.deepEqual([expired.discount, expired.total], [0, 1180]);
});

test('invoice honors percentage, decimal, and zero GST overrides', () => {
  const items = [
    { id: 1, price: 100, qty: 1, gstRate: 12 },
    { id: 2, price: 100, qty: 1, gstRate: 0.12 },
    { id: 3, price: 100, qty: 1, gstRate: 0 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [
    [12, 12], [12, 12], [0, 0]
  ]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [12, 12], [12, 12], [0, 0]
  ]);
});

test('invoice sums rounded row GST into the printed GST total', () => {
  const items = [
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
});

test('invoice matches the amount and GST billed for a mixed-slab SAVE10 order', () => {
  const order = {
    id: 1001,
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
      { name: 'Ghee', hsn: '0405', price: 300, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ],
    coupon: 'SAVE10',
    subtotal: 600,
    discount: 60,
    tax: 57.6,
    total: 597.6
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [
    [5, 9], [12, 32.4], [18, 16.2]
  ]);
  const html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹57.60'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹597.60'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
