const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// These order snapshots mirror the fields saved by routes/orders.js. Nothing
// here calls the JSON store or reads the repository's data/db.json.
function orderBilledFrom(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  return {
    id: 42,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('legacy invoice preserves saved totals without inventing line GST', () => {
  const order = orderBilledFrom([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
  ], '');

  assert.deepEqual(
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total },
    { subtotal: 200, discount: 0, tax: 17, total: 217 }
  );

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
      cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 200, discount: 0, tax: 17, cgst: 8.5, sgst: 8.5, total: 217 }
  );
  assert.deepEqual(
    figures.rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })),
    [
      { hsn: '1006', gstPercent: null, lineTax: null },
      { hsn: '0405', gstPercent: null, lineTax: null }
    ]
  );

  const html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹17.00'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹217.00'));
  assert.ok(html.includes('GST rate and line tax were not recorded'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));

  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(
    { ledgerTax: reconciliation.rows[0].ledgerTax, invoiceTax: reconciliation.rows[0].invoiceTax,
      ledgerTotal: reconciliation.rows[0].ledgerTotal, invoiceTotal: reconciliation.rows[0].invoiceTotal,
      matched: reconciliation.rows[0].matched },
    { ledgerTax: 17, invoiceTax: 17, ledgerTotal: 217, invoiceTotal: 217, matched: true }
  );
});

test('invoice uses the saved SAVE10 discount and post-discount GST', () => {
  const order = orderBilledFrom([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', gstRate: 0.05, price: 2000, qty: 1 }
  ], 'SAVE10');

  assert.deepEqual(
    { subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total },
    { subtotal: 2000, discount: 150, tax: 92.5, total: 1942.5 }
  );

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
      cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 2000, discount: 150, tax: 92.5, cgst: 46.25, sgst: 46.25, total: 1942.5 }
  );
  assert.deepEqual(
    figures.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })),
    [{ gstPercent: 5, lineTax: 92.5 }]
  );
});

test('invoice uses a decimal gstRate consistently with checkout', () => {
  const order = orderBilledFrom([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }
  ], '');

  assert.deepEqual({ tax: order.tax, total: order.total }, { tax: 5, total: 105 });
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total,
      displayedRate: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { tax: 5, cgst: 2.5, sgst: 2.5, total: 105, displayedRate: 5, lineTax: 5 }
  );
});

test('invoice retains saved totals after a coupon becomes inactive', () => {
  const order = orderBilledFrom([
    { id: 1, sku: 'TEA', name: 'Tea', hsn: '0902', gstRate: 0.18, price: 1000, qty: 1 }
  ], '');
  order.coupon = 'DIWALI20';
  order.discount = 200;
  order.tax = 144;
  order.total = 944;

  assert.deepEqual(
    { discount: order.discount, tax: order.tax, total: order.total },
    { discount: 200, tax: 144, total: 944 }
  );
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, total: figures.total,
      gstPercent: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { discount: 200, tax: 144, total: 944, gstPercent: 18, lineTax: 144 }
  );
});
