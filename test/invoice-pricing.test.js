const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: order pricing applies the HSN rate and coupon to taxable value', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 600, qty: 1 }];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 600,
      discount: 60,
      taxable: 540,
      tax: 27,
      net: 567
    }]
  });
});

test('invoice figures match order pricing for HSN tax and coupon discount', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'GRN-001', hsn: '1006', price: 600, qty: 1 }];
  const charged = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.deepEqual({
    subtotal: invoiced.subtotal,
    discount: invoiced.discount,
    tax: invoiced.tax,
    cgst: invoiced.cgst,
    sgst: invoiced.sgst,
    total: invoiced.total,
    line: invoiced.rows[0]
  }, {
    subtotal: 600,
    discount: 60,
    tax: 27,
    cgst: 13.5,
    sgst: 13.5,
    total: 567,
    line: {
      name: 'Rice',
      sku: 'GRN-001',
      hsn: '1006',
      qty: 1,
      price: 600,
      gstPercent: 5,
      line: 600,
      lineTax: 27
    }
  });

  assert.equal(charged.total, 567);
});

test('invoice line amounts use the same currency rounding as order pricing', () => {
  const items = [{ id: 5, name: 'Rice', hsn: '1006', price: 0.335, qty: 1 }];
  const charged = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(charged.subtotal, 0.34);
  assert.equal(charged.tax, 0.02);
  assert.equal(charged.total, 0.36);
  assert.equal(invoiced.rows[0].line, 0.34);
  assert.equal(invoiced.rows[0].lineTax, 0.02);
  assert.equal(invoiced.total, charged.total);
});

test('invoice does not apply SAVE10 below its minimum order amount', () => {
  const items = [{ id: 2, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  assert.equal(pricing.computeTotals(items, 'SAVE10').discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' }).discount, 0);
});

test('invoice enforces SAVE10 maximum discount and matches order totals', () => {
  const items = [{ id: 3, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  const charged = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(charged.discount, 150);
  assert.equal(invoiced.discount, 150);
  assert.equal(charged.tax, 142.5);
  assert.equal(invoiced.tax, 142.5);
  assert.equal(charged.total, 2992.5);
  assert.equal(invoiced.total, 2992.5);
});

test('rendered invoice shows billed totals without a reconciliation warning when pricing matches', () => {
  const items = [{ id: 4, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const html = invoice.render({
    id: 1001,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: 'SAVE10',
    items,
    total: billed.total
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹27\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹567\.00/);
});
