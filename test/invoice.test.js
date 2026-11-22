const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function mixedSlabOrder() {
  const items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const coupon = 'SAVE10';
  const billed = pricing.computeTotals(items, coupon);
  const order = orders.add({ orders: [], nextOrderId: 1001 }, {
    ...billed,
    items,
    coupon,
    date: '14/01/2022'
  });
  return { billed, order };
}

test('checkout caps the coupon and calculates GST on each discounted HSN line', () => {
  const { billed, order } = mixedSlabOrder();
  assert.deepEqual(
    billed.lines.map(({ gstPercent, discount, taxable, tax }) => ({
      gstPercent, discount, taxable, tax
    })),
    [
      { gstPercent: 5, discount: 75, taxable: 925, tax: 46.25 },
      { gstPercent: 12, discount: 75, taxable: 925, tax: 111 }
    ]
  );
  assert.equal(billed.cgst, 78.63);
  assert.equal(billed.sgst, 78.62);
  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 157.25);
  assert.equal(order.total, 2007.25);
});

test('invoice uses the saved discount and totals if current pricing differs', () => {
  const { order } = mixedSlabOrder();
  const printed = invoice.computeInvoiceFigures({
    ...order,
    discount: 100,
    tax: 161.5,
    total: 2061.5
  });

  assert.equal(printed.discount, 100);
  assert.equal(printed.tax, 161.5);
  assert.equal(printed.total, 2061.5);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [47.5, 114]);

  const withoutDiscount = invoice.computeInvoiceFigures({ ...order, discount: 0 });
  assert.equal(withoutDiscount.discount, 0);
  assert.deepEqual(withoutDiscount.rows.map(row => row.lineTax), [50, 120]);
});

test('invoice taxes the discounted line when the order specifies an explicit GST rate', () => {
  const items = [{ hsn: '1006', price: 500, qty: 1, gstRate: 5 }];
  const coupon = 'FLAT50';
  const billed = pricing.computeTotals(items, coupon);
  const printed = invoice.computeInvoiceFigures({ items, coupon });

  assert.equal(billed.discount, 50);
  assert.equal(printed.discount, 50);
  assert.equal(billed.tax, 22.5);
  assert.equal(billed.total, 472.5);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 22.5);
  assert.equal(printed.tax, 22.5);
  assert.equal(printed.total, 472.5);
});

test('printable HTML shows billed GST and total without a mismatch notice', () => {
  const { order } = mixedSlabOrder();
  const html = invoice.render(order);

  assert.match(html, /<td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td class="r">12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reconciliation marks the invoice and saved bill as matching', () => {
  const { order } = mixedSlabOrder();
  assert.deepEqual(reports.getGstReconciliation({ orders: [order] }), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '14/01/2022',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 2000,
      ledgerDiscount: 150,
      ledgerTax: 157.25,
      ledgerTotal: 2007.25,
      invoiceDiscount: 150,
      invoiceTax: 157.25,
      invoiceTotal: 2007.25,
      delta: 0,
      matched: true
    }]
  });
});

test('invoice shows the billed total and the GST charged on each discounted line', () => {
  const { order } = mixedSlabOrder();
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    total: printed.total,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    lines: printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax])
  }, {
    subtotal: 2000,
    discount: 150,
    total: 2007.25,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    lines: [[5, 46.25], [12, 111]]
  });
});

test('historical orders keep billed GST visible and flag a different reconstructed line sum', () => {
  const { order } = mixedSlabOrder();
  const historical = { ...order, tax: 140, total: 1990 };
  const reconciliation = reports.getGstReconciliation({ orders: [historical] });

  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.rows[0].matched, false);
  assert.equal(reconciliation.rows[0].invoiceTax, 157.25);
  assert.equal(reconciliation.rows[0].invoiceTotal, 2007.25);
  assert.equal(reconciliation.totalDelta, 17.25);
  assert.equal(invoice.computeInvoiceFigures(historical).total, 1990);
  assert.match(invoice.render(historical), /Reconstructed line GST \(₹157\.25\) differs from billed GST \(₹140\.00\)/);
});

test('reconciliation flags a total-only discrepancy without changing the printed billed total', () => {
  const { order } = mixedSlabOrder();
  const historical = { ...order, total: 2006.25 };

  const report = reports.getGstReconciliation({ orders: [historical] });
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 1);
  const html = invoice.render(historical);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2006\.25<\/td>/);
  assert.match(html, /Reconstructed total \(₹2007\.25\) differs from billed total \(₹2006\.25\)/);
  assert.doesNotMatch(html, /Reconstructed line GST/);
});
