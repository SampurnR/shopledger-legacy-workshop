'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const tax = require('../lib/tax');

function mixedCart() {
  return [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 400, qty: 1 },
    { id: 2, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: 200, qty: 1 }
  ];
}

function recordedOrder() {
  const items = mixedCart();

  return {
    id: 1001,
    date: '22/11/2026',
    customer: 'In-memory characterization fixture',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: 'SAVE10',
    subtotal: 600,
    discount: 60,
    tax: 50.4,
    total: 590.4
  };
}

test('CURRENT BEHAVIOUR: order pricing apportions SAVE10 before applying each HSN GST slab', () => {
  const totals = pricing.computeTotals(mixedCart(), 'SAVE10');

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxable: totals.taxable,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      lines: totals.lines.map((line) => ({
        hsn: line.hsn,
        gstPercent: line.gstPercent,
        gross: line.gross,
        discount: line.discount,
        taxable: line.taxable,
        tax: line.tax
      }))
    },
    {
      subtotal: 600,
      discount: 60,
      taxable: 540,
      tax: 50.4,
      cgst: 25.2,
      sgst: 25.2,
      total: 590.4,
      lines: [
        { hsn: '1006', gstPercent: 5, gross: 400, discount: 40, taxable: 360, tax: 18 },
        { hsn: '0902', gstPercent: 18, gross: 200, discount: 20, taxable: 180, tax: 32.4 }
      ]
    }
  );
});

test('invoice matches the billed order total and HSN GST breakdown', () => {
  const order = recordedOrder();
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rows: figures.rows.map((row) => ({ gstPercent: row.gstPercent, lineTax: row.lineTax }))
    },
    {
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      cgst: 25.2,
      sgst: 25.2,
      total: order.total,
      rows: [
        { gstPercent: 5, lineTax: 18 },
        { gstPercent: 18, lineTax: 32.4 }
      ]
    }
  );
});

test('invoice renders the billed total without a reconciliation warning', () => {
  const order = recordedOrder();
  const rendered = invoice.render(order);

  assert.match(rendered, /Invoice Total<\/td><td class="r">₹590\.40/);
  assert.doesNotMatch(rendered, /Accountant Reconciliation Notice/);
});

test('invoice applies the same WHOLESALE15 cap and HSN GST as order pricing', () => {
  const items = [
    { id: 3, sku: 'BULK-1', name: 'Bulk tea', hsn: '0902', price: 3000, qty: 1 }
  ];
  const ledgerTotals = pricing.computeTotals(items, 'WHOLESALE15');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'WHOLESALE15' });

  assert.deepEqual(
    {
      ledgerDiscount: ledgerTotals.discount,
      ledgerTax: ledgerTotals.tax,
      ledgerTotal: ledgerTotals.total,
      invoiceDiscount: invoiceFigures.discount,
      invoiceTax: invoiceFigures.tax,
      invoiceTotal: invoiceFigures.total,
      invoiceLineTax: invoiceFigures.rows[0].lineTax
    },
    {
      ledgerDiscount: 400,
      ledgerTax: 468,
      ledgerTotal: 3068,
      invoiceDiscount: 400,
      invoiceTax: 468,
      invoiceTotal: 3068,
      invoiceLineTax: 468
    }
  );
});

test('invoice reconciliation matches billed totals and still skips cancelled orders', () => {
  const order = recordedOrder();
  const cancelledOrder = { ...order, id: 1002, status: 'cancelled' };

  const result = reports.getGstReconciliation({ orders: [order, cancelledOrder] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].orderId, 1001);
  assert.equal(result.rows[0].invoiceTax, 50.4);
  assert.equal(result.rows[0].ledgerTax, 50.4);
  assert.equal(result.rows[0].invoiceTotal, 590.4);
  assert.equal(result.rows[0].ledgerTotal, 590.4);
  assert.equal(result.rows[0].matched, true);
});

test('invoice handles decimal gstRate consistently with tax pricing', () => {
  const item = {
    id: 1,
    name: 'Rice',
    hsn: '1006',
    price: 100,
    qty: 1,
    gstRate: 0.05
  };

  assert.equal(tax.getRateForItem(item), 0.05);

  const figures = invoice.computeInvoiceFigures({ items: [item] });
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});
