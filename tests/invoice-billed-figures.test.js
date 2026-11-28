const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice totals and GST lines match the amount billed for a capped coupon and mixed HSN slabs', () => {
  const items = [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'SAVE10');
  items[0].gstRate = 0.05;
  items[0].lineTax = billed.lines[0].tax;
  items[1].gstRate = 0.12;
  items[1].lineTax = billed.lines[1].tax;
  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2000, discount: 150, tax: 157.25, total: 2007.25 }
  );

  const order = {
    id: 42,
    date: '01/01/2022',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };

  const figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
      cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25 }
  );
  assert.deepEqual(
    figures.rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax })),
    [
      { hsn: '1006', gstPercent: 5, lineTax: 46.25 },
      { hsn: '0405', gstPercent: 12, lineTax: 111 }
    ]
  );

  const html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹157.25'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2007.25'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));

  const reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
