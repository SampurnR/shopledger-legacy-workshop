'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const tax = require('../lib/tax');

test('invoice GST breakdown and total match the amount billed for an HSN-priced order', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 1000, qty: 2 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({
    id: 20,
    items,
    coupon: 'SAVE10',
    ...billed
  });

  assert.deepEqual({
    subtotal: invoiceFigures.subtotal,
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    cgst: invoiceFigures.cgst,
    sgst: invoiceFigures.sgst,
    total: invoiceFigures.total,
    gstPercent: invoiceFigures.rows[0].gstPercent,
    lineTax: invoiceFigures.rows[0].lineTax
  }, {
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    cgst: billed.cgst,
    sgst: billed.sgst,
    total: billed.total,
    gstPercent: billed.lines[0].gstPercent,
    lineTax: billed.lines[0].tax
  });
});

test('CURRENT BEHAVIOUR: pricing applies HSN rates after apportioning a coupon over lines', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', sku: 'T', hsn: '0902', price: 100, qty: 1 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'WELCOME'), {
    subtotal: 300,
    discount: 15,
    taxable: 285,
    tax: 26.6,
    cgst: 13.3,
    sgst: 13.3,
    total: 311.6,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 200, discount: 10, taxable: 190, tax: 9.5, net: 199.5 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 5, taxable: 95, tax: 17.1, net: 112.1 }
    ]
  });
});

test('invoice total, discount, and HSN GST match the values used to bill the order', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 1000, qty: 2 }
  ];
  const ledger = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 10, items, coupon: 'SAVE10', total: ledger.total, tax: ledger.tax };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 2000,
    discount: 150,
    tax: 92.5,
    cgst: 46.25,
    sgst: 46.25,
    total: 1942.5,
    rows: [
      { name: 'Rice', sku: 'R', hsn: '1006', qty: 2, price: 1000, gstPercent: 5, line: 2000, lineTax: 92.5 }
    ]
  });
  assert.equal(ledger.discount, 150);
  assert.equal(ledger.tax, 92.5);
  assert.equal(ledger.total, 1942.5);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice and pricing use the same decimal gstRate interpretation', () => {
  const item = { id: 3, name: 'Sample', hsn: '1006', price: 100, qty: 1, gstRate: 0.05 };
  const order = { items: [item], coupon: '' };

  assert.equal(tax.getRateForItem(item), 0.05);
  assert.equal(pricing.computeTotals([item], '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures(order).tax, 5);
  assert.equal(invoice.computeInvoiceFigures(order).rows[0].gstPercent, 5);
});

test('GST reconciliation reports matching active in-memory orders and skips cancelled orders', () => {
  const items = [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Tea', sku: 'T', hsn: '0902', price: 100, qty: 1 }
  ];
  const totals = pricing.computeTotals(items, 'WELCOME');
  const activeOrder = {
    id: 11,
    date: '01/01/2026',
    customer: 'In-memory customer',
    status: 'completed',
    items,
    coupon: 'WELCOME',
    ...totals
  };
  const cancelledOrder = { ...activeOrder, id: 12, status: 'cancelled' };

  const result = reports.getGstReconciliation({ orders: [activeOrder, cancelledOrder] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 11,
    date: '01/01/2026',
    customer: 'In-memory customer',
    coupon: 'WELCOME',
    ledgerSubtotal: 300,
    ledgerDiscount: 15,
    ledgerTax: 26.6,
    ledgerTotal: 311.6,
    invoiceDiscount: 15,
    invoiceTax: 26.6,
    invoiceTotal: 311.6,
    delta: 0,
    matched: true
  });
});
