const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function calculate(order) {
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const { rows, ...figures } = invoice.computeInvoiceFigures({
    ...order,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  });

  return {
    checkout,
    figures,
    invoiceGst: rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax])
  };
}

test('#1001 invoices each line at its checkout GST slab', () => {
  const { checkout, figures, invoiceGst } = calculate({
    id: 1001,
    coupon: '',
    items: [
      { name: 'Rice', price: 250, qty: 2, hsn: '1006' },
      { name: 'Ghee', price: 500, qty: 1, hsn: '0405' }
    ]
  });

  assert.deepEqual(checkout.lines.map(line => line.gstPercent), [5, 12]);
  assert.equal(checkout.tax, 85);
  assert.equal(checkout.total, 1085);
  assert.deepEqual(invoiceGst, [[5, 25], [12, 60]]);
  assert.deepEqual(figures, {
    subtotal: 1000, discount: 0, tax: 85, cgst: 42.5, sgst: 42.5, total: 1085
  });
});

test('#1002 invoices SAVE10 before applying GST', () => {
  const { checkout, figures, invoiceGst } = calculate({
    id: 1002,
    coupon: 'SAVE10',
    items: [{ name: 'Tea', price: 500, qty: 2, hsn: '0902' }]
  });

  assert.equal(checkout.discount, 100);
  assert.equal(checkout.tax, 162);
  assert.equal(checkout.total, 1062);
  assert.deepEqual(invoiceGst, [[18, 162]]);
  assert.deepEqual(figures, {
    subtotal: 1000, discount: 100, tax: 162, cgst: 81, sgst: 81, total: 1062
  });
});

test('#1004 caps the invoice SAVE10 discount at 150 rupees', () => {
  const { checkout, figures, invoiceGst } = calculate({
    id: 1004,
    coupon: 'SAVE10',
    items: [{ name: 'Rice', price: 560, qty: 4, hsn: '1006' }]
  });

  assert.equal(checkout.subtotal, 2240);
  assert.equal(checkout.discount, 150);
  assert.equal(checkout.tax, 104.5);
  assert.equal(checkout.total, 2194.5);
  assert.deepEqual(invoiceGst, [[5, 104.5]]);
  assert.deepEqual(figures, {
    subtotal: 2240, discount: 150, tax: 104.5,
    cgst: 52.25, sgst: 52.25, total: 2194.5
  });
});

test('CURRENT BEHAVIOUR: #1008 matches checkout for all-18% items without a coupon', () => {
  const { checkout, figures, invoiceGst } = calculate({
    id: 1008,
    coupon: '',
    items: [
      { name: 'Tea', price: 250, qty: 2, hsn: '0902' },
      { name: 'Coffee', price: 200, qty: 1, hsn: '0901', gstRate: 18 }
    ]
  });

  assert.deepEqual(invoiceGst, [[18, 90], [18, 36]]);
  assert.deepEqual(figures, {
    subtotal: 700, discount: 0, tax: 126, cgst: 63, sgst: 63, total: 826
  });
  const { lines, taxable, ...checkoutFigures } = checkout;
  assert.deepEqual(figures, checkoutFigures);
});

test('invoice matches checkout for mixed GST slabs with a capped SAVE10 coupon', () => {
  const order = {
    coupon: 'SAVE10',
    items: [
      { name: 'Rice', price: 500, qty: 2, hsn: '1006' },
      { name: 'Ghee', price: 620, qty: 2, hsn: '0405' }
    ]
  };
  const { checkout, figures, invoiceGst } = calculate(order);

  assert.equal(checkout.discount, 150);
  const { lines, taxable, ...checkoutFigures } = checkout;
  assert.deepEqual(figures, checkoutFigures);
  assert.deepEqual(invoiceGst, [[5, 46.65], [12, 138.84]]);

  const historicalOrder = {
    ...order, subtotal: 2240, discount: 100, tax: 200, total: 2340
  };
  const { rows, ...historicalFigures } = invoice.computeInvoiceFigures(historicalOrder);
  assert.deepEqual(historicalFigures, {
    subtotal: 2240, discount: 100, tax: 200, cgst: 100, sgst: 100, total: 2340
  });
  assert.match(invoice.render(historicalOrder), /Reconstructed line GST .* differs from the billed GST/);
});
