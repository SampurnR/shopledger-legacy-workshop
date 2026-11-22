const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: order pricing applies HSN GST after prorating a coupon discount', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { id: 2, name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
  ];

  assert.deepEqual(pricing.computeTotals(items, 'SAVE10'), {
    subtotal: 1020,
    discount: 102,
    taxable: 918,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 640, discount: 64, taxable: 576, tax: 28.8, net: 604.8 },
      { id: 2, name: 'Sunflower oil', hsn: '1512', gstPercent: 5, gross: 380, discount: 38, taxable: 342, tax: 17.1, net: 359.1 }
    ]
  });
});

test('invoice figures match checkout HSN tax and coupon totals', () => {
  const order = {
    id: 42,
    items: [
      { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 },
      { id: 2, name: 'Sunflower oil', sku: 'OIL', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10',
    total: 963.9
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 1, price: 640, gstPercent: 5, line: 640, lineTax: 28.8 },
      { name: 'Sunflower oil', sku: 'OIL', hsn: '1512', qty: 2, price: 190, gstPercent: 5, line: 380, lineTax: 17.1 }
    ]
  });
});

test('invoice uses checkout GST and matches the recorded billed total', () => {
  const html = invoice.render({
    id: 42,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: [{ name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 }],
    coupon: '',
    total: 672
  });

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">[^<]*32\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*672\.00/);
  assert.doesNotMatch(html, /Invoice computed total .*differs from Order Ledger recorded total/);
});

test('invoice applies expired coupon eligibility and interprets decimal gstRate as a fraction', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Sample', price: 200, qty: 1, gstRate: 0.05 }],
    coupon: 'DIWALI20'
  });

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 10);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 210);
});
