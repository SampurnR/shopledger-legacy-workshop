const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice uses the billed HSN GST, coupon discount, and total', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 450, qty: 1 }
  ];
  const billedTotals = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.subtotal, billedTotals.subtotal);
  assert.equal(invoiceFigures.discount, billedTotals.discount);
  assert.equal(invoiceFigures.tax, billedTotals.tax);
  assert.equal(invoiceFigures.cgst, billedTotals.cgst);
  assert.equal(invoiceFigures.sgst, billedTotals.sgst);
  assert.equal(invoiceFigures.total, billedTotals.total);
  assert.deepEqual(invoiceFigures.rows.map(row => ({
    gstPercent: row.gstPercent,
    lineTax: row.lineTax
  })), billedTotals.lines.map(line => ({
    gstPercent: line.gstPercent,
    lineTax: line.tax
  })));
});

test('invoice follows pricing coupon minimum-order eligibility', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billedTotals = pricing.computeTotals(items, 'FLAT50');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });

  assert.equal(billedTotals.discount, 0);
  assert.equal(invoiceFigures.discount, billedTotals.discount);
  assert.equal(invoiceFigures.total, billedTotals.total);
});

test('invoice renderer shows billed totals without a reconciliation warning', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 640, qty: 1 }];
  const billedTotals = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 42,
    date: '22/11/2026',
    customer: 'Test customer',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    total: billedTotals.total,
    items
  };

  const html = invoice.render(order);
  assert.match(html, new RegExp('Invoice Total</td><td class="r">₹' + billedTotals.total.toFixed(2)));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
