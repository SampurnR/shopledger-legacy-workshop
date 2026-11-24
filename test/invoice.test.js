const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// Hand-built fixtures only: no store module or database access.
// Checkout snapshots omit gstRate; undefined preserves that calculation path.
// #1001 is adapted to the requested 5%/12% mix, not copied from the database.
const cases = [
  {
    name: 'invoice #1001 HSN-only 5%/12% items match checkout',
    order: {
      id: 1001, coupon: '',
      items: [
        { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2, gstRate: undefined },
        { id: 7, name: 'Butter', hsn: '0405', price: 260, qty: 1, gstRate: undefined }
      ]
    },
    invoice: { subtotal: 590, discount: 0, tax: 47.7, cgst: 23.85, sgst: 23.85, total: 637.7 },
    rows: [
      { hsn: '0713', gstPercent: 5, line: 330, lineTax: 16.5 },
      { hsn: '0405', gstPercent: 12, line: 260, lineTax: 31.2 }
    ],
    checkout: { subtotal: 590, discount: 0, tax: 47.7, cgst: 23.85, sgst: 23.85, total: 637.7 }
  },
  {
    name: 'invoice #1002 SAVE10 applies discount before HSN GST',
    order: {
      id: 1002, coupon: 'SAVE10',
      items: [
        { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1, gstRate: undefined },
        { id: 4, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2, gstRate: undefined }
      ]
    },
    invoice: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    rows: [
      { hsn: '1006', gstPercent: 5, line: 640, lineTax: 28.8 },
      { hsn: '1512', gstPercent: 5, line: 380, lineTax: 17.1 }
    ],
    checkout: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 }
  },
  {
    name: 'invoice #1004 respects SAVE10 cap on 2240 subtotal',
    order: {
      id: 1004, coupon: 'SAVE10',
      items: [
        { id: 5, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2, gstRate: undefined }
      ]
    },
    invoice: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    rows: [{ hsn: '1508', gstPercent: 5, line: 2240, lineTax: 104.5 }],
    checkout: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 }
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008 all-18% items without coupon match checkout',
    order: {
      id: 1008, coupon: '',
      items: [
        { id: 8, name: 'Tea', hsn: '0902', price: 140, qty: 1, gstRate: undefined },
        { id: 12, name: 'Kokum concentrate', hsn: '2106', price: 180, qty: 2, gstRate: undefined }
      ]
    },
    invoice: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
    rows: [
      { hsn: '0902', gstPercent: 18, line: 140, lineTax: 25.2 },
      { hsn: '2106', gstPercent: 18, line: 360, lineTax: 64.8 }
    ],
    checkout: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 }
  },
  {
    name: 'CURRENT BEHAVIOUR: explicit 5%/12% gstRate without coupon matches checkout',
    order: {
      coupon: '',
      items: [
        { id: 2, name: 'Dal', hsn: '0713', price: 165, qty: 2, gstRate: 5 },
        { id: 7, name: 'Butter', hsn: '0405', price: 260, qty: 1, gstRate: 12 }
      ]
    },
    invoice: { subtotal: 590, discount: 0, tax: 47.7, cgst: 23.85, sgst: 23.85, total: 637.7 },
    rows: [
      { hsn: '0713', gstPercent: 5, line: 330, lineTax: 16.5 },
      { hsn: '0405', gstPercent: 12, line: 260, lineTax: 31.2 }
    ],
    checkout: { subtotal: 590, discount: 0, tax: 47.7, cgst: 23.85, sgst: 23.85, total: 637.7 }
  }
];

function figures(result) {
  const { subtotal, discount, tax, cgst, sgst, total } = result;
  return { subtotal, discount, tax, cgst, sgst, total };
}

for (const fixture of cases) {
  test(fixture.name, () => {
    const order = fixture.order;
    const actualInvoice = invoice.computeInvoiceFigures(order);
    const actualCheckout = pricing.computeTotals(order.items, order.coupon);

    // Literal expectations pin invoice figures and per-line GST.
    // Checkout is also pinned; it is not used to generate invoice expectations.
    assert.deepStrictEqual(figures(actualInvoice), fixture.invoice, 'invoice figures');
    assert.deepStrictEqual(actualInvoice.rows.map(({ hsn, gstPercent, line, lineTax }) =>
      ({ hsn, gstPercent, line, lineTax })), fixture.rows, 'invoice line GST breakdown');
    assert.deepStrictEqual(figures(actualCheckout), fixture.checkout, 'checkout figures');
  });
}

test('invoice matches checkout for mixed HSN slabs and capped pre-tax SAVE10', () => {
  const order = {
    id: 2001, coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 2 },
      { id: 7, name: 'Butter', sku: 'BUTTER', hsn: '0405', price: 260, qty: 1 },
      { id: 8, name: 'Tea', sku: 'TEA', hsn: '0902', price: 140, qty: 5 }
    ]
  };
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const expected = {
    subtotal: 2240, discount: 150, tax: 206.38,
    cgst: 103.19, sgst: 103.19, total: 2296.38
  };
  assert.deepStrictEqual(figures(checkout), expected);
  const actual = invoice.computeInvoiceFigures(order);
  assert.deepStrictEqual(figures(actual), expected);
  assert.deepStrictEqual(actual.rows.map(({ gstPercent, lineTax }) =>
    ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 59.71 },
    { gstPercent: 12, lineTax: 29.11 },
    { gstPercent: 18, lineTax: 117.56 }
  ]);
  const html = invoice.render({ ...order, ...expected });
  assert.match(html, /Invoice Total<\/td><td class="r">₹2296\.38/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹206\.38/);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-₹150\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
