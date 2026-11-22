'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// The historical order IDs identify requested scenarios; fixtures are kept
// in-memory because the JSON store is deliberately outside this test's scope.
function item(name, price, qty, hsn, gstRate) {
  return { name, price, qty, hsn, gstRate };
}

const cases = [
  {
    name: 'CURRENT BEHAVIOUR: #1001 mixed 5% and 12% items without a coupon',
    order: {
      id: 1001,
      coupon: '',
      items: [
        item('Rice', 640, 1, '1006', undefined),
        item('Ghee', 450, 1, '0405', undefined)
      ]
    },
    invoiceExpected: {
      subtotal: 1090,
      discount: 0,
      tax: 86,
      cgst: 43,
      sgst: 43,
      total: 1176,
      gstPercents: [5, 12],
      lineTaxes: [32, 54]
    },
    checkoutExpected: { subtotal: 1090, discount: 0, tax: 86, total: 1176 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1002 SAVE10 on a ₹780 mixed-slab cart',
    order: {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        item('Rice', 640, 1, '1006', undefined),
        item('Tea', 140, 1, '0902', undefined)
      ]
    },
    invoiceExpected: {
      subtotal: 780,
      discount: 78,
      tax: 51.48,
      cgst: 25.74,
      sgst: 25.74,
      total: 753.48,
      gstPercents: [5, 18],
      lineTaxes: [28.8, 22.68]
    },
    checkoutExpected: { subtotal: 780, discount: 78, tax: 51.48, total: 753.48 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1004 SAVE10 on ₹2,240 exceeds the checkout cap',
    order: {
      id: 1004,
      coupon: 'SAVE10',
      items: [item('Groundnut Oil', 1120, 2, '1508', undefined)]
    },
    invoiceExpected: {
      subtotal: 2240,
      discount: 150,
      tax: 104.5,
      cgst: 52.25,
      sgst: 52.25,
      total: 2194.5,
      gstPercents: [5],
      lineTaxes: [104.5]
    },
    checkoutExpected: { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008 all 18% items without a coupon',
    order: {
      id: 1008,
      coupon: '',
      items: [
        item('Coffee', 310, 1, '0901', undefined),
        item('Tea', 140, 1, '0902', undefined)
      ]
    },
    invoiceExpected: {
      subtotal: 450,
      discount: 0,
      tax: 81,
      cgst: 40.5,
      sgst: 40.5,
      total: 531,
      gstPercents: [18, 18],
      lineTaxes: [55.8, 25.2]
    },
    checkoutExpected: { subtotal: 450, discount: 0, tax: 81, total: 531 }
  }
];

for (const scenario of cases) {
  test(scenario.name, () => {
    const invoiceFigures = invoice.computeInvoiceFigures(scenario.order);
    const checkoutFigures = pricing.computeTotals(scenario.order.items, scenario.order.coupon);

    assert.deepEqual(
      {
        subtotal: invoiceFigures.subtotal,
        discount: invoiceFigures.discount,
        tax: invoiceFigures.tax,
        cgst: invoiceFigures.cgst,
        sgst: invoiceFigures.sgst,
        total: invoiceFigures.total,
        gstPercents: invoiceFigures.rows.map((row) => row.gstPercent),
        lineTaxes: invoiceFigures.rows.map((row) => row.lineTax)
      },
      scenario.invoiceExpected
    );

    assert.deepEqual(
      {
        subtotal: checkoutFigures.subtotal,
        discount: checkoutFigures.discount,
        tax: checkoutFigures.tax,
        total: checkoutFigures.total
      },
      scenario.checkoutExpected
    );
  });
}

test('invoice figures match checkout subtotal, discount, GST split, total, and line slabs', () => {
  for (const scenario of cases) {
    const invoiceFigures = invoice.computeInvoiceFigures(scenario.order);
    const checkoutFigures = pricing.computeTotals(scenario.order.items, scenario.order.coupon);

    assert.deepEqual(
      {
        subtotal: invoiceFigures.subtotal,
        discount: invoiceFigures.discount,
        tax: invoiceFigures.tax,
        cgst: invoiceFigures.cgst,
        sgst: invoiceFigures.sgst,
        total: invoiceFigures.total,
        gstPercents: invoiceFigures.rows.map((row) => row.gstPercent),
        lineTaxes: invoiceFigures.rows.map((row) => row.lineTax)
      },
      {
        subtotal: checkoutFigures.subtotal,
        discount: checkoutFigures.discount,
        tax: checkoutFigures.tax,
        cgst: checkoutFigures.cgst,
        sgst: checkoutFigures.sgst,
        total: checkoutFigures.total,
        gstPercents: checkoutFigures.lines.map((line) => line.gstPercent),
        lineTaxes: checkoutFigures.lines.map((line) => line.tax)
      },
      scenario.name
    );
  }
});
