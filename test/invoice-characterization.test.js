const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// All fixtures are in memory. These tests do not read or write data/db.json.
function order(id, items, coupon, totals) {
  return {
    id,
    date: '05/01/2022',
    customer: 'Workshop fixture',
    items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

function assertInvoiceMatchesCheckout(orderFixture) {
  const invoiceFigures = invoice.computeInvoiceFigures(orderFixture);
  const checkoutFigures = pricing.computeTotals(orderFixture.items, orderFixture.coupon);

  assert.deepEqual(
    {
      subtotal: invoiceFigures.subtotal,
      discount: invoiceFigures.discount,
      tax: invoiceFigures.tax,
      cgst: invoiceFigures.cgst,
      sgst: invoiceFigures.sgst,
      total: invoiceFigures.total,
      rows: invoiceFigures.rows.map(row => ({
        hsn: row.hsn,
        gstPercent: row.gstPercent,
        line: row.line,
        lineTax: row.lineTax
      }))
    },
    {
      subtotal: checkoutFigures.subtotal,
      discount: checkoutFigures.discount,
      tax: checkoutFigures.tax,
      cgst: checkoutFigures.cgst,
      sgst: checkoutFigures.sgst,
      total: checkoutFigures.total,
      rows: checkoutFigures.lines.map(line => ({
        hsn: line.hsn || '-',
        gstPercent: line.gstPercent,
        line: line.gross,
        lineTax: line.tax
      }))
    }
  );
}

const order1002 = order(1002, [
  { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
  { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
], 'SAVE10', { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 });

const order1004 = order(1004, [
  { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
], 'SAVE10', { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 });

const order1001 = order(1001, [
  { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
  { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
], '', { subtotal: 610, discount: 0, tax: 66.9, total: 676.9 });

const order1007 = order(1007, [
  { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
  { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
], '', { subtotal: 1280, discount: 0, tax: 127, total: 1407 });

const order1008 = order(1008, [
  { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
  { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
], '', { subtotal: 500, discount: 0, tax: 90, total: 590 });

test('order 1002 invoice matches checkout with SAVE10 and 5% HSN slabs', function () {
  assertInvoiceMatchesCheckout(order1002);
  const figures = invoice.computeInvoiceFigures(order1002);
  assert.deepEqual({ discount: figures.discount, tax: figures.tax, total: figures.total },
    { discount: 102, tax: 45.9, total: 963.9 });
});

test('order 1004 invoice respects the SAVE10 maximum discount', function () {
  assertInvoiceMatchesCheckout(order1004);
  const figures = invoice.computeInvoiceFigures(order1004);
  assert.deepEqual({ discount: figures.discount, tax: figures.tax, total: figures.total },
    { discount: 150, tax: 104.5, total: 2194.5 });
});

test('order 1001 invoice uses the 5% dal and 18% tea HSN slabs', function () {
  assertInvoiceMatchesCheckout(order1001);
  const figures = invoice.computeInvoiceFigures(order1001);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [18, 5]);
  assert.equal(figures.tax, 66.9);
});

test('order 1007 invoice uses the 12% ghee and 5% oil HSN slabs', function () {
  assertInvoiceMatchesCheckout(order1007);
  const figures = invoice.computeInvoiceFigures(order1007);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [12, 5]);
  assert.equal(figures.tax, 127);
});

test('order 1008 invoice still matches the 18% no-coupon checkout', function () {
  assertInvoiceMatchesCheckout(order1008);
  const figures = invoice.computeInvoiceFigures(order1008);
  assert.deepEqual({ tax: figures.tax, total: figures.total }, { tax: 90, total: 590 });
});
