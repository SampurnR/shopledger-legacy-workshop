'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(id, name, hsn, price, qty) {
  return { id, name, hsn, price, qty, gstRate: null };
}

function checkInvoiceMatchesCheckout(id, items, coupon, expected) {
  const checkout = pricing.computeTotals(items, coupon);
  const order = {
    id,
    items,
    coupon,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  };
  const figures = invoice.computeInvoiceFigures(order);

  const totals = value => ({
    subtotal: value.subtotal,
    discount: value.discount,
    tax: value.tax,
    cgst: value.cgst,
    sgst: value.sgst,
    total: value.total
  });
  assert.deepEqual(totals(checkout), expected.totals, 'checkout totals');
  assert.deepEqual(totals(figures), expected.totals, 'invoice totals');

  assert.deepEqual(
    figures.rows.map(row => ({
      hsn: row.hsn,
      gstPercent: row.gstPercent,
      gross: row.line,
      discount: row.discount,
      taxable: row.taxable,
      tax: row.lineTax
    })),
    checkout.lines.map(line => ({
      hsn: line.hsn,
      gstPercent: line.gstPercent,
      gross: line.gross,
      discount: line.discount,
      taxable: line.taxable,
      tax: line.tax
    })),
    'invoice line breakdown matches checkout pricing'
  );
  assert.deepEqual(
    figures.rows.map(row => ({
      hsn: row.hsn,
      gstPercent: row.gstPercent,
      gross: row.line,
      discount: row.discount,
      taxable: row.taxable,
      tax: row.lineTax
    })),
    expected.lines,
    'expected line HSN rates and tax amounts'
  );

  const html = invoice.render(order);
  assert.match(html, /Coupon Discount \(per line\)/);
  assert.match(html, /Taxable Value/);
  for (const line of expected.lines) {
    assert.ok(html.includes(line.hsn), `invoice shows HSN ${line.hsn}`);
    assert.ok(html.includes(`${line.gstPercent}%`), `invoice shows GST ${line.gstPercent}%`);
    assert.ok(html.includes(`₹${line.taxable.toFixed(2)}`), `invoice shows taxable value for HSN ${line.hsn}`);
    assert.ok(html.includes(`₹${line.tax.toFixed(2)}`), `invoice shows GST amount for HSN ${line.hsn}`);
  }
}

test('REGRESSION: #1001 uses each line HSN slab (18% tea, 5% dal)', () => {
  checkInvoiceMatchesCheckout(1001, [
    item(8, 'Assam CTC Masala Chai 250g', '0902', 140, 2),
    item(2, 'Unpolished Toor Dal 1kg', '0713', 165, 2)
  ], '', {
    totals: { subtotal: 610, discount: 0, tax: 66.9, cgst: 33.45, sgst: 33.45, total: 676.9 },
    lines: [
      { hsn: '0902', gstPercent: 18, gross: 280, discount: 0, taxable: 280, tax: 50.4 },
      { hsn: '0713', gstPercent: 5, gross: 330, discount: 0, taxable: 330, tax: 16.5 }
    ]
  });
});

test('REGRESSION: #1002 SAVE10 checkout total and GST match invoice', () => {
  checkInvoiceMatchesCheckout(1002, [
    item(1, 'Indrayani Basmati Rice 5kg', '1006', 640, 1),
    item(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
  ], 'SAVE10', {
    totals: { subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9 },
    lines: [
      { hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8 },
      { hsn: '1512', gstPercent: 5, gross: 380, discount: 38, taxable: 342, tax: 17.1 }
    ]
  });
});

test('REGRESSION: #1004 applies the capped ₹150 SAVE10 discount before GST', () => {
  checkInvoiceMatchesCheckout(1004, [
    item(5, 'Cold-Pressed Groundnut Oil 5L', '1508', 1120, 2)
  ], 'SAVE10', {
    totals: { subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5 },
    lines: [
      { hsn: '1508', gstPercent: 5, gross: 2240, discount: 150, taxable: 2090, tax: 104.5 }
    ]
  });
});

test('REGRESSION: #1007 uses the 12% ghee and 5% sunflower HSN slabs', () => {
  checkInvoiceMatchesCheckout(1007, [
    item(6, 'A2 Gir Cow Ghee 500ml', '0405', 450, 2),
    item(4, 'Cold-Pressed Sunflower Oil 1L', '1512', 190, 2)
  ], '', {
    totals: { subtotal: 1280, discount: 0, tax: 127, cgst: 63.5, sgst: 63.5, total: 1407 },
    lines: [
      { hsn: '0405', gstPercent: 12, gross: 900, discount: 0, taxable: 900, tax: 108 },
      { hsn: '1512', gstPercent: 5, gross: 380, discount: 0, taxable: 380, tax: 19 }
    ]
  });
});

test('REGRESSION: #1008 invoice remains equal to checkout at 18% GST', () => {
  checkInvoiceMatchesCheckout(1008, [
    item(8, 'Assam CTC Masala Chai 250g', '0902', 140, 1),
    item(12, 'Kokum Sherbet Concentrate 750ml', '2106', 180, 2)
  ], '', {
    totals: { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
    lines: [
      { hsn: '0902', gstPercent: 18, gross: 140, discount: 0, taxable: 140, tax: 25.2 },
      { hsn: '2106', gstPercent: 18, gross: 360, discount: 0, taxable: 360, tax: 64.8 }
    ]
  });
});
