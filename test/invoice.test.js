'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Synthetic orders model the requested scenarios, not copies of database records.
// Undefined gstRate represents an HSN-only line; explicit rates are percentages.
// No store imports, filesystem access, or production database fixtures.
function item(id, name, price, qty, hsn, gstRate) {
  return { id, name, sku: 'TEST-' + id, price, qty, hsn, gstRate };
}

const cases = [
  {
    name: 'CURRENT BEHAVIOUR: #1001 invoice uses HSN-only 5% and 12% slabs',
    order: {
      id: 1001,
      coupon: '',
      items: [
        item(1, 'Rice', 100, 2, '1006', undefined),
        item(2, 'Ghee', 300, 1, '0405', undefined)
      ]
    },
    invoice: {
      subtotal: 500, discount: 0, tax: 46,
      cgst: 23, sgst: 23, total: 546
    },
    invoiceLines: [[5, 200, 10], [12, 300, 36]],
    checkout: {
      subtotal: 500, discount: 0, taxable: 500, tax: 46,
      cgst: 23, sgst: 23, total: 546
    },
    // [GST percent, gross, allocated discount, taxable, tax, net]
    checkoutLines: [[5, 200, 0, 200, 10, 210], [12, 300, 0, 300, 36, 336]],
    sameTotal: true,
    sameTax: true
  },
  {
    name: 'CURRENT BEHAVIOUR: #1002 SAVE10 invoice applies discount before GST',
    order: {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        item(1, 'Rice', 100, 5, '1006', undefined),
        item(2, 'Ghee', 250, 2, '0405', undefined)
      ]
    },
    invoice: {
      subtotal: 1000, discount: 100, tax: 76.5,
      cgst: 38.25, sgst: 38.25, total: 976.5
    },
    invoiceLines: [[5, 500, 22.5], [12, 500, 54]],
    checkout: {
      subtotal: 1000, discount: 100, taxable: 900, tax: 76.5,
      cgst: 38.25, sgst: 38.25, total: 976.5
    },
    checkoutLines: [[5, 500, 50, 450, 22.5, 472.5], [12, 500, 50, 450, 54, 504]],
    sameTotal: true,
    sameTax: true
  },
  {
    name: 'CURRENT BEHAVIOUR: #1004 SAVE10 invoice respects the 150 cap on 2240',
    order: {
      id: 1004,
      coupon: 'SAVE10',
      items: [
        item(1, 'Rice', 80, 20, '1006', undefined),
        item(2, 'Ghee', 320, 2, '0405', undefined)
      ]
    },
    invoice: {
      subtotal: 2240, discount: 150, tax: 146.3,
      cgst: 73.15, sgst: 73.15, total: 2236.3
    },
    invoiceLines: [[5, 1600, 74.64], [12, 640, 71.66]],
    checkout: {
      subtotal: 2240, discount: 150, taxable: 2090, tax: 146.3,
      cgst: 73.15, sgst: 73.15, total: 2236.3
    },
    checkoutLines: [
      [5, 1600, 107.14, 1492.86, 74.64, 1567.5],
      [12, 640, 42.86, 597.14, 71.66, 668.8]
    ],
    sameTotal: true,
    sameTax: true
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008 all 18% without coupon agrees with checkout',
    order: {
      id: 1008,
      coupon: '',
      items: [
        item(1, 'Tea', 200, 2, '0902', 18),
        item(2, 'Coffee', 300, 1, '0901', undefined)
      ]
    },
    invoice: {
      subtotal: 700, discount: 0, tax: 126,
      cgst: 63, sgst: 63, total: 826
    },
    invoiceLines: [[18, 400, 72], [18, 300, 54]],
    checkout: {
      subtotal: 700, discount: 0, taxable: 700, tax: 126,
      cgst: 63, sgst: 63, total: 826
    },
    checkoutLines: [[18, 400, 0, 400, 72, 472], [18, 300, 0, 300, 54, 354]],
    sameTotal: true,
    sameTax: true
  },
  {
    name: 'CURRENT BEHAVIOUR: explicit-rate SAVE10 invoice matches checkout total and GST',
    order: {
      id: '1002-explicit-rates',
      coupon: 'SAVE10',
      items: [
        item(1, 'Rice', 100, 5, '1006', 5),
        item(2, 'Ghee', 250, 2, '0405', 12)
      ]
    },
    invoice: {
      subtotal: 1000, discount: 100, tax: 76.5,
      cgst: 38.25, sgst: 38.25, total: 976.5
    },
    invoiceLines: [[5, 500, 22.5], [12, 500, 54]],
    checkout: {
      subtotal: 1000, discount: 100, taxable: 900, tax: 76.5,
      cgst: 38.25, sgst: 38.25, total: 976.5
    },
    checkoutLines: [[5, 500, 50, 450, 22.5, 472.5], [12, 500, 50, 450, 54, 504]],
    sameTotal: true,
    sameTax: true
  }
];

