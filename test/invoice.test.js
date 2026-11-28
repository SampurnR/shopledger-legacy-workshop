const assert = require('node:assert/strict');
const { test } = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function billedOrder(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 101, date: '15/01/2021', items, coupon, subtotal, discount, tax, total };
}

test('a mixed-GST invoice with a capped coupon matches the billed total and tax breakdown', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 12 },
    { name: 'Butter', hsn: '0405', price: 200, qty: 4 }
  ], 'SAVE10');
  const { discount, tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount, tax, cgst, sgst, total }, {
    discount: 150, tax: 144.3, cgst: 72.15, sgst: 72.15, total: 1994.3
  });
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 5, lineTax: 55.5 },
    { gstPercent: 12, lineTax: 88.8 }
  ]);
  const html = invoice.render(order);
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹144.30</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹1994.30</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice uses an explicit whole-percent GST rate and splits the tax', () => {
  const order = billedOrder([
    { name: 'Test item', sku: 'TEST-1', hsn: '1006', price: 100, qty: 2, gstRate: 12 }
  ]);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 24,
    cgst: 12,
    sgst: 12,
    total: 224,
    rows: [
      { name: 'Test item', sku: 'TEST-1', hsn: '1006', price: 100, qty: 2, gstPercent: 12, line: 200, lineTax: 24 }
    ]
  });
  assert.equal(order.total, 224);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('HSN-only lines use the billed GST slabs in the figures and printout', () => {
  const order = billedOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Butter', hsn: '0405', price: 100, qty: 1 }
  ]);
  const { subtotal, tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 22);
  assert.equal(order.total, 322);
  assert.deepEqual({ subtotal, tax, cgst, sgst, total }, {
    subtotal: 300, tax: 22, cgst: 11, sgst: 11, total: 322
  });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 10 },
    { hsn: '0405', gstPercent: 12, lineTax: 12 }
  ]);

  const html = invoice.render(order);
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹22.00</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹322.00</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('the invoice calculates GST after applying a flat coupon', () => {
  const order = billedOrder([{ hsn: '0902', price: 500, qty: 1 }], 'FLAT50');
  const { discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(order.tax, 81);
  assert.equal(order.total, 531);
  assert.deepEqual({ discount, tax, cgst, sgst, total }, {
    discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
});

test('a percentage coupon below its cap matches the billed discount, GST, and total', () => {
  const order = billedOrder([{ hsn: '0902', price: 1000, qty: 1 }], 'SAVE10');
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 100);
  assert.equal(order.tax, 162);
  assert.equal(order.total, 1062);
  assert.deepEqual({ discount, tax, total }, { discount: 100, tax: 162, total: 1062 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('the invoice honours the billed percentage coupon cap', () => {
  const order = billedOrder([{ hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const { discount, tax, total } = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 333);
  assert.equal(order.total, 2183);
  assert.deepEqual({ discount, tax, total }, { discount: 150, tax: 333, total: 2183 });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('an invoice uses the billed discount even when the coupon is now inactive', () => {
  const order = {
    items: [{ hsn: '0902', price: 800, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 800,
    discount: 160,
    tax: 115.2,
    total: 755.2
  };
  const { discount, tax, total, rows } = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ discount, tax, total }, { discount: 160, tax: 115.2, total: 755.2 });
  assert.equal(rows[0].lineTax, 115.2);
});

test('the invoice uses checkout semantics for explicit zero and fractional rates', () => {
  const order = billedOrder([
    { name: 'Zero-rate item', price: 1000, qty: 1, gstRate: 0 },
    { name: 'Fractional-rate item', price: 1000, qty: 1, gstRate: 0.05 }
  ]);
  const { tax, total, rows } = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 50);
  assert.equal(order.total, 2050);
  assert.equal(tax, 50);
  assert.equal(total, 2050);
  assert.deepEqual(rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })), [
    { gstPercent: 0, lineTax: 0 },
    { gstPercent: 5, lineTax: 50 }
  ]);
});

test('the invoice aggregates the same rounded line GST amounts as checkout', () => {
  const order = billedOrder([
    { hsn: '0902', price: 100.03, qty: 1 },
    { hsn: '0902', price: 200.03, qty: 1 }
  ]);
  const { tax, cgst, sgst, total, rows } = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 54.02);
  assert.equal(order.total, 354.08);
  assert.deepEqual(rows.map(row => row.lineTax), [18.01, 36.01]);
  assert.deepEqual({ tax, cgst, sgst, total }, { tax: 54.02, cgst: 27.01, sgst: 27.01, total: 354.08 });
});

test('a historical printout displays the recorded amounts and flags a difference from reconstructed line GST', () => {
  const order = {
    ...billedOrder([{ hsn: '1006', price: 100, qty: 1 }]),
    tax: 12,
    total: 112
  };
  const html = invoice.render(order);

  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹12.00</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹112.00</td>'));
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Reconstructed GST \(₹5\.00\)/);
  assert.match(html, /Reconstructed total \(₹105\.00\)/);
});

test('historical amounts saved as numeric strings are preserved on the invoice', () => {
  const order = {
    ...billedOrder([{ hsn: '1006', price: 100, qty: 1 }]),
    subtotal: '100.00',
    discount: '10.00',
    tax: '12.00',
    total: '102.00'
  };
  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(figures.discount, 10);
  assert.equal(figures.rows[0].lineTax, 4.5);
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹12.00</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹102.00</td>'));
  assert.match(html, /Accountant Reconciliation Notice/);
});

test('a reprint warns if the recorded subtotal disagrees with the item subtotal', () => {
  const order = billedOrder([{ hsn: '1006', price: 100, qty: 1 }]);
  order.subtotal = 90;
  const html = invoice.render(order);

  assert.ok(html.includes('<td>Gross Subtotal</td><td class="r">₹90.00</td>'));
  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Reconstructed subtotal \(₹100\.00\) differs from the recorded subtotal \(₹90\.00\)/);
});

test('the printout warns about a GST discrepancy even when the final total matches', () => {
  const order = billedOrder([{ hsn: '0902', price: 1000, qty: 1 }], 'SAVE10');
  order.tax += 1;
  const html = invoice.render(order);

  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">₹163.00</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">₹1062.00</td>'));
  assert.match(html, /Accountant Reconciliation Notice/);
});
