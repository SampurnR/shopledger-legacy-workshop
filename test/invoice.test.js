'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, price, qty, hsn, gstRate) {
  return { name, price, qty, hsn, gstRate };
}

const scenarios = [
  {
    name: 'CURRENT BEHAVIOUR: #1001-style 5% and 12% items without a coupon',
    coupon: '',
    items: [item('Rice', 640, 1, '1006', 5), item('Ghee', 450, 1, '0405', 12)],
    invoiceExpected: {
      subtotal: 1090, discount: 0, tax: 86, cgst: 43, sgst: 43, total: 1176,
      rows: [
        { gstPercent: 5, line: 640, lineTax: 32 },
        { gstPercent: 12, line: 450, lineTax: 54 }
      ]
    },
    pricingExpected: { subtotal: 1090, discount: 0, tax: 86, cgst: 43, sgst: 43, total: 1176 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1002-style SAVE10 discount is applied before tax',
    coupon: 'SAVE10',
    items: [item('Rice', 640, 1, '1006', 5), item('Sunflower oil', 190, 2, '1512', 5)],
    invoiceExpected: {
      subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
      rows: [
        { gstPercent: 5, line: 640, lineTax: 28.8 },
        { gstPercent: 5, line: 380, lineTax: 17.1 }
      ]
    },
    pricingExpected: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1004-style SAVE10 on ₹2,240 applies its cap before tax',
    coupon: 'SAVE10',
    items: [item('Groundnut oil', 1120, 2, '1508', 5)],
    invoiceExpected: {
      subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5,
      rows: [{ gstPercent: 5, line: 2240, lineTax: 104.5 }]
    },
    pricingExpected: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008-style all-18% order without a coupon',
    coupon: '',
    items: [item('Tea', 140, 1, '0902', 18), item('Kokum concentrate', 180, 2, '2106', 18)],
    invoiceExpected: {
      subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590,
      rows: [
        { gstPercent: 18, line: 140, lineTax: 25.2 },
        { gstPercent: 18, line: 360, lineTax: 64.8 }
      ]
    },
    pricingExpected: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 }
  }
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const order = { coupon: scenario.coupon, items: scenario.items };
    const invoiceFigures = invoice.computeInvoiceFigures(order);
    const pricingFigures = pricing.computeTotals(scenario.items, scenario.coupon);

    assert.deepEqual({
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      rows: invoiceFigures.rows.map(({ gstPercent, line, lineTax }) => ({ gstPercent, line, lineTax }))
    }, scenario.invoiceExpected);

    assert.deepEqual({
      subtotal: pricingFigures.subtotal,
      discount: pricingFigures.discount,
      tax: pricingFigures.tax,
      cgst: pricingFigures.cgst,
      sgst: pricingFigures.sgst,
      total: pricingFigures.total
    }, scenario.pricingExpected);
  });
}

test('invoice matches checkout totals and HSN tax for a saved #1004-style order', () => {
  const items = [item('Groundnut oil', 1120, 2, '1508', undefined)];
  const coupon = 'SAVE10';
  const invoiceFigures = invoice.computeInvoiceFigures({ coupon, items });
  const pricingFigures = pricing.computeTotals(items, coupon);

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    rows: invoiceFigures.rows.map(({ gstPercent, line, lineTax }) => ({ gstPercent, line, lineTax }))
  }, {
    subtotal: pricingFigures.subtotal,
    discount: pricingFigures.discount,
    tax: pricingFigures.tax,
    cgst: pricingFigures.cgst,
    sgst: pricingFigures.sgst,
    total: pricingFigures.total,
    rows: pricingFigures.lines.map(({ gstPercent, gross, tax }) => ({
      gstPercent,
      line: gross,
      lineTax: tax
    }))
  });
});
