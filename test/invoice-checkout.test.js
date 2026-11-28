'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

var scenarios = [
  {
    name: 'HSN slab without a coupon',
    items: [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 }],
    coupon: ''
  },
  {
    name: 'proportional coupon discount across HSN slabs',
    items: [
      { id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { id: 8, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 }
    ],
    coupon: 'SAVE10'
  },
  {
    name: 'capped coupon discount',
    items: [{ id: 5, name: 'Oil', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10'
  },
  {
    name: 'flat coupon discount across HSN slabs',
    items: [
      { id: 7, name: 'Butter', sku: 'DRY-002', hsn: '0405', price: 260, qty: 1 },
      { id: 8, name: 'Tea', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 }
    ],
    coupon: 'FLAT50'
  }
];

test('invoice calculations match checkout totals and item GST breakdown', async function (t) {
  for (var i = 0; i < scenarios.length; i++) {
    await t.test(scenarios[i].name, function () {
      var scenario = scenarios[i];
      var checkout = pricing.computeTotals(scenario.items, scenario.coupon);
      var calculatedInvoice = invoice.computeInvoiceFigures({
        items: scenario.items,
        coupon: scenario.coupon
      });

      assert.deepEqual({
        subtotal: calculatedInvoice.subtotal,
        discount: calculatedInvoice.discount,
        tax: calculatedInvoice.tax,
        cgst: calculatedInvoice.cgst,
        sgst: calculatedInvoice.sgst,
        total: calculatedInvoice.total
      }, {
        subtotal: checkout.subtotal,
        discount: checkout.discount,
        tax: checkout.tax,
        cgst: checkout.cgst,
        sgst: checkout.sgst,
        total: checkout.total
      });

      assert.deepEqual(calculatedInvoice.rows.map(function (row) {
        return { gstPercent: row.gstPercent, lineTax: row.lineTax };
      }), checkout.lines.map(function (line) {
        return { gstPercent: line.gstPercent, lineTax: line.tax };
      }));
    });
  }
});
