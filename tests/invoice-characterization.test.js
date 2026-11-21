const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function mixedTaxItems() {
  return [
    {
      id: 1,
      sku: 'GRN-001',
      name: 'Indrayani Basmati Rice 5kg',
      hsn: '1006',
      price: 640,
      qty: 1
    },
    {
      id: 8,
      sku: 'BEV-001',
      name: 'Assam CTC Masala Chai 250g',
      hsn: '0902',
      price: 140,
      qty: 1
    }
  ];
}

test('invoice figures match checkout pricing for the same order', () => {
  const items = mixedTaxItems();
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.subtotal, checkout.subtotal);
  assert.equal(invoiceFigures.discount, checkout.discount);
  assert.equal(invoiceFigures.tax, checkout.tax);
  assert.equal(invoiceFigures.cgst, checkout.cgst);
  assert.equal(invoiceFigures.sgst, checkout.sgst);
  assert.equal(invoiceFigures.total, checkout.total);
});

test('checkout pricing applies HSN GST to the post-discount taxable value', () => {
  const totals = pricing.computeTotals(mixedTaxItems(), 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 780,
    discount: 78,
    taxable: 702,
    tax: 51.48,
    cgst: 25.74,
    sgst: 25.74,
    total: 753.48,
    lines: [
      {
        id: 1,
        name: 'Indrayani Basmati Rice 5kg',
        hsn: '1006',
        gstPercent: 5,
        gross: 640,
        discount: 64,
        taxable: 576,
        tax: 28.8,
        net: 604.8
      },
      {
        id: 8,
        name: 'Assam CTC Masala Chai 250g',
        hsn: '0902',
        gstPercent: 18,
        gross: 140,
        discount: 14,
        taxable: 126,
        tax: 22.68,
        net: 148.68
      }
    ]
  });
});

test('invoice uses each order line HSN GST rate when gstRate is absent', () => {
  const figures = invoice.computeInvoiceFigures({
    items: mixedTaxItems(),
    coupon: ''
  });

  assert.equal(figures.subtotal, 780);
  assert.equal(figures.tax, 57.2);
  assert.equal(figures.cgst, 28.6);
  assert.equal(figures.sgst, 28.6);
  assert.equal(figures.total, 837.2);
  assert.deepEqual(figures.rows.map((row) => row.gstPercent), [5, 18]);
});

test('invoice percentage discount is calculated on the post-discount taxable value', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ price: 1000, qty: 1, hsn: '1006' }],
    coupon: 'SAVE10'
  });

  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.tax, 45);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 945);
});

test('invoice total and GST match checkout for the same order', () => {
  const items = mixedTaxItems();
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(checkout.total, 753.48);
  assert.equal(checkout.tax, 51.48);
  assert.equal(invoiceFigures.total, 753.48);
  assert.equal(invoiceFigures.tax, 51.48);
  assert.equal(invoiceFigures.total - checkout.total, 0);
});

test('reconciliation reports no variance and does not mutate the in-memory database', () => {
  const order = {
    id: 9001,
    date: '21/11/2026',
    customer: 'Test Customer',
    items: mixedTaxItems(),
    coupon: 'SAVE10',
    subtotal: 780,
    discount: 78,
    tax: 51.48,
    total: 753.48,
    status: 'completed'
  };
  const db = {
    orders: [order],
    products: [],
    customers: []
  };
  const before = JSON.stringify(db);

  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(JSON.stringify(db), before);
});
