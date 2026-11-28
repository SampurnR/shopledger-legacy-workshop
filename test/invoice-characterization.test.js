const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function orderWithHsnItems(coupon = '') {
  return {
    id: 9001,
    customer: 'Test customer',
    coupon,
    items: [
      {
        id: 1,
        sku: 'GRN-001',
        name: 'Rice',
        hsn: '1006',
        price: 640,
        qty: 1
      },
      {
        id: 8,
        sku: 'BEV-001',
        name: 'Tea',
        hsn: '0902',
        price: 140,
        qty: 1
      }
    ]
  };
}

test('CURRENT BEHAVIOUR: order pricing uses HSN GST rates and taxes the discounted subtotal', () => {
  const order = orderWithHsnItems('SAVE10');
  const totals = pricing.computeTotals(order.items, order.coupon);

  assert.deepStrictEqual(totals, {
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
        name: 'Rice',
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
        name: 'Tea',
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

test('CURRENT BEHAVIOUR: invoice calculation uses the same HSN slabs as order pricing', () => {
  const figures = invoice.computeInvoiceFigures(orderWithHsnItems());

  assert.equal(figures.subtotal, 780);
  assert.equal(figures.tax, 57.2);
  assert.equal(figures.cgst, 28.6);
  assert.equal(figures.sgst, 28.6);
  assert.equal(figures.total, 837.2);
  assert.deepStrictEqual(figures.rows.map((row) => ({
    hsn: row.hsn,
    gstPercent: row.gstPercent,
    lineTax: row.lineTax
  })), [
    { hsn: '1006', gstPercent: 5, lineTax: 32 },
    { hsn: '0902', gstPercent: 18, lineTax: 25.2 }
  ]);
});

test('CURRENT BEHAVIOUR: invoice percentage coupon follows order pricing on the taxable subtotal', () => {
  const order = orderWithHsnItems('SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 78);
  assert.equal(figures.tax, 51.48);
  assert.equal(figures.total, 753.48);

  const ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  assert.equal(ledgerFigures.discount, 78);
  assert.equal(ledgerFigures.tax, 51.48);
  assert.equal(ledgerFigures.total, 753.48);
  assert.equal(figures.total, ledgerFigures.total);
});

test('CURRENT BEHAVIOUR: rendered invoice has no reconciliation warning when totals match the stored order', () => {
  const order = orderWithHsnItems('SAVE10');
  const ledgerFigures = pricing.computeTotals(order.items, order.coupon);
  order.subtotal = ledgerFigures.subtotal;
  order.discount = ledgerFigures.discount;
  order.tax = ledgerFigures.tax;
  order.total = ledgerFigures.total;

  const html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.doesNotMatch(html, /Invoice computed total/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('CORRECT BEHAVIOUR: invoice GST and total match the amount billed by order pricing', () => {
  const order = orderWithHsnItems('SAVE10');
  const billed = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
  assert.deepStrictEqual(figures.rows.map((row) => ({
    hsn: row.hsn,
    gstPercent: row.gstPercent,
    lineTax: row.lineTax
  })), billed.lines.map((line) => ({
    hsn: line.hsn,
    gstPercent: line.gstPercent,
    lineTax: line.tax
  })));
});
