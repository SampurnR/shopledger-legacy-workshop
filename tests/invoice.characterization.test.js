'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const repoRoot = process.env.SHOPLEDGER_ROOT || path.resolve(__dirname, '..');
const invoice = require(path.join(repoRoot, 'lib', 'invoice'));

function order(id, items, coupon, total) {
  return { id, date: '15/03/2022', customer: 'Workshop fixture', items, coupon, total };
}

test('invoice uses checkout coupon and GST totals for order 1002', () => {
  const result = invoice.computeInvoiceFigures(order(1002, [
    { name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
    { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10', 963.90));

  assert.equal(result.subtotal, 1020);
  assert.equal(result.discount, 102);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [5, 5]);
  assert.equal(result.tax, 45.9);
  assert.equal(result.total, 963.90);
});

test('invoice respects SAVE10 maximum discount and 5% HSN for order 1004', () => {
  const result = invoice.computeInvoiceFigures(order(1004, [
    { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10', 2194.50));

  assert.equal(result.subtotal, 2240);
  assert.equal(result.discount, 150);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [5]);
  assert.equal(result.tax, 104.5);
  assert.equal(result.total, 2194.50);
});

test('invoice uses mixed 18% and 5% HSN rates for order 1001', () => {
  const result = invoice.computeInvoiceFigures(order(1001, [
    { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 2 },
    { name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', price: 165, qty: 2 }
  ], '', 676.90));

  assert.deepEqual(result.rows.map(row => row.gstPercent), [18, 5]);
  assert.equal(result.tax, 66.9);
  assert.equal(result.total, 676.90);
});

test('invoice uses mixed 12% and 5% HSN rates for order 1007', () => {
  const result = invoice.computeInvoiceFigures(order(1007, [
    { name: 'A2 Gir Cow Ghee 500ml', sku: 'DRY-001', hsn: '0405', price: 450, qty: 2 },
    { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
  ], '', 1407));

  assert.deepEqual(result.rows.map(row => row.gstPercent), [12, 5]);
  assert.equal(result.tax, 127);
  assert.equal(result.total, 1407);
});

test('invoice still matches order 1008 when all items use 18% GST and no coupon', () => {
  const result = invoice.computeInvoiceFigures(order(1008, [
    { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 },
    { name: 'Kokum Sherbet Concentrate 750ml', sku: 'BEV-003', hsn: '2106', price: 180, qty: 2 }
  ], '', 590));

  assert.deepEqual(result.rows.map(row => row.gstPercent), [18, 18]);
  assert.equal(result.tax, 90);
  assert.equal(result.total, 590);
});

test('rendered invoice shows the corrected total and GST for order 1002', () => {
  const html = invoice.render(order(1002, [
    { name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
    { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10', 963.90));

  assert.match(html, /Invoice Total<\/td><td class="r">[^0-9]*963\.90<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^0-9]*45\.90<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td class="r" style="color:#16a34a">-[^0-9]*102\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
