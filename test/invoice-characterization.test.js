const { test } = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');
const ledger = require('../lib/ledger');

test('invoice uses order pricing rounding and CGST/SGST split for a fractional tax line', () => {
  const result = invoice.computeInvoiceFigures({
    items: [{ name: 'Fractional', price: 0.05, qty: 1 }]
  });

  assert.deepEqual(result, {
    subtotal: 0.05,
    discount: 0,
    tax: 0.01,
    cgst: 0.01,
    sgst: 0,
    total: 0.06,
    taxable: 0.05,
    rows: [{ name: 'Fractional', sku: '-', hsn: '-', qty: 1, price: 0.05,
      gstPercent: 18, line: 0.05, lineDiscount: 0, taxable: 0.05, lineTax: 0.01 }]
  });
});

test('invoice applies shared GST rate resolution for numeric gstRate, HSN, and fallback cases', () => {
  assert.equal(tax.getRateForItem({ gstRate: 5 }), 0.05);
  assert.equal(tax.getRateForItem({ gstRate: 0.12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: 'unknown' }), 0.18);
  assert.equal(tax.getRateForItem(null), 0.18);

  const result = invoice.computeInvoiceFigures({ items: [
    { name: 'gstRate-percent', price: 100, qty: 1, gstRate: 5 },
    { name: 'gstRate-decimal', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'hsn', price: 100, qty: 1, hsn: '1006' },
    { name: 'fallback', price: 100, qty: 1 }
  ] });

  assert.equal(result.subtotal, 400);
  assert.equal(result.tax, 33);
  assert.equal(result.cgst, 16.5);
  assert.equal(result.sgst, 16.5);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [5, 5, 5, 18]);
});

test('invoice and order pricing both treat decimal gstRate as a decimal rate and honor HSN slabs', () => {
  const result = invoice.computeInvoiceFigures({ items: [
    { name: 'HSN 5%', price: 100, qty: 1, hsn: '1006' },
    { name: 'decimal rate', price: 100, qty: 1, gstRate: 0.05 }
  ] });

  assert.equal(result.tax, 10);
  assert.deepEqual(result.rows.map(row => row.gstPercent), [5, 5]);
});

test('invoice uses the shared coupon validation, cap, and discount amount', () => {
  const percent = invoice.computeInvoiceFigures({ coupon: 'SAVE10', items: [
    { name: 'Below minimum', price: 100, qty: 1 }
  ] });
  const flat = invoice.computeInvoiceFigures({ coupon: 'FLAT50', items: [
    { name: 'Less than flat coupon', price: 20, qty: 1 }
  ] });

  assert.equal(percent.discount, 0);
  assert.equal(percent.total, 118);
  assert.equal(flat.discount, 0);
  assert.equal(flat.total, 23.6);
});

test('invoice matches order pricing after applying a valid coupon before GST', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const result = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual({ subtotal: result.subtotal, discount: result.discount, taxable: result.taxable,
    tax: result.tax, cgst: result.cgst, sgst: result.sgst, total: result.total }, {
    subtotal: 640, discount: 64, taxable: 576, tax: 28.8, cgst: 14.4, sgst: 14.4, total: 604.8
  });
  assert.equal(invoice.computeInvoiceFigures({ coupon: 'SAVE10', items }).total, 604.8);
});

test('invoice GST amount and split match billed values at cent-rounding boundaries', () => {
  const line = { id: 1, name: 'Odd tax', hsn: '1006', price: 0.1, qty: 1 };
  const billed = pricing.computeTotals([line], '');
  const invoiced = invoice.computeInvoiceFigures({ items: [line] });

  assert.equal(billed.tax, 0.01);
  assert.equal(billed.cgst, 0.01);
  assert.equal(billed.sgst, 0);
  assert.equal(invoiced.tax, 0.01);
  assert.equal(invoiced.cgst, 0.01);
  assert.equal(invoiced.sgst, 0);
  assert.equal(billed.total, 0.11);
  assert.equal(invoiced.total, 0.11);
});

test('invoice renderer displays the billed total and omits reconciliation warning when figures match', () => {
  const html = invoice.render({ id: 42, date: '01/02/2024', customer: 'Test customer',
    paymentMode: 'khata', coupon: 'SAVE10', status: 'completed', total: 604.8,
    items: [{ name: 'Rice', sku: 'R-1', hsn: '1006', price: 640, qty: 1 }] });

  assert.match(html, /Invoice Total<\/td><td class="r">₹604\.80/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹28\.80/);
});

test('Khata billing adds the order ledger total and respects the configured credit limit', () => {
  const db = { customers: [{ id: 7, name: 'In-memory customer', creditLimit: 700,
    openingBalance: 50, totalBilled: 100, totalSettled: 25 }] };

  assert.deepEqual(ledger.chargeOrderToKhata(db, 7, 604.8), {
    ok: false,
    error: 'Khata credit limit exceeded for In-memory customer (Limit: ₹700, Projected: ₹729.80)'
  });
  assert.equal(db.customers[0].totalBilled, 100);

  assert.equal(ledger.chargeOrderToKhata(db, 7, 500).ok, true);
  assert.equal(db.customers[0].totalBilled, 600);
  assert.equal(db.customers[0].balance, 625);
});
