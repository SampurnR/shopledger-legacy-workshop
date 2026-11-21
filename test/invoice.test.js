const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function compare(items, coupon) {
  const billed = pricing.computeTotals(items, coupon);
  const figures = invoice.computeInvoiceFigures({ items, coupon });
  for (const key of ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total']) {
    assert.equal(figures[key], billed[key], key);
  }
  return figures;
}

test('invoice matches the billed HSN GST and total', () => {
  const items = [{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  const figures = compare(items, '');
  assert.deepEqual([figures.tax, figures.total, figures.rows[0].gstPercent], [32, 672, 5]);
});

test('invoice respects HSN slabs, quantities and mixed-rate line GST', () => {
  const figures = compare([
    { name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 2 }
  ], '');
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.line, row.lineTax]), [[5, 640, 32], [18, 200, 36]]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [68, 34, 34, 908]);
});

test('invoice applies the capped coupon before calculating line GST', () => {
  const figures = compare([{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }], 'SAVE10');
  assert.deepEqual([figures.discount, figures.tax, figures.total, figures.rows[0].lineTax], [150, 92.5, 1942.5, 92.5]);
});

test('invoice follows pricing for ineligible, inactive and eligible flat coupons', () => {
  const items = [{ name: 'Item', price: 100, qty: 1 }];
  assert.deepEqual([compare(items, 'FLAT50').discount, compare(items, 'DIWALI20').discount], [0, 0]);
  const flat = compare([{ name: 'Item', price: 400, qty: 1 }], 'FLAT50');
  assert.deepEqual([flat.discount, flat.tax, flat.total], [50, 63, 413]);
});

test('invoice uses the same explicit GST rate interpretation as billing', () => {
  const figures = compare([
    { name: 'Explicit', price: 100, qty: 1, gstRate: 5 },
    { name: 'Zero', price: 100, qty: 1, gstRate: 0 },
    { name: 'Decimal', price: 100, qty: 1, gstRate: 0.05 }
  ], '');
  assert.deepEqual(figures.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 5], [0, 0], [5, 5]]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [10, 5, 5, 310]);
});

test('invoice uses billing rounding for GST and the split', () => {
  const figures = compare([{ name: 'Item', price: 0.05, qty: 1 }], '');
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.01, 0.01, 0, 0.06]);
});

test('rendered invoice shows matching totals and warns when stored total differs', () => {
  const order = { id: 1, date: '01/01/2021', customer: 'A & B', total: 672,
    items: [{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }] };
  const html = invoice.render(order);
  assert.match(html, /A &amp; B/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(invoice.render({ ...order, total: 755.2 }), /differs from Order Ledger recorded total \(₹755\.20\) by -₹83\.20/);
});
