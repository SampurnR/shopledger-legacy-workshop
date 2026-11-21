const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function recordOrder(items, coupon = '') {
  const db = { orders: [], nextOrderId: 1001 };
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add(db, {
    date: '2021-11-15',
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  return { db, billed, order };
}

test('an undiscounted tea order matches the invoice and reconciliation report', () => {
  const { db, order } = recordOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }]);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200, discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236,
    rows: [
      { name: 'Tea', sku: '-', hsn: '0902', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 }
    ]
  });
  assert.equal(order.total, 236);
  assert.equal(reports.getGstReconciliation(db).rows[0].matched, true);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('mixed HSN invoice matches the billed GST and total after the coupon', () => {
  const { db, billed, order } = recordOrder([
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 150, qty: 2 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 1 },
    { name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(billed.lines.map(({ gstPercent, discount, taxable, tax }) => (
    { gstPercent, discount, taxable, tax }
  )), [
    { gstPercent: 5, discount: 30, taxable: 270, tax: 13.5 },
    { gstPercent: 12, discount: 20, taxable: 180, tax: 21.6 },
    { gstPercent: 18, discount: 10, taxable: 90, tax: 16.2 }
  ]);
  assert.deepEqual(
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total },
    { subtotal: 600, discount: 60, tax: 51.3, total: 591.3 }
  );
  assert.equal(billed.cgst, 25.65);
  assert.equal(billed.sgst, 25.65);

  const { rows, ...figures } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures, { subtotal: 600, discount: 60, tax: 51.3, cgst: 25.65, sgst: 25.65, total: 591.3 });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 13.5 },
    { hsn: '0405', gstPercent: 12, lineTax: 21.6 },
    { hsn: '0902', gstPercent: 18, lineTax: 16.2 }
  ]);

  const html = invoice.render(order);
  assert.match(html, /<td>1006<\/td>(?:<td class="r">[^<]*<\/td>){2}<td class="r">5%<\/td><td class="r">₹13\.50<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹51\.30<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹591\.30<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001, date: '2021-11-15', customer: 'Walk-in', coupon: 'SAVE10',
      ledgerSubtotal: 600, ledgerDiscount: 60, ledgerTax: 51.3, ledgerTotal: 591.3,
      invoiceDiscount: 60, invoiceTax: 51.3, invoiceTotal: 591.3,
      delta: 0, matched: true
    }]
  });
});

test('invoice applies the checkout percentage discount cap', () => {
  const { order } = recordOrder([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([discount, tax, total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice calculates GST after applying a flat coupon', () => {
  const { order } = recordOrder([{ name: 'Tea', price: 300, qty: 1 }], 'FLAT50');
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);

  assert.deepEqual([order.discount, order.tax, order.total], [50, 45, 295]);
  assert.deepEqual([discount, tax, total], [50, 45, 295]);
});

test('invoice uses checkout eligibility rules for saved coupon codes', () => {
  // These fixture orders represent stored records and bypass checkout validation.
  for (const coupon of ['SAVE10', 'DIWALI20', 'FLAT50']) {
    const { order } = recordOrder([{ name: 'Tea', price: 100, qty: 1 }], coupon);
    const { discount, tax, total } = invoice.computeInvoiceFigures(order);

    assert.deepEqual([order.discount, order.tax, order.total], [0, 18, 118], coupon);
    assert.deepEqual([discount, tax, total], [0, 18, 118], coupon);
  }
});

test('invoice reprints the discount recorded before a coupon was retired', () => {
  const order = {
    items: [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.rows[0].lineTax, figures.tax, figures.total], [200, 144, 144, 944]);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹944\.00<\/td>/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('invoice uses the checkout interpretation of explicit GST rates', () => {
  const { billed, order } = recordOrder([
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 },
    { name: 'Fractional rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ tax }) => tax), [5, 5, 0]);
  assert.deepEqual(figures.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 5], [5, 5], [0, 0]
  ]);
  assert.equal(order.tax, 10);
  assert.equal(order.total, 310);
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 310);
});

test('invoice GST sums the same rounded line taxes as checkout', () => {
  const { billed, order } = recordOrder([
    { name: 'Tea sample', price: 0.03, qty: 1 },
    { name: 'Coffee sample', price: 0.03, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(({ lineTax }) => lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, order.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('a GST-only mismatch appears in the reconciliation report and printed notice', () => {
  const db = { orders: [{
    id: 42,
    items: [{ name: 'Tea', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 20,
    total: 118
  }] };
  const [order] = db.orders;
  const report = reports.getGstReconciliation(db);

  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].ledgerTax, 20);
  assert.equal(report.rows[0].invoiceTax, 18);
  assert.equal(report.rows[0].matched, false);
  const html = invoice.render(order);
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice computed GST \(₹18\.00\) differs from Order Ledger recorded GST \(₹20\.00\) by -₹2\.00\./);
  assert.doesNotMatch(html, /Invoice computed total/);
});

test('the reconciliation notice lists each mismatched amount once', () => {
  const order = {
    items: [{ name: 'Tea', price: 100, qty: 1 }],
    discount: 0,
    tax: 18,
    total: 117.99
  };

  const totalOnly = invoice.render(order);
  assert.match(totalOnly, /Invoice computed total \(₹118\.00\) differs from Order Ledger recorded total \(₹117\.99\) by \+₹0\.01\./);
  assert.doesNotMatch(totalOnly, /Invoice computed GST/);

  const both = invoice.render({ ...order, tax: 17.99 });
  assert.equal(both.match(/Accountant Reconciliation Notice/g)?.length, 1);
  assert.equal(both.match(/Invoice computed total \(₹118\.00\) differs from Order Ledger recorded total \(₹117\.99\) by \+₹0\.01\./g)?.length, 1);
  assert.equal(both.match(/Invoice computed GST \(₹18\.00\) differs from Order Ledger recorded GST \(₹17\.99\) by \+₹0\.01\./g)?.length, 1);
});

test('the reconciliation notice flags a nonnumeric recorded GST amount', () => {
  const order = {
    items: [{ name: 'Tea', price: 100, qty: 1 }],
    discount: 0,
    tax: 'unknown',
    total: 118
  };

  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, false);
  assert.match(invoice.render(order), /Order Ledger recorded GST is invalid\. Invoice computed GST is ₹18\.00\./);
});
