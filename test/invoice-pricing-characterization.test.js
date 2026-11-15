const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const tax = require('../lib/tax');

test('invoice uses the resolved decimal GST rate for gstRate values', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const priced = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items });

  assert.equal(priced.tax, 5);
  assert.equal(priced.total, 105);
  assert.equal(invoiced.tax, 5);
  assert.equal(invoiced.total, 105);
  assert.equal(invoiced.rows[0].gstPercent, 5);
});

test('invoice and pricing agree when gstRate is expressed as a decimal', () => {
  const items = [{ name: 'Tea', hsn: '0902', gstRate: 0.05, price: 100, qty: 1 }];
  const priced = pricing.computeTotals(items, '');
  const invoiced = invoice.computeInvoiceFigures({ items });

  assert.equal(tax.getRateForItem(items[0]), 0.05);
  assert.equal(priced.tax, 5);
  assert.equal(invoiced.tax, 5);
  assert.equal(invoiced.rows[0].gstPercent, 5);
});

test('invoice and pricing apply coupons using the same capped discount', () => {
  const items = [{ name: 'Groceries', price: 1000, qty: 1 }];
  const priced = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(priced.discount, 100);
  assert.equal(priced.total, 1062);
  assert.equal(invoiced.discount, 100);
  assert.equal(invoiced.total, 1062);
});

test('invoice applies line GST after allocating coupon discount', () => {
  const items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const priced = pricing.computeTotals(items, 'WELCOME');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'WELCOME' });

  assert.deepEqual({ tax: priced.tax, discount: priced.discount, total: priced.total },
    { tax: 4.75, discount: 5, total: 99.75 });
  assert.deepEqual({ tax: invoiced.tax, discount: invoiced.discount, total: invoiced.total },
    { tax: 4.75, discount: 5, total: 99.75 });
  assert.equal(invoiced.rows[0].lineTax, 4.75);
});

test('invoice reports the same GST split as pricing', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', gstRate: 5, price: 0.1, qty: 1 }]
  });

  assert.deepEqual({ tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst },
    { tax: 0.01, cgst: 0.01, sgst: 0 });
});

test('invoice figures match the recorded bill for the mixed HSN order', () => {
  const order = {
    subtotal: 610,
    discount: 0,
    tax: 66.9,
    total: 676.9,
    coupon: '',
    items: [
      { name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
      { name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
    ]
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
    cgst: figures.cgst, sgst: figures.sgst, total: figures.total }, {
    subtotal: order.subtotal, discount: order.discount, tax: order.tax,
    cgst: 33.45, sgst: 33.45, total: order.total
  });
});
