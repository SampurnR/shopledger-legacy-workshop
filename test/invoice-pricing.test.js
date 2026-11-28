const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function makeOrder(items, coupon) {
  const charged = pricing.computeTotals(items, coupon);

  return {
    id: 1009,
    date: '28/11/2026',
    customer: 'Test customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    total: charged.total
  };
}

test('CURRENT BEHAVIOUR: discounted 5% HSN item is invoiced with fallback GST and tax-inclusive discount', () => {
  const order = makeOrder([
    { id: 1, sku: 'RICE-5KG', name: 'Rice 5kg', hsn: '1006', price: 640, qty: 1 }
  ], 'SAVE10');
  const billed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      chargedTax: order.tax,
      chargedTotal: order.total,
      invoiceDiscount: billed.discount,
      invoiceTax: billed.tax,
      invoiceTotal: billed.total,
      invoiceGstPercent: billed.rows[0].gstPercent
    },
    {
      chargedTax: 28.8,
      chargedTotal: 604.8,
      invoiceDiscount: 75.52,
      invoiceTax: 115.2,
      invoiceTotal: 679.68,
      invoiceGstPercent: 18
    }
  );
});

test('CURRENT BEHAVIOUR: invoice percentage coupon ignores the checkout discount cap', () => {
  const order = makeOrder([
    { id: 8, sku: 'TEA-BULK', name: 'Tea bulk pack', hsn: '0902', price: 2240, qty: 1 }
  ], 'SAVE10');
  const billed = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(billed.discount, 264.32);
  assert.equal(billed.tax, 403.2);
  assert.equal(billed.total, 2378.88);
});

test('CURRENT BEHAVIOUR: non-coupon 12% HSN item is invoiced at 18%', () => {
  const order = makeOrder([
    { id: 6, sku: 'GHEE-500', name: 'Ghee 500ml', hsn: '0405', price: 1000, qty: 1 }
  ], '');
  const billed = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 120);
  assert.equal(order.total, 1120);
  assert.equal(billed.rows[0].gstPercent, 18);
  assert.equal(billed.tax, 180);
  assert.equal(billed.total, 1180);
});

test('CURRENT BEHAVIOUR: GST reconciliation records the invoice mismatch', () => {
  const order = makeOrder([
    { id: 1, sku: 'RICE-5KG', name: 'Rice 5kg', hsn: '1006', price: 640, qty: 1 }
  ], 'SAVE10');
  const reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 74.88);
  assert.equal(reconciliation.rows[0].matched, false);
});

test('all-18% non-coupon order already matches checkout', () => {
  const order = makeOrder([
    { id: 8, sku: 'TEA-250', name: 'Tea 250g', hsn: '0902', price: 1000, qty: 1 }
  ], '');
  const billed = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 180);
  assert.equal(order.total, 1180);
  assert.equal(billed.tax, order.tax);
  assert.equal(billed.total, order.total);
});
