const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// Synthetic in-memory fixtures; never load the application's database.
function discountedOrder() {
  return {
    id: 1002, date: '05/01/2022', customer: 'Test customer', coupon: 'SAVE10', total: 963.9,
    items: [
      { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Oil', sku: 'OIL', hsn: '1512', price: 190, qty: 2 }
    ]
  };
}

test('regression: #1002 equivalent invoice matches the billed discount, GST, and total', () => {
  const calc = invoice.computeInvoiceFigures(discountedOrder());
  assert.deepEqual({ discount: calc.discount, tax: calc.tax, total: calc.total }, {
    discount: 102, tax: 45.9, total: 963.9
  });
});

test('regression: SAVE10 invoice respects the 150 cap and taxes the remaining value at 5%', () => {
  const calc = invoice.computeInvoiceFigures({
    coupon: 'SAVE10', items: [{ id: 1, name: 'Rice', hsn: '1006', price: 2240, qty: 1 }]
  });
  assert.deepEqual({ discount: calc.discount, tax: calc.tax, total: calc.total }, {
    discount: 150, tax: 104.5, total: 2194.5
  });
});

test('regression: invoice rows expose allocated discounts and post-discount taxable values', () => {
  const calc = invoice.computeInvoiceFigures(discountedOrder());
  assert.deepEqual(calc.rows.map(row => ({
    gross: row.line, discount: row.discount, taxable: row.taxable,
    gstPercent: row.gstPercent, tax: row.lineTax
  })), [
    { gross: 640, discount: 64, taxable: 576, gstPercent: 5, tax: 28.8 },
    { gross: 380, discount: 38, taxable: 342, gstPercent: 5, tax: 17.1 }
  ]);
});

test('regression: printable invoice shows taxable values and CGST/SGST breakdown without a false warning', () => {
  const html = invoice.render(discountedOrder());
  assert.match(html, />Discount<\/th>/);
  assert.match(html, />Taxable Value<\/th>/);
  assert.match(html, /<td>CGST<\/td><td class="r">[^<]*22\.95<\/td>/);
  assert.match(html, /<td>SGST<\/td><td class="r">[^<]*22\.95<\/td>/);
  assert.match(html, /576\.00/);
  assert.match(html, /342\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});

test('empty or missing item lists produce zero invoice figures', () => {
  for (const order of [{ items: [] }, {}]) {
    const calc = invoice.computeInvoiceFigures(order);
    assert.deepEqual({ subtotal: calc.subtotal, discount: calc.discount, tax: calc.tax, total: calc.total, rows: calc.rows }, {
      subtotal: 0, discount: 0, tax: 0, total: 0, rows: []
    });
  }
});

test('a genuinely different stored total still produces a reconciliation warning', () => {
  const order = discountedOrder();
  order.total = 960;
  const html = invoice.render(order);
  assert.match(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /by \+[^<]*3\.90\./);
});
