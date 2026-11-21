const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, price, qty, hsn, gstRate) {
  return { name, sku: name, price, qty, hsn, gstRate };
}

const cases = [
  {
    name: 'CURRENT BEHAVIOUR: #1001 mixed 5% and 12% items without coupon',
    coupon: '',
    items: [
      item('Tea', 140, 2, '0902', 18),
      item('Butter', 260, 1, '0405', 12),
      item('Dal', 165, 2, '0713', 5)
    ],
    expected: {
      subtotal: 870, discount: 0, tax: 98.1, cgst: 49.05,
      sgst: 49.05, total: 968.1, gstPercents: [18, 12, 5],
      lineTaxes: [50.4, 31.2, 16.5]
    }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1002 SAVE10 on subtotal',
    coupon: 'SAVE10',
    items: [
      item('Rice', 640, 1, '1006', 5),
      item('Oil', 190, 2, '1512', 5)
    ],
    expected: {
      subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95,
      sgst: 22.95, total: 963.9, gstPercents: [5, 5],
      lineTaxes: [28.8, 17.1]
    }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1004 SAVE10 capped at 150 on 2240 subtotal',
    coupon: 'SAVE10',
    items: [item('Groundnut oil', 1120, 2, '1508', 5)],
    expected: {
      subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25,
      sgst: 52.25, total: 2194.5, gstPercents: [5],
      lineTaxes: [104.5]
    }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008 all 18% items without coupon',
    coupon: '',
    items: [
      item('Tea', 140, 1, '0902', 18),
      item('Sherbet', 180, 2, '2106', 18)
    ],
    expected: {
      subtotal: 500, discount: 0, tax: 90, cgst: 45,
      sgst: 45, total: 590, gstPercents: [18, 18],
      lineTaxes: [25.2, 64.8]
    }
  }
];

for (const c of cases) {
  test(c.name, () => {
    const order = { id: 1, coupon: c.coupon, items: c.items };
    const actual = invoice.computeInvoiceFigures(order);
    const billed = pricing.computeTotals(c.items, c.coupon);
    const figures = {
      subtotal: actual.subtotal,
      discount: actual.discount,
      tax: actual.tax,
      cgst: actual.cgst,
      sgst: actual.sgst,
      total: actual.total,
      gstPercents: actual.rows.map(row => row.gstPercent),
      lineTaxes: actual.rows.map(row => row.lineTax)
    };

    assert.deepEqual(figures, c.expected);
    assert.deepEqual({
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      gstPercents: billed.lines.map(line => line.gstPercent),
      lineTaxes: billed.lines.map(line => line.tax)
    }, c.expected);
  });
}

test('invoice matches billed HSN GST with capped SAVE10 before tax', () => {
  const items = [
    item('Rice', 1120, 1, '1006', 5),
    item('Tea', 560, 2, '0902', 18)
  ];
  const order = { id: 2, coupon: 'SAVE10', items };
  const actual = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: actual.subtotal,
    discount: actual.discount,
    tax: actual.tax,
    cgst: actual.cgst,
    sgst: actual.sgst,
    total: actual.total,
    gstPercents: actual.rows.map(row => row.gstPercent),
    lineTaxes: actual.rows.map(row => row.lineTax)
  }, {
    subtotal: 2240,
    discount: 150,
    tax: 240.35,
    cgst: 120.18,
    sgst: 120.17,
    total: 2330.35,
    gstPercents: [5, 18],
    lineTaxes: [52.25, 188.1]
  });
});
