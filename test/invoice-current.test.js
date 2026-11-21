const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function orderFor(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  return {
    id: 1,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: coupon || '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('invoice total, GST, discount, and line breakdown match the billed order', () => {
  const order = orderFor([
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 640, qty: 1 }
  ], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
  assert.deepEqual(
    { gstPercent: figures.rows[0].gstPercent, lineTax: figures.rows[0].lineTax },
    { gstPercent: 5, lineTax: 30.4 }
  );
  assert.equal(figures.cgst + figures.sgst, figures.tax);
});

test('historical invoice keeps recorded amounts when its coupon is now inactive', () => {
  const order = {
    id: 2,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 40,
    total: 840
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 1000, discount: 200, tax: 40, total: 840 }
  );
  assert.equal(figures.rows[0].lineTax, null);
  const html = invoice.render(order);
  assert.match(html, /Line GST breakdown unavailable/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹840\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  const recon = reports.getGstReconciliation({ orders: [order] });
  assert.equal(recon.rows[0].invoiceTotal, 840);
  assert.equal(recon.rows[0].matched, true);
});

test('reconciliation still detects a corrupt recorded order', () => {
  const order = orderFor([{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  order.total = 999;

  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].ledgerTotal, 999);
  const html = invoice.render(order);
  assert.match(html, /Recorded total inconsistency:/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹999\.00/);
});

test('invoice uses the billed HSN 5% GST rate and total', () => {
  const order = orderFor([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { billedTax: order.tax, billedTotal: order.total, invoiceTax: figures.tax, invoiceTotal: figures.total },
    { billedTax: 5, billedTotal: 105, invoiceTax: 5, invoiceTotal: 105 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
});

test('invoice uses the billed GST rate for each mixed-slab line', () => {
  const order = orderFor([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 23);
  assert.equal(order.total, 223);
  assert.deepEqual(figures.rows.map((row) => [row.gstPercent, row.lineTax]), [[5, 5], [18, 18]]);
  assert.equal(figures.tax, 23);
  assert.equal(figures.total, 223);
});

test('invoice applies the billed percentage coupon before GST', () => {
  const order = orderFor([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ], 'WELCOME');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { billedDiscount: order.discount, billedTax: order.tax, billedTotal: order.total },
    { billedDiscount: 5, billedTax: 4.75, billedTotal: 99.75 }
  );
  assert.deepEqual(
    { invoiceDiscount: figures.discount, invoiceTax: figures.tax, invoiceTotal: figures.total },
    { invoiceDiscount: 5, invoiceTax: 4.75, invoiceTotal: 99.75 }
  );
  assert.equal(figures.rows[0].lineTax, 4.75);
});

test('invoice applies the billed SAVE10 discount cap', () => {
  const order = orderFor([
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { billedDiscount: order.discount, billedTax: order.tax, billedTotal: order.total },
    { billedDiscount: 150, billedTax: 92.5, billedTotal: 1942.5 }
  );
  assert.deepEqual(
    { invoiceDiscount: figures.discount, invoiceTax: figures.tax, invoiceTotal: figures.total },
    { invoiceDiscount: 150, invoiceTax: 92.5, invoiceTotal: 1942.5 }
  );
});

test('rendered invoice shows billed GST without a ledger mismatch notice', () => {
  const order = orderFor([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  const html = invoice.render(order);

  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});
