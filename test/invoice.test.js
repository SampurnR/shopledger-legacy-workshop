'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, price, qty, hsn, gstRate) {
  return { name, price, qty, hsn, gstRate };
}

const cases = {
  order1001: {
    items: [
      item('Unpolished Toor Dal 1kg', 165, 2, '0713', 5),
      item('A2 Gir Cow Ghee 500ml', 140, 2, '0405', 12)
    ],
    coupon: '',
    invoice: { subtotal: 610, discount: 0, tax: 50.1, cgst: 25.05, sgst: 25.05, total: 660.1 },
    pricing: { subtotal: 610, discount: 0, tax: 50.1, total: 660.1 },
    rowTaxes: [16.5, 33.6]
  },
  order1002: {
    items: [
      item('Indrayani Basmati Rice 5kg', 640, 1, '1006', 5),
      item('Cold-Pressed Sunflower Oil 1L', 190, 2, '1512', 5)
    ],
    coupon: 'SAVE10',
    invoice: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    pricing: { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 },
    rowTaxes: [28.8, 17.1]
  },
  order1004: {
    items: [item('Cold-Pressed Groundnut Oil 5L', 1120, 2, '1508', 5)],
    coupon: 'SAVE10',
    invoice: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    pricing: { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 },
    rowTaxes: [104.5]
  },
  order1008: {
    items: [
      item('Assam CTC Masala Chai 250g', 140, 1, '0902', 18),
      item('Kokum Sherbet Concentrate 750ml', 180, 2, '2106', 18)
    ],
    coupon: '',
    invoice: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
    pricing: { subtotal: 500, discount: 0, tax: 90, total: 590 },
    rowTaxes: [25.2, 64.8]
  }
};

for (const [orderId, fixture] of Object.entries(cases)) {
  test(`CURRENT BEHAVIOUR: order #${orderId.slice(-4)} invoice figures`, () => {
    const order = { id: Number(orderId.slice(-4)), items: fixture.items, coupon: fixture.coupon };
    const invoiceFigures = invoice.computeInvoiceFigures(order);
    const checkoutFigures = pricing.computeTotals(fixture.items, fixture.coupon);

    assert.deepEqual(
      {
        subtotal: invoiceFigures.subtotal,
        discount: invoiceFigures.discount,
        tax: invoiceFigures.tax,
        cgst: invoiceFigures.cgst,
        sgst: invoiceFigures.sgst,
        total: invoiceFigures.total,
        rowTaxes: invoiceFigures.rows.map(row => row.lineTax)
      },
      { ...fixture.invoice, rowTaxes: fixture.rowTaxes }
    );

    assert.deepEqual(
      {
        subtotal: checkoutFigures.subtotal,
        discount: checkoutFigures.discount,
        tax: checkoutFigures.tax,
        total: checkoutFigures.total
      },
      fixture.pricing
    );
  });
}

test('CORRECT BEHAVIOUR: invoice matches checkout HSN tax and capped coupon', () => {
  const items = [
    { name: 'Cold-Pressed Groundnut Oil 5L', price: 1120, qty: 2, hsn: '1508' }
  ];
  const coupon = 'SAVE10';
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon });
  const checkoutFigures = pricing.computeTotals(items, coupon);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      lines: invoiceFigures.rows.map(row => ({
        hsn: row.hsn,
        gstPercent: row.gstPercent,
        gross: row.line,
        tax: row.lineTax
      }))
    },
    {
      subtotal: checkoutFigures.subtotal,
      discount: checkoutFigures.discount,
      tax: checkoutFigures.tax,
      cgst: checkoutFigures.cgst,
      sgst: checkoutFigures.sgst,
      total: checkoutFigures.total,
      lines: checkoutFigures.lines.map(line => ({
        hsn: line.hsn,
        gstPercent: line.gstPercent,
        gross: line.gross,
        tax: line.tax
      }))
    }
  );
});
