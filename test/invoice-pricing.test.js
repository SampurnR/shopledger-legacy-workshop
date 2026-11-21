'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

function makeItems() {
  return [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 500, qty: 1 },
    { id: 2, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ];
}

test('CURRENT BEHAVIOUR: order pricing apportions coupon discount before applying each HSN GST slab', function () {
  const totals = pricing.computeTotals(makeItems(), 'SAVE10');

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxable: totals.taxable,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      lines: totals.lines.map(function (line) {
        return { hsn: line.hsn, gstPercent: line.gstPercent, taxable: line.taxable, tax: line.tax };
      })
    },
    {
      subtotal: 1000,
      discount: 100,
      taxable: 900,
      tax: 103.5,
      cgst: 51.75,
      sgst: 51.75,
      total: 1003.5,
      lines: [
        { hsn: '1006', gstPercent: 5, taxable: 450, tax: 22.5 },
        { hsn: '0902', gstPercent: 18, taxable: 450, tax: 81 }
      ]
    }
  );
});

test('invoice totals and GST lines match order pricing for HSN slabs and an apportioned coupon', function () {
  const items = makeItems();
  const billed = pricing.computeTotals(items, 'SAVE10');
  const order = {
    id: 1001,
    items: items,
    coupon: 'SAVE10',
    total: billed.total,
    tax: billed.tax
  };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rows: figures.rows.map(function (row) {
        return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
      })
    },
    {
      subtotal: 1000,
      discount: 100,
      tax: 103.5,
      cgst: 51.75,
      sgst: 51.75,
      total: 1003.5,
      rows: [
        { hsn: '1006', gstPercent: 5, lineTax: 22.5 },
        { hsn: '0902', gstPercent: 18, lineTax: 81 }
      ]
    }
  );
  assert.equal(figures.total, billed.total);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});

test('invoice applies the order-pricing coupon cap and taxes the discounted taxable amount', function () {
  const items = [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 10000, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({
    id: 1002,
    items: items,
    coupon: 'SAVE10',
    total: billed.total,
    tax: billed.tax
  });

  assert.deepEqual(
    {
      billedDiscount: billed.discount,
      billedTax: billed.tax,
      billedTotal: billed.total,
      invoiceDiscount: figures.discount,
      invoiceTax: figures.tax,
      invoiceCgst: figures.cgst,
      invoiceSgst: figures.sgst,
      invoiceTotal: figures.total
    },
    {
      billedDiscount: 150,
      billedTax: 492.5,
      billedTotal: 10342.5,
      invoiceDiscount: 150,
      invoiceTax: 492.5,
      invoiceCgst: 246.25,
      invoiceSgst: 246.25,
      invoiceTotal: 10342.5
    }
  );
});

test('invoice totals and GST lines match what order pricing billed for its HSN slabs', function () {
  const items = [
    { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
    { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
  ];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({
    id: 1001,
    items: items,
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rows: figures.rows.map(function (row) {
        return { hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax };
      })
    },
    {
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      cgst: billed.cgst,
      sgst: billed.sgst,
      total: billed.total,
      rows: [
        { hsn: '0902', gstPercent: 18, lineTax: 50.4 },
        { hsn: '0713', gstPercent: 5, lineTax: 16.5 }
      ]
    }
  );
});
