const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('order pricing uses the HSN slab and taxes the discounted amount', () => {
  // This is the line shape persisted by routes/orders.js: no gstRate field.
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  const totals = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 10,
      taxable: 190,
      tax: 9.5,
      net: 199.5
    }]
  });
});

test('invoice matches order pricing for HSN items and a coupon', () => {
  const order = {
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    coupon: 'WELCOME'
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 10,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 2,
      price: 100,
      gstPercent: 5,
      line: 200,
      lineTax: 9.5
    }]
  });
});

test('rendered invoice total matches the order ledger total', () => {
  const html = invoice.render({
    id: 1,
    date: '2026-11-21',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    coupon: 'WELCOME',
    total: 199.5
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹199\.50/);
});

test('a stored gstRate is treated as a whole percent in the invoice', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 5 }],
    coupon: ''
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 100,
    discount: 0,
    tax: 5,
    cgst: 2.5,
    sgst: 2.5,
    total: 105,
    rows: [{
      name: 'Rice',
      sku: '-',
      hsn: '1006',
      qty: 1,
      price: 100,
      gstPercent: 5,
      line: 100,
      lineTax: 5
    }]
  });
});

test('invoice matches checkout for order 1002 with SAVE10', () => {
  const order = {
    items: [
      { id: 1, name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10'
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
});

test('invoice uses each HSN slab for order 1007 without a coupon', () => {
  const order = {
    items: [
      { name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
      { name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: ''
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.tax, 127);
  assert.equal(figures.total, 1407);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [12, 5]);
});

test('invoice applies SAVE10 maximum discount for order 1004', () => {
  const order = {
    items: [{ name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }],
    coupon: 'SAVE10'
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 104.5);
  assert.equal(figures.total, 2194.5);
});
