const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeOrder(overrides = {}) {
  const items = overrides.items || [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ];
  const coupon = overrides.coupon || 'SAVE10';
  const charged = pricing.computeTotals(items, coupon);

  return {
    id: 1,
    date: '28/11/2026',
    customer: 'Test customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    total: charged.total,
    ...overrides
  };
}

test('invoice total and GST breakdown match the amount charged at checkout', () => {
  const items = [
    { id: 1, sku: 'RICE-5KG', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 }
  ];
  const charged = pricing.computeTotals(items, 'SAVE10');
  const billed = invoice.computeInvoiceFigures({
    id: 1009,
    items,
    coupon: 'SAVE10',
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    total: charged.total
  });

  assert.deepEqual(charged, {
    subtotal: 640,
    discount: 64,
    taxable: 576,
    tax: 28.8,
    cgst: 14.4,
    sgst: 14.4,
    total: 604.8,
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
      }
    ]
  });
  assert.deepEqual(
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      gstPercent: billed.rows[0].gstPercent,
      lineTax: billed.rows[0].lineTax
    },
    {
      subtotal: 640,
      discount: 64,
      tax: 28.8,
      cgst: 14.4,
      sgst: 14.4,
      total: 604.8,
      gstPercent: 5,
      lineTax: 28.8
    }
  );
});

test('invoice honors the SAVE10 maximum discount on a ₹2,240 order', () => {
  const items = [
    { id: 8, sku: 'TEA-BULK', name: 'Tea bulk pack', hsn: '0902', price: 2240, qty: 1 }
  ];
  const charged = pricing.computeTotals(items, 'SAVE10');
  const billed = invoice.computeInvoiceFigures({
    id: 1004,
    items,
    coupon: 'SAVE10',
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    total: charged.total
  });

  assert.equal(charged.discount, 150);
  assert.equal(charged.tax, 376.2);
  assert.equal(charged.total, 2466.2);
  assert.equal(billed.discount, charged.discount);
  assert.equal(billed.tax, charged.tax);
  assert.equal(billed.total, charged.total);
});

test('invoice uses the 12% HSN rate for a non-coupon order', () => {
  const items = [
    { id: 6, sku: 'GHEE-500', name: 'Ghee 500ml', hsn: '0405', price: 1000, qty: 1 }
  ];
  const charged = pricing.computeTotals(items, '');
  const billed = invoice.computeInvoiceFigures({
    id: 1007,
    items,
    coupon: '',
    subtotal: charged.subtotal,
    discount: charged.discount,
    tax: charged.tax,
    total: charged.total
  });

  assert.equal(billed.rows[0].gstPercent, 12);
  assert.equal(billed.rows[0].lineTax, 120);
  assert.equal(billed.tax, 120);
  assert.equal(billed.total, 1120);
});

test('invoice uses checkout HSN GST and coupon totals', () => {
  const order = makeOrder();
  const charged = pricing.computeTotals(order.items, order.coupon);
  const billed = invoice.computeInvoiceFigures(order);

  assert.equal(charged.subtotal, 1000);
  assert.equal(charged.discount, 100);
  assert.equal(charged.tax, 45);
  assert.equal(charged.total, 945);
  assert.equal(billed.subtotal, 1000);
  assert.equal(billed.discount, 100);
  assert.equal(billed.tax, 45);
  assert.equal(billed.total, 945);
});

test('invoice GST breakdown halves checkout GST', () => {
  const billed = invoice.computeInvoiceFigures(makeOrder());

  assert.equal(billed.cgst, 22.5);
  assert.equal(billed.sgst, 22.5);
  assert.equal(billed.rows[0].gstPercent, 5);
  assert.equal(billed.rows[0].lineTax, 45);
});

test('reconciliation matches invoice figures with stored checkout figures', () => {
  const order = makeOrder();
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 45);
  assert.equal(result.rows[0].invoiceTax, 45);
});

test('invoice and checkout use the same mixed HSN rates after a capped cart discount', () => {
  const items = [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, sku: 'GHEE-1', name: 'Ghee', hsn: '0405', price: 500, qty: 1 },
    { id: 3, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ];
  const order = makeOrder({ items, coupon: 'SAVE10' });
  const charged = pricing.computeTotals(items, order.coupon);
  const billed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(charged, {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 185,
    cgst: 92.5,
    sgst: 92.5,
    total: 2035,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 1000, discount: 75, taxable: 925, tax: 46.25, net: 971.25 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 500, discount: 37.5, taxable: 462.5, tax: 55.5, net: 518 },
      { id: 3, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 500, discount: 37.5, taxable: 462.5, tax: 83.25, net: 545.75 }
    ]
  });
  assert.equal(billed.discount, charged.discount);
  assert.equal(billed.tax, charged.tax);
  assert.equal(billed.cgst, charged.cgst);
  assert.equal(billed.sgst, charged.sgst);
  assert.equal(billed.total, charged.total);
  assert.deepEqual(billed.rows.map((row) => row.gstPercent), [5, 12, 18]);
});

test('invoice uses the stored figures that were billed for a historical order', () => {
  const order = makeOrder({
    subtotal: 1,
    discount: 2,
    tax: 3,
    total: 4
  });

  const billed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    },
    { subtotal: 1, discount: 2, tax: 3, total: 4 }
  );
  assert.equal(billed.rows[0].lineTax, 3);
});

test('reconciliation uses the stored GST billed for the order', () => {
  const order = makeOrder({ tax: 0 });
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.equal(result.rows[0].ledgerTax, 0);
  assert.equal(result.rows[0].invoiceTax, 0);
});

test('rendered invoice uses the stored GST billed for the order', () => {
  const order = makeOrder({ tax: 0 });
  const html = invoice.render(order);

  assert.equal(html.includes('Accountant Reconciliation Notice'), false);
  assert.equal(html.includes('CGST + SGST (Total GST)</td><td class="r">₹0.00'), true);
  assert.equal(html.includes('Invoice Total</td><td class="r">₹945.00'), true);
});
