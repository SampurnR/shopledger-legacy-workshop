const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

const rice = { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 };

function amounts({ subtotal, discount, tax, cgst, sgst, total }) {
  return { subtotal, discount, tax, cgst, sgst, total };
}

test('checkout bills rice at the 5% HSN rate', () => {
  assert.deepEqual(amounts(pricing.computeTotals([rice], '')), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
});

test('invoice preserves item details and splits an odd paise of GST', () => {
  const item = { ...rice, price: 10.10, qty: 2, gstRate: 5 };
  const figures = invoice.computeInvoiceFigures({ items: [item] });
  assert.deepEqual(figures.rows, [{
    name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 10.10,
    gstPercent: 5, line: 20.20, lineTax: 1.01
  }]);
  assert.deepEqual(amounts(figures), {
    subtotal: 20.20, discount: 0, tax: 1.01, cgst: 0.51, sgst: 0.50, total: 21.21
  });
});

test('invoice uses the 5% rice slab when only HSN is stored', () => {
  const figures = invoice.computeInvoiceFigures({ items: [rice] });
  assert.deepEqual(amounts(figures), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
});

test('invoice caps SAVE10 at 150 before calculating GST', () => {
  const item = { name: 'Sample item', price: 2000, qty: 1, gstRate: 18 };
  const figures = invoice.computeInvoiceFigures({ items: [item], coupon: 'SAVE10' });
  assert.deepEqual(amounts(figures), {
    subtotal: 2000, discount: 150, tax: 333, cgst: 166.50, sgst: 166.50, total: 2183
  });
});

test('printable invoice matches the rice sale billed with SAVE10', () => {
  const order = {
    id: 42, items: [{ ...rice, price: 640 }], coupon: 'SAVE10',
    subtotal: 640, discount: 64, tax: 28.80, total: 604.80
  };
  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(figures), {
    subtotal: order.subtotal, discount: order.discount, tax: order.tax,
    cgst: 14.40, sgst: 14.40, total: order.total
  });
  const html = invoice.render(order);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹604\.80</);
  assert.match(html, /\(Total GST\)<\/td><td[^>]*>₹28\.80</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('flat coupon is shared across items before each HSN slab is taxed', () => {
  const items = [
    { ...rice, qty: 2 },
    { id: 2, name: 'Syrup', hsn: '2106', price: 300, qty: 1 }
  ];
  const figures = invoice.computeInvoiceFigures({ items, coupon: 'FLAT50' });
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 9], [18, 48.60]]);
  assert.deepEqual(amounts(figures), {
    subtotal: 500, discount: 50, tax: 57.60, cgst: 28.80, sgst: 28.80, total: 507.60
  });
});