for (const scenario of cases) {
  test(scenario.name, () => {
    const order = scenario.order;
    // Both functions receive the exact same item objects and coupon value.
    const figures = invoice.computeInvoiceFigures(order);
    const totals = pricing.computeTotals(order.items, order.coupon);
    const { rows, ...invoiceSummary } = figures;
    const { lines, ...checkoutSummary } = totals;

    // Literal expectations pin invoice and checkout totals independently.
    assert.deepEqual(invoiceSummary, scenario.invoice, 'invoice totals and GST split');
    assert.deepEqual(
      rows.map(row => [row.gstPercent, row.line, row.lineTax]),
      scenario.invoiceLines,
      'invoice per-line GST and gross'
    );
    assert.deepEqual(checkoutSummary, scenario.checkout, 'checkout totals and GST split');
    assert.deepEqual(
      lines.map(line => [
        line.gstPercent, line.gross, line.discount, line.taxable, line.tax, line.net
      ]),
      scenario.checkoutLines,
      'checkout coupon allocation and post-discount GST'
    );
    assert.equal(figures.total === totals.total, scenario.sameTotal, 'total agreement');
    assert.equal(figures.tax === totals.tax, scenario.sameTax, 'GST agreement');
  });
}

test('CURRENT BEHAVIOUR: printable invoice matches checkout figures', () => {
  for (const scenario of cases) {
    const order = scenario.order;
    const totals = pricing.computeTotals(order.items, order.coupon);
    const figures = invoice.computeInvoiceFigures(order);
    const { rows, ...summary } = figures;
    const { taxable, lines, ...checkoutSummary } = totals;

    assert.deepEqual(summary, checkoutSummary, 'checkout parity: ' + order.id);
    assert.deepEqual(
      rows.map(row => [row.gstPercent, row.line, row.lineTax]),
      lines.map(line => [line.gstPercent, line.gross, line.tax]),
      'per-line HSN slabs and post-discount GST: ' + order.id
    );

    const html = invoice.render({ ...order, total: totals.total });
    assert.ok(html.includes('₹' + totals.total.toFixed(2) + '</td>'), 'printable total');
    assert.ok(html.includes('₹' + totals.tax.toFixed(2) + '</td>'), 'printable GST');
    assert.ok(!html.includes('Accountant Reconciliation Notice:'), 'no false mismatch');
  }

  const capped = invoice.computeInvoiceFigures(cases[2].order);
  assert.equal(capped.subtotal, 2240);
  assert.equal(capped.discount, 150);
  assert.equal(capped.tax, 146.3);
  assert.equal(capped.total, 2236.3);
});

test('invoice matches checkout for decimal and zero GST with capped SAVE10', () => {
  const order = {
    coupon: 'SAVE10',
    items: [
      item(1, 'Rice', 80, 20, '1006', 0.05),
      item(2, 'Ghee', 320, 2, '0405', 0.12),
      item(3, 'Exempt item', 100, 1, '0902', 0)
    ]
  };
  const expected = {
    subtotal: 2340, discount: 150, tax: 146.75,
    cgst: 73.38, sgst: 73.37, total: 2336.75
  };
  const totals = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);
  const { taxable, lines, ...checkoutSummary } = totals;
  const { rows, ...invoiceSummary } = figures;

  assert.deepEqual(checkoutSummary, expected, 'checkout reference figures');
  assert.deepEqual(invoiceSummary, expected, 'invoice must match the billed figures');
  assert.deepEqual(
    rows.map(row => [row.gstPercent, row.lineTax]),
    [[5, 74.87], [12, 71.88], [0, 0]],
    'decimal rates are normalized and explicit zero overrides HSN'
  );

  const html = invoice.render({ ...order, id: 'regression', total: totals.total });
  assert.ok(html.includes('Coupon Discount (SAVE10)</td><td class="r" style="color:#16a34a">-₹150.00</td>'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});
