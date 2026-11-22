const test = require('node:test');
const assert = require('node:assert/strict');
const { computeInvoiceFigures, render } = require('../lib/invoice');

const order1002 = {
  id: 1002,
  coupon: 'SAVE10',
  total: 963.90,
  items: [
    { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
    { name: 'Oil', hsn: '1512', price: 190, qty: 2 }
  ]
};

test('printed invoice #1002 shows the ledger total and GST', () => {
  const html = render(order1002);
  const amount = label => html.split(label + '</td><td class="r">')[1].split('</td>')[0];
  assert.equal(amount('Invoice Total'), '₹963.90');
  assert.equal(amount('CGST + SGST (Total GST)'), '₹45.90');
});

test('order #1002 applies 5% HSN GST to each discounted line', () => {
  const figures = computeInvoiceFigures(order1002);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 5]);
  assert.deepEqual(figures.rows.map(row => row.lineTax), [28.80, 17.10]);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.tax, 45.90);
  assert.equal(figures.discount, 102);
  assert.equal(figures.total, 963.90);
});

test('SAVE10 is capped at 150 rupees before 12% GST on a 2,240 rupee subtotal', () => {
  const figures = computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ name: 'Ghee', hsn: '0405', price: 560, qty: 4 }]
  });

  assert.equal(figures.subtotal, 2240);
  assert.equal(figures.tax, 250.80);
  assert.equal(figures.discount, 150);
  assert.equal(figures.total, 2340.80);
});

test('an 18% order without a coupon splits rounded GST', () => {
  const figures = computeInvoiceFigures({
    coupon: '',
    items: [{ name: 'Tea', hsn: '0902', price: 10.05, qty: 1 }]
  });

  assert.equal(figures.discount, 0);
  assert.equal(figures.tax, 1.81);
  assert.equal(figures.cgst, 0.91);
  assert.equal(figures.sgst, 0.90);
  assert.equal(figures.total, 11.86);
});
