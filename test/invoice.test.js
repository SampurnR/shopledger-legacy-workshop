const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function bill(items, coupon = '') {
  const totals = pricing.computeTotals(items, coupon);
  const db = { nextOrderId: 1001, orders: [] };
  // Mirror the amounts and item fields saved by the checkout route.
  const order = orders.add(db, {
    date: '18/11/2026',
    items,
    coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  return { db, order, totals };
}

function mixedSlabBill() {
  return bill([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');
}

test('invoice matches the billed amounts and discounted line GST for mixed slabs', () => {
  const { order } = mixedSlabBill();
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, 2007.25);
  assert.equal(figures.subtotal, 2000);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 157.25);
  assert.equal(figures.cgst, 78.63);
  assert.equal(figures.sgst, 78.62);
  assert.deepEqual(figures.rows.map(({ hsn, gstPercent, lineTax }) => ({
    hsn, gstPercent, lineTax
  })), [
    { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
    { hsn: '0405', gstPercent: 12, lineTax: 111 }
  ]);
});

test('checkout caps the coupon and applies each HSN slab after proration', () => {
  const { order, totals } = mixedSlabBill();

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 157.25);
  assert.equal(order.total, 2007.25);
  assert.equal(totals.cgst, 78.63);
  assert.equal(totals.sgst, 78.62);
  assert.deepEqual(totals.lines.map(({ discount, taxable, gstPercent, tax }) => ({
    discount, taxable, gstPercent, tax
  })), [
    { discount: 75, taxable: 925, gstPercent: 5, tax: 46.25 },
    { discount: 75, taxable: 925, gstPercent: 12, tax: 111 }
  ]);
});

test('printable invoice shows the billed line rates, GST and total without a discrepancy notice', () => {
  const { order } = mixedSlabBill();
  const html = invoice.render(order);

  assert.match(html, /<td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /<td class="r">12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reconciliation matches the corrected invoice and skips cancelled orders', () => {
  const { db, order } = mixedSlabBill();
  db.orders.push({ ...order, id: 1002, status: 'cancelled' });

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '18/11/2026',
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

test('invoice and ledger agree on GST for a coupon at the default rate', () => {
  const { db, order } = bill([
    { id: 3, name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ], 'SAVE10');

  const result = reports.getGstReconciliation(db);
  const [row] = result.rows;
  assert.equal(row.ledgerTotal, 531);
  assert.equal(row.invoiceTotal, 531);
  assert.equal(row.ledgerTax, 81);
  assert.equal(row.invoiceTax, 81);
  assert.equal(row.matched, true);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice and ledger agree at the default GST rate without a coupon', () => {
  const { db, order } = bill([{ id: 4, name: 'Item', price: 100, qty: 1 }]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.equal(reports.getGstReconciliation(db).rows[0].matched, true);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
