const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('the mixed-rate SAVE10 invoice matches the recorded bill', () => {
  const order = {
    id: 1,
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 100,
    tax: 70.2,
    total: 970.2,
    items: [
      { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 300, qty: 2 },
      { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 400, qty: 1 }
    ]
  };

  const { subtotal, discount, tax, total, cgst, sgst, rows } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ subtotal, discount, tax, total }, {
    subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total
  });
  assert.deepEqual({ cgst, sgst }, { cgst: 35.1, sgst: 35.1 });
  assert.deepEqual(rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })), [
    { hsn: '1006', gstPercent: 5, lineTax: 27 },
    { hsn: '0405', gstPercent: 12, lineTax: 43.2 }
  ]);

  const html = invoice.render(order);
  assert.match(html, />5%<\/td><td class="r">₹27\.00/);
  assert.match(html, />12%<\/td><td class="r">₹43\.20/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹70\.20/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹970\.20/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('invoice keeps the recorded discount for an order with an expired coupon', () => {
  const order = {
    coupon: 'DIWALI20',
    discount: 200,
    tax: 40,
    total: 840,
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }]
  };

  const { discount, tax, total, rows } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ discount, tax, total, lineTax: rows[0].lineTax }, {
    discount: 200, tax: 40, total: 840, lineTax: 40
  });
});
