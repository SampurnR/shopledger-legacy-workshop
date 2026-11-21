const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('a mixed-HSN SAVE10 invoice prints the GST and total recorded at checkout', () => {
  // Checkout stores the HSN on each order item and the billed amounts on the order.
  const items = [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 150, qty: 2 },
    { id: 2, name: 'Butter', sku: 'B', hsn: '0405', price: 200, qty: 1 }
  ];
  const { lines, ...billed } = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(billed, {
    subtotal: 500, discount: 50, taxable: 450, tax: 35.1,
    cgst: 17.55, sgst: 17.55, total: 485.1
  });
  assert.deepEqual(lines, [
    { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 300, discount: 30,
      taxable: 270, tax: 13.5, net: 283.5 },
    { id: 2, name: 'Butter', hsn: '0405', gstPercent: 12, gross: 200, discount: 20,
      taxable: 180, tax: 21.6, net: 201.6 }
  ]);

  const order = { id: 1, items, coupon: 'SAVE10', subtotal: billed.subtotal,
    discount: billed.discount, tax: billed.tax, total: billed.total };
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500, discount: 50, tax: 35.1, cgst: 17.55, sgst: 17.55, total: 485.1,
    rows: [
      { name: 'Rice', sku: 'R', hsn: '1006', qty: 2, price: 150,
        gstPercent: 5, line: 300, lineTax: 13.5 },
      { name: 'Butter', sku: 'B', hsn: '0405', qty: 1, price: 200,
        gstPercent: 12, line: 200, lineTax: 21.6 }
    ]
  });
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹35\.10</);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹485\.10</);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('an explicit 5% rate without a coupon gives matching totals and no reconciliation notice', () => {
  const items = [{ price: 20.2, qty: 1, gstRate: 5 }];
  const billed = pricing.computeTotals(items);
  const order = { items, total: billed.total };
  for (const figures of [billed, invoice.computeInvoiceFigures(order)]) {
    assert.equal(figures.tax, 1.01);
    assert.equal(figures.cgst, 0.51);
    assert.equal(figures.sgst, 0.50);
    assert.equal(figures.total, 21.21);
  }
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice honours explicit zero GST and decimal rates', () => {
  const items = [{ price: 100, qty: 1, gstRate: 0 }, { price: 100, qty: 1, gstRate: 0.05 }];
  const billed = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });
  assert.deepEqual(billed.lines.map(line => [line.gstPercent, line.tax]), [[0, 0], [5, 5]]);
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[0, 0], [5, 5]]);
});

test('invoice totals include each line’s rounded half-paise GST', () => {
  const items = [{ price: 0.1, qty: 1, gstRate: 5 }, { price: 0.1, qty: 1, gstRate: 5 }];
  const billed = pricing.computeTotals(items);
  const order = { items, total: billed.total };
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.total], [0.02, 0.22]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.22]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a one-paise difference from the saved ledger still prints a reconciliation notice', () => {
  const order = { items: [{ price: 1, qty: 1, gstRate: 0 }], total: 1.01 };
  assert.match(invoice.render(order), /by -₹0\.01/);
});

// Include older order shapes that today's checkout validation would reject.
for (const [description, coupon, price, discount, total] of [
  ['applies the SAVE10 cap', 'SAVE10', 2000, 150, 2183],
  ['ignores an expired coupon', 'DIWALI20', 1000, 0, 1180],
  ['ignores a flat coupon below its minimum', 'FLAT50', 20, 0, 23.6],
  ['recognizes a coupon with spaces and lowercase letters', ' save10 ', 500, 50, 531],
  ['charges GST on the discounted price with an eligible flat coupon', 'FLAT50', 300, 50, 295]
]) {
  test('invoice ' + description, () => {
    const items = [{ price, qty: 1, gstRate: 18 }];
    const billed = pricing.computeTotals(items, coupon);
    const printed = invoice.computeInvoiceFigures({ items, coupon });
    assert.deepEqual([billed.discount, billed.total], [discount, total]);
    assert.deepEqual([printed.discount, printed.total], [discount, total]);
  });
}
