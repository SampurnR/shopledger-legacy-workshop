const assert = require('node:assert/strict');
const test = require('node:test');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

const items = [{
  id: 1,
  sku: 'RICE-5KG',
  name: 'Rice',
  hsn: '1006',
  price: 3000,
  qty: 1
}];
const coupon = 'WHOLESALE15';
const checkout = pricing.computeTotals(items, coupon);

test('checkout applies the HSN rate after its capped coupon discount', function () {
  assert.deepEqual({
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    taxable: checkout.taxable,
    tax: checkout.tax,
    cgst: checkout.cgst,
    sgst: checkout.sgst,
    total: checkout.total
  }, {
    subtotal: 3000,
    discount: 400,
    taxable: 2600,
    tax: 130,
    cgst: 65,
    sgst: 65,
    total: 2730
  });
});

test('invoice matches the amount billed and the checkout HSN GST breakdown', function () {
  const figures = invoice.computeInvoiceFigures({
    items: items,
    coupon: coupon,
    total: checkout.total
  });

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    lineGstPercent: figures.rows[0].gstPercent,
    lineTax: figures.rows[0].lineTax
  }, {
    subtotal: 3000,
    discount: 400,
    tax: 130,
    cgst: 65,
    sgst: 65,
    total: 2730,
    lineGstPercent: 5,
    lineTax: 130
  });

});
