'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// These fields model order line items as routes/orders.js currently saves them.
// It saves price, qty, and HSN, but does not populate gstRate; keeping that
// property undefined captures the invoice's current fallback-rate behavior.
const cases = [
  {
    name: 'CURRENT BEHAVIOUR: #1001 invoice uses item HSN slabs like checkout',
    coupon: '',
    items: [
      { name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', price: 165, qty: 2, gstRate: undefined },
      { name: 'Pasteurized Table Butter 500g', sku: 'DRY-002', hsn: '0405', price: 260, qty: 1, gstRate: undefined }
    ],
    invoice: { subtotal: 590, discount: 0, taxable: 590, tax: 47.7, cgst: 23.85, sgst: 23.85, total: 637.7 },
    invoiceRows: [{ gstPercent: 5, lineTax: 16.5 }, { gstPercent: 12, lineTax: 31.2 }],
    checkout: { subtotal: 590, discount: 0, tax: 47.7, total: 637.7 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1002 invoice applies SAVE10 to subtotal before GST',
    coupon: 'SAVE10',
    items: [
      { name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1, gstRate: undefined },
      { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2, gstRate: undefined }
    ],
    invoice: { subtotal: 1020, discount: 102, taxable: 918, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    invoiceRows: [{ gstPercent: 5, lineTax: 28.8 }, { gstPercent: 5, lineTax: 17.1 }],
    checkout: { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1004 invoice applies SAVE10 cap before 5% HSN GST',
    coupon: 'SAVE10',
    items: [
      { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2, gstRate: undefined }
    ],
    invoice: { subtotal: 2240, discount: 150, taxable: 2090, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    invoiceRows: [{ gstPercent: 5, lineTax: 104.5 }],
    checkout: { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008 invoice and checkout agree for 18% items without a coupon',
    coupon: '',
    items: [
      { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1, gstRate: undefined },
      { name: 'Kokum Sherbet Concentrate 750ml', sku: 'BEV-003', hsn: '2106', price: 180, qty: 2, gstRate: undefined }
    ],
    invoice: { subtotal: 500, discount: 0, taxable: 500, tax: 90, cgst: 45, sgst: 45, total: 590 },
    invoiceRows: [{ gstPercent: 18, lineTax: 25.2 }, { gstPercent: 18, lineTax: 64.8 }],
    checkout: { subtotal: 500, discount: 0, tax: 90, total: 590 }
  }
];

for (const scenario of cases) {
  test(scenario.name, () => {
    const order = { items: scenario.items, coupon: scenario.coupon };
    const invoiceFigures = invoice.computeInvoiceFigures(order);
    const checkoutFigures = pricing.computeTotals(scenario.items, scenario.coupon);

    assert.deepStrictEqual(
      {
        subtotal: invoiceFigures.subtotal,
        discount: invoiceFigures.discount,
        taxable: invoiceFigures.taxable,
        tax: invoiceFigures.tax,
        cgst: invoiceFigures.cgst,
        sgst: invoiceFigures.sgst,
        total: invoiceFigures.total
      },
      scenario.invoice
    );
    assert.deepStrictEqual(
      invoiceFigures.rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })),
      scenario.invoiceRows
    );
    assert.deepStrictEqual(
      {
        subtotal: checkoutFigures.subtotal,
        discount: checkoutFigures.discount,
        tax: checkoutFigures.tax,
        total: checkoutFigures.total
      },
      scenario.checkout
    );
  });
}

test('INVOICE MATCHES CHECKOUT: #1004 uses the HSN slab and capped pre-tax SAVE10 discount', () => {
  const items = [
    { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2, gstRate: undefined }
  ];
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });
  const checkoutFigures = pricing.computeTotals(items, 'SAVE10');

  assert.deepStrictEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      taxable: invoiceFigures.taxable,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    },
    {
      subtotal: 2240,
      discount: 150,
      taxable: 2090,
      tax: 104.5,
      cgst: 52.25,
      sgst: 52.25,
      total: 2194.5
    }
  );
  assert.deepStrictEqual(
    invoiceFigures.rows.map(({ gstPercent, lineDiscount, taxable, lineTax }) => ({ gstPercent, lineDiscount, taxable, lineTax })),
    [
      { gstPercent: 5, lineDiscount: 150, taxable: 2090, lineTax: 104.5 }
    ]
  );
  assert.deepStrictEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      taxable: invoiceFigures.taxable,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total
    },
    {
      subtotal: checkoutFigures.subtotal,
      discount: checkoutFigures.discount,
      taxable: checkoutFigures.taxable,
      tax: checkoutFigures.tax,
      cgst: checkoutFigures.cgst,
      sgst: checkoutFigures.sgst,
      total: checkoutFigures.total
    }
  );
  const rendered = invoice.render({ items, coupon: 'SAVE10', total: checkoutFigures.total });
  assert.ok(rendered.includes('5%'));
  assert.ok(rendered.includes('104.50'));
  assert.ok(rendered.includes('Taxable Subtotal'));
  assert.ok(rendered.includes('2090.00'));
  assert.ok(rendered.includes('2194.50'));
  assert.ok(rendered.indexOf('Coupon Discount') < rendered.indexOf('Taxable Subtotal'));
  assert.ok(rendered.indexOf('Taxable Subtotal') < rendered.indexOf('CGST + SGST'));
});
