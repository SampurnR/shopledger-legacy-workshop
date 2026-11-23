const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice figures match the values used to bill an HSN-priced coupon order', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual(
    { subtotal: invoiced.subtotal, discount: invoiced.discount, tax: invoiced.tax, total: invoiced.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
});

test('invoice applies the HSN slab used for billing', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];

  const billed = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.deepEqual(
    { tax: billed.tax, total: billed.total, lineGstPercent: billed.lines[0].gstPercent },
    { tax: 5, total: 105, lineGstPercent: 5 }
  );
  assert.deepEqual(
    { tax: invoiced.tax, total: invoiced.total, lineGstPercent: invoiced.rows[0].gstPercent },
    { tax: 5, total: 105, lineGstPercent: 5 }
  );
});

test('invoice applies coupon discounts and GST using order pricing rules', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];

  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 100, tax: 45, total: 945 }
  );
  assert.deepEqual(
    { discount: invoiced.discount, tax: invoiced.tax, total: invoiced.total },
    { discount: 100, tax: 45, total: 945 }
  );
});

test('invoice uses the shared tax resolver for explicit GST rates and HSN slabs', () => {
  const explicitRate = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 100, qty: 1, hsn: '1006', gstRate: 5 }],
    coupon: ''
  });
  const hsnOnly = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 100, qty: 1, hsn: '1006' }],
    coupon: ''
  });

  assert.equal(explicitRate.tax, 5);
  assert.equal(explicitRate.rows[0].gstPercent, 5);
  assert.equal(hsnOnly.tax, 5);
  assert.equal(hsnOnly.rows[0].gstPercent, 5);
});

test('reconciliation matches invoice figures to stored billed totals', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const db = {
    orders: [{
      id: 42,
      date: '23/11/2026',
      customer: 'In-memory customer',
      coupon: '',
      status: 'completed',
      items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual(
    { ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax, delta: result.rows[0].delta, matched: result.rows[0].matched },
    { ledgerTax: 5, invoiceTax: 5, delta: 0, matched: true }
  );
});
