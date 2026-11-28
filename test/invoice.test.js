'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function item(name, sku, hsn, gstRate, price, qty) {
  return { id: sku, name, sku, hsn, gstRate, price, qty };
}

function assertCurrentInvoice(order, expected) {
  const totals = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepStrictEqual(figures, expected);
  assert.deepStrictEqual(figures, {
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
    rows: order.items.map((line, index) => ({
      name: line.name,
      sku: line.sku || '-',
      hsn: line.hsn || '-',
      qty: line.qty,
      price: line.price,
      gstPercent: totals.lines[index].gstPercent,
      line: totals.lines[index].gross,
      lineTax: totals.lines[index].tax
    }))
  });
}

test('CURRENT BEHAVIOUR: #1001 computes separate 5% and 12% GST lines without a coupon', () => {
  const order = {
    id: 1001,
    coupon: '',
    items: [
      item('Rice', 'RICE-01', '1006', null, 100, 2),
      item('Ghee', 'GHEE-01', '0405', null, 50, 3)
    ]
  };

  assertCurrentInvoice(order, {
    subtotal: 350,
    discount: 0,
    tax: 28,
    cgst: 14,
    sgst: 14,
    total: 378,
    rows: [
      { name: 'Rice', sku: 'RICE-01', hsn: '1006', qty: 2, price: 100, gstPercent: 5, line: 200, lineTax: 10 },
      { name: 'Ghee', sku: 'GHEE-01', hsn: '0405', qty: 3, price: 50, gstPercent: 12, line: 150, lineTax: 18 }
    ]
  });
});

test('CURRENT BEHAVIOUR: #1002 applies SAVE10 to the pre-tax subtotal and apportions it by line', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    items: [
      item('Rice', 'RICE-01', '1006', null, 150, 2),
      item('Ghee', 'GHEE-01', '0405', null, 100, 2)
    ]
  };

  assertCurrentInvoice(order, {
    subtotal: 500,
    discount: 50,
    tax: 35.1,
    cgst: 17.55,
    sgst: 17.55,
    total: 485.1,
    rows: [
      { name: 'Rice', sku: 'RICE-01', hsn: '1006', qty: 2, price: 150, gstPercent: 5, line: 300, lineTax: 13.5 },
      { name: 'Ghee', sku: 'GHEE-01', hsn: '0405', qty: 2, price: 100, gstPercent: 12, line: 200, lineTax: 21.6 }
    ]
  });
});

test('CURRENT BEHAVIOUR: #1004 caps SAVE10 at ₹150 on a ₹2,240 subtotal and shows undiscounted line gross', () => {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    items: [
      item('Rice', 'RICE-01', '1006', null, 500, 2),
      item('Ghee', 'GHEE-01', '0405', null, 320, 2),
      item('Tea', 'TEA-01', '0902', null, 300, 2)
    ]
  };

  assertCurrentInvoice(order, {
    subtotal: 2240,
    discount: 150,
    tax: 219.08,
    cgst: 109.54,
    sgst: 109.54,
    total: 2309.08,
    rows: [
      { name: 'Rice', sku: 'RICE-01', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 46.65 },
      { name: 'Ghee', sku: 'GHEE-01', hsn: '0405', qty: 2, price: 320, gstPercent: 12, line: 640, lineTax: 71.66 },
      { name: 'Tea', sku: 'TEA-01', hsn: '0902', qty: 2, price: 300, gstPercent: 18, line: 600, lineTax: 100.77 }
    ]
  });
});

test('CURRENT BEHAVIOUR: #1008 calculates 18% GST on every line without a coupon', () => {
  const order = {
    id: 1008,
    coupon: '',
    items: [
      item('Tea', 'TEA-01', '0902', null, 100, 2),
      item('Coffee', 'COFFEE-01', '0901', null, 50, 2)
    ]
  };

  assertCurrentInvoice(order, {
    subtotal: 300,
    discount: 0,
    tax: 54,
    cgst: 27,
    sgst: 27,
    total: 354,
    rows: [
      { name: 'Tea', sku: 'TEA-01', hsn: '0902', qty: 2, price: 100, gstPercent: 18, line: 200, lineTax: 36 },
      { name: 'Coffee', sku: 'COFFEE-01', hsn: '0901', qty: 2, price: 50, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
});
