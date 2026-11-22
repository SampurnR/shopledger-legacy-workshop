const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// All fixtures are in memory. Undefined gstRate models a line without an override.
// The #1001 model deliberately uses the requested 5% and 12% HSN slabs.
const cases = [
  {
    name: '#1001 uses 5% and 12% HSN slabs',
    id: 1001,
    coupon: '',
    items: [
      { id: 2, sku: 'DAL', name: 'Dal', price: 165, qty: 2, hsn: '0713', gstRate: undefined },
      { id: 6, sku: 'GHEE', name: 'Ghee', price: 450, qty: 1, hsn: '0405', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 780, discount: 0, tax: 70.5, cgst: 35.25, sgst: 35.25, total: 850.5 },
    invoiceRows: [
      { name: 'Dal', sku: 'DAL', hsn: '0713', qty: 2, price: 165, gstPercent: 5, line: 330, lineTax: 16.5 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 450, gstPercent: 12, line: 450, lineTax: 54 }
    ],
    pricingTotals: { subtotal: 780, discount: 0, tax: 70.5, cgst: 35.25, sgst: 35.25, total: 850.5 },
    pricingRates: [5, 12],
    pricingTaxes: [16.5, 54]
  },
  {
    name: '#1002 applies SAVE10 before GST',
    id: 1002,
    coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'RICE', name: 'Rice', price: 640, qty: 1, hsn: '1006', gstRate: undefined },
      { id: 4, sku: 'OIL', name: 'Oil', price: 190, qty: 2, hsn: '1512', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    invoiceRows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Oil', sku: 'OIL', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ],
    pricingTotals: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    pricingRates: [5, 5],
    pricingTaxes: [28.8, 17.1]
  },
  {
    name: '#1004 caps SAVE10 at 150 before GST',
    id: 1004,
    coupon: 'SAVE10',
    items: [
      { id: 5, sku: 'BULK-OIL', name: 'Bulk oil', price: 1120, qty: 2, hsn: '1508', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    invoiceRows: [
      { name: 'Bulk oil', sku: 'BULK-OIL', hsn: '1508', qty: 2, price: 1120, gstPercent: 5, line: 2240, lineTax: 104.5 }
    ],
    pricingTotals: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    pricingRates: [5],
    pricingTaxes: [104.5]
  },
  {
    name: 'CURRENT BEHAVIOUR: #1008 matches for all 18% items without a coupon',
    id: 1008,
    coupon: '',
    items: [
      { id: 8, sku: 'TEA', name: 'Tea', price: 140, qty: 1, hsn: '0902', gstRate: undefined },
      { id: 12, sku: 'SHERBET', name: 'Sherbet', price: 180, qty: 2, hsn: '2106', gstRate: undefined }
    ],
    invoiceTotals: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
    invoiceRows: [
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 1, price: 140, gstPercent: 18, line: 140, lineTax: 25.2 },
      { name: 'Sherbet', sku: 'SHERBET', hsn: '2106', qty: 2, price: 180, gstPercent: 18, line: 360, lineTax: 64.8 }
    ],
    pricingTotals: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
    pricingRates: [18, 18],
    pricingTaxes: [25.2, 64.8]
  }
];

for (const fixture of cases) {
  test(fixture.name, () => {
    const order = { id: fixture.id, items: fixture.items, coupon: fixture.coupon };
    const actualInvoice = invoice.computeInvoiceFigures(order);
    const actualPricing = pricing.computeTotals(order.items, order.coupon);

    assert.deepStrictEqual(actualInvoice, {
      ...fixture.invoiceTotals,
      rows: fixture.invoiceRows
    });
    const { subtotal, discount, tax, cgst, sgst, total } = actualPricing;
    assert.deepStrictEqual(
      { subtotal, discount, tax, cgst, sgst, total },
      fixture.pricingTotals
    );
    assert.deepStrictEqual(actualPricing.lines.map(line => line.gstPercent), fixture.pricingRates);
    assert.deepStrictEqual(actualPricing.lines.map(line => line.tax), fixture.pricingTaxes);
  });
}

test('invoice totals, GST rows and rendered amounts match checkout billing', () => {
  const scenarios = cases.concat([
    {
      items: [
        { name: 'Explicit percentage', price: 1120, qty: 1, hsn: '0902', gstRate: 5 },
        { name: 'Explicit decimal', price: 1120, qty: 1, hsn: '0902', gstRate: 0.12 },
        { name: 'Zero rate', price: 0.05, qty: 3, hsn: '0902', gstRate: 0 }
      ],
      coupon: 'SAVE10',
      pricingTotals: { subtotal: 2240.15, discount: 150, tax: 177.65, cgst: 88.83, sgst: 88.82, total: 2267.8 },
      pricingRates: [5, 12, 0],
      pricingTaxes: [52.25, 125.4, 0]
    }
  ]);

  for (const scenario of scenarios) {
    const billed = pricing.computeTotals(scenario.items, scenario.coupon);
    const order = { items: scenario.items, coupon: scenario.coupon, total: billed.total };
    const figures = invoice.computeInvoiceFigures(order);
    for (const field of ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total']) {
      assert.strictEqual(figures[field], scenario.pricingTotals[field], field);
      assert.strictEqual(figures[field], billed[field], field);
    }
    assert.deepStrictEqual(figures.rows.map(row => row.gstPercent), billed.lines.map(line => line.gstPercent));
    assert.deepStrictEqual(figures.rows.map(row => row.lineTax), billed.lines.map(line => line.tax));
    assert.deepStrictEqual(figures.rows.map(row => row.gstPercent), scenario.pricingRates);
    assert.deepStrictEqual(figures.rows.map(row => row.lineTax), scenario.pricingTaxes);
    const html = invoice.render(order);
    assert.ok(html.includes('<td>CGST</td><td class="r">₹' + billed.cgst.toFixed(2)));
    assert.ok(html.includes('<td>SGST</td><td class="r">₹' + billed.sgst.toFixed(2)));
    assert.ok(html.includes('₹' + billed.total.toFixed(2)));
    assert.ok(html.includes('₹' + billed.tax.toFixed(2)));
    assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  }
});
