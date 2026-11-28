const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

// These cases use only in-memory order line items; they never access db.json.
function riceOrder(coupon = '') {
  return {
    id: 1001,
    date: '28/11/2026',
    customer: 'Test Customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon,
    items: [{
      id: 1,
      sku: 'GRN-001',
      name: 'Test Rice',
      hsn: '1006',
      price: 100,
      qty: 2
    }]
  };
}

test('invoice figures match order pricing and use the HSN GST breakdown', () => {
  const order = riceOrder();
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      rowGstPercent: invoiceFigures.rows[0].gstPercent,
      rowTax: invoiceFigures.rows[0].lineTax,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    },
    { rowGstPercent: 5, rowTax: 10, tax: 10, cgst: 5, sgst: 5, total: 210 }
  );
  assert.deepEqual(
    {
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    },
    { tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
});

test('invoice applies the same coupon discount and post-discount GST as order pricing', () => {
  const order = riceOrder('WELCOME');
  const billed = pricing.computeTotals(order.items, order.coupon);
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 10, tax: 9.5, total: 199.5 }
  );
  assert.deepEqual(
    { discount: invoiceFigures.discount, tax: invoiceFigures.tax, total: invoiceFigures.total },
    { discount: 10, tax: 9.5, total: 199.5 }
  );
});
