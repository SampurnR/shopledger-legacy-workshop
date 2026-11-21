const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

test('invoice total and GST breakdown match the billed amount for an HSN-rated order', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100.2, qty: 1 }],
    subtotal: 100.2,
    discount: 0,
    tax: 5.01,
    total: 105.21
  };

  const { total, tax, cgst, sgst, rows } = invoice.computeInvoiceFigures(order);
  assert.deepStrictEqual(
    { total, tax, cgst, sgst, gstPercent: rows[0].gstPercent, lineTax: rows[0].lineTax },
    { total: order.total, tax: order.tax, cgst: 2.51, sgst: 2.5, gstPercent: 5, lineTax: 5.01 }
  );
});

test('invoice agrees with an undiscounted order using the default GST rate', () => {
  const items = [{ name: 'Unclassified item', price: 10, qty: 2 }];
  const billed = pricing.computeTotals(items);
  const order = { id: 1, items, total: billed.total };

  assert.strictEqual(billed.tax, 3.6);
  assert.strictEqual(billed.total, 23.6);
  assert.deepStrictEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 20,
    discount: 0,
    tax: 3.6,
    cgst: 1.8,
    sgst: 1.8,
    total: 23.6,
    rows: [{
      name: 'Unclassified item', sku: '-', hsn: '-', qty: 2, price: 10,
      gstPercent: 18, line: 20, lineTax: 3.6
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a mixed-slab Khata invoice matches the charge and reconciles with the order ledger', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 300, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 400, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  assert.deepStrictEqual(billed, {
    subtotal: 1000,
    discount: 100,
    taxable: 900,
    tax: 70.2,
    cgst: 35.1,
    sgst: 35.1,
    total: 970.2,
    lines: [
      {
        id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
        gross: 600, discount: 60, taxable: 540, tax: 27, net: 567
      },
      {
        id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12,
        gross: 400, discount: 40, taxable: 360, tax: 43.2, net: 403.2
      }
    ]
  });

  const db = { nextOrderId: 1, orders: [], customers: [{ id: 7, name: 'Meera' }] };
  const charge = ledger.chargeOrderToKhata(db, 7, billed.total);
  assert.strictEqual(charge.ok, true);
  assert.strictEqual(charge.customer.totalBilled, 970.2);
  const order = orders.add(db, {
    ...billed, items, coupon, date: '2021-11-15', customer: 'Meera',
    customerId: 7, paymentMode: 'khata'
  });

  assert.deepStrictEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1000,
    discount: 100,
    tax: 70.2,
    cgst: 35.1,
    sgst: 35.1,
    total: 970.2,
    rows: [
      {
        name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 300,
        gstPercent: 5, line: 600, lineTax: 27
      },
      {
        name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 400,
        gstPercent: 12, line: 400, lineTax: 43.2
      }
    ]
  });

  const html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹27\.00<\/td>/);
  assert.match(html, /12%<\/td><td class="r">₹43\.20<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹70\.20/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹100\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹970\.20/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  assert.deepStrictEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1, date: '2021-11-15', customer: 'Meera', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 70.2, ledgerTotal: 970.2,
      invoiceDiscount: 100, invoiceTax: 70.2, invoiceTotal: 970.2,
      delta: 0, matched: true
    }]
  });
});

test('invoice accepts explicit zero, decimal and whole-percentage GST rates as billed', () => {
  const items = [
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Whole percentage', price: 100, qty: 1, gstRate: 5 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepStrictEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [
    [0, 0], [5, 5], [5, 5]
  ]);
  assert.deepStrictEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [0, 0], [5, 5], [5, 5]
  ]);
  assert.strictEqual(billed.total, 310);
  assert.strictEqual(printed.tax, 10);
  assert.strictEqual(printed.total, 310);
});

test('invoice GST uses the same per-line rounding as billing', () => {
  const items = [
    { name: 'First item', price: 0.03, qty: 1 },
    { name: 'Second item', price: 0.03, qty: 1 }
  ];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepStrictEqual(billed.lines.map(line => line.tax), [0.01, 0.01]);
  assert.deepStrictEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepStrictEqual(
    { tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 }
  );
  assert.deepStrictEqual(
    { tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 }
  );
});

test('invoice respects the percentage coupon cap used at checkout', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const order = { id: 2, items, coupon, total: billed.total };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepStrictEqual(
    [billed.discount, billed.tax, billed.total],
    [150, 333, 2183]
  );
  assert.deepStrictEqual(
    [printed.discount, printed.tax, printed.total],
    [150, 333, 2183]
  );
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies GST after the flat discount, as billing does', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 300, qty: 1 }];
  const coupon = 'FLAT50';
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items, coupon });

  assert.deepStrictEqual([billed.discount, billed.tax, billed.total], [50, 45, 295]);
  assert.deepStrictEqual([printed.discount, printed.tax, printed.total], [50, 45, 295]);
});

const legacyCoupons = [
  { reason: 'ignores an expired coupon', code: 'DIWALI20', price: 1000, expected: [0, 180, 1180] },
  { reason: 'ignores a flat coupon below its minimum', code: 'FLAT50', price: 20, expected: [0, 3.6, 23.6] },
  { reason: 'normalizes a stored coupon with lowercase letters and spaces', code: ' save10 ', price: 500, expected: [50, 81, 531] }
];

for (const { reason, code, price, expected } of legacyCoupons) {
  test(`invoice ${reason}`, () => {
    const items = [{ name: 'Tea', hsn: '0902', price, qty: 1 }];
    const billed = pricing.computeTotals(items, code);
    const printed = invoice.computeInvoiceFigures({ items, coupon: code });

    assert.deepStrictEqual([billed.discount, billed.tax, billed.total], expected);
    assert.deepStrictEqual([printed.discount, printed.tax, printed.total], expected);
  });
}

test('CURRENT BEHAVIOUR: equal totals hide a tax-only mismatch on the invoice but flag it in reconciliation', () => {
  const order = {
    id: 3,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 18,
    total: 105
  };
  const cancelled = { ...order, id: 4, status: 'cancelled' };
  const result = reports.getGstReconciliation({ orders: [order, cancelled] });

  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.strictEqual(result.totalChecked, 1);
  assert.strictEqual(result.mismatchCount, 1);
  assert.strictEqual(result.totalDelta, 0);
  assert.deepStrictEqual(result.rows.map(({ orderId, ledgerTax, invoiceTax, delta, matched }) => ({
    orderId, ledgerTax, invoiceTax, delta, matched
  })), [{ orderId: 3, ledgerTax: 18, invoiceTax: 5, delta: 0, matched: false }]);
});
