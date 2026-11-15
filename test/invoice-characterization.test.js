const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice figures match the totals used to bill an HSN-rated order with a coupon', () => {
  const items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const figures = invoice.computeInvoiceFigures({ items, coupon: 'WELCOME' });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total }
  );
});

test('invoice preserves the recorded order figures when current recalculation differs', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'DIWALI20',
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    total: 99.75
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { subtotal: 100, discount: 5, tax: 4.75, cgst: 2.38, sgst: 2.37, total: 99.75 }
  );
  assert.deepEqual(
    { rowDiscount: figures.rows[0].discount, rowTaxable: figures.rows[0].taxable, rowTax: figures.rows[0].lineTax },
    { rowDiscount: 5, rowTaxable: 95, rowTax: 4.75 }
  );
  assert.match(invoice.render(order), /Gross Before Discount/);
});

test('invoice derives a missing total from the recorded amounts it displays', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 5,
    tax: 4.75
  });

  assert.equal(figures.total, 99.75);
});

test('invoice uses the billing GST split for recorded odd-cent tax', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 1, qty: 1 }],
    subtotal: 1,
    discount: 0,
    tax: 0.05,
    total: 1.05
  });

  assert.deepEqual({ cgst: figures.cgst, sgst: figures.sgst }, { cgst: 0.03, sgst: 0.02 });
});

test('invoice allocates recorded mixed-rate tax using each discounted taxable value and GST rate', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ],
    coupon: 'DIWALI20',
    subtotal: 200,
    discount: 20,
    tax: 20.7,
    total: 200.7
  });

  assert.deepEqual(figures.rows.map((row) => row.discount), [10, 10]);
  assert.deepEqual(figures.rows.map((row) => row.taxable), [90, 90]);
  assert.deepEqual(figures.rows.map((row) => row.lineTax), [4.5, 16.2]);
  assert.equal(figures.rows.reduce((sum, row) => sum + row.lineTax, 0), figures.tax);
});

test('CURRENT BEHAVIOUR: invoice uses the same HSN slab and subtotal discount as the billed order', () => {
  const items = [{
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: 100,
    qty: 2
  }];

  const billed = pricing.computeTotals(items, 'WELCOME');
  const order = {
    id: 1001,
    date: '2026-11-15',
    customer: 'Test Customer',
    paymentMode: 'cash',
    coupon: 'WELCOME',
    items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 200, discount: 10, tax: 9.5, cgst: 4.75, sgst: 4.75, total: 199.5 }
  );
  assert.deepEqual(
    { subtotal: invoiceFigures.subtotal, discount: invoiceFigures.discount, tax: invoiceFigures.tax, cgst: invoiceFigures.cgst, sgst: invoiceFigures.sgst, total: invoiceFigures.total, rowGstPercent: invoiceFigures.rows[0].gstPercent },
    { subtotal: 200, discount: 10, tax: 9.5, cgst: 4.75, sgst: 4.75, total: 199.5, rowGstPercent: 5 }
  );
  assert.deepEqual(
    { rowGross: invoiceFigures.rows[0].line, rowDiscount: invoiceFigures.rows[0].discount, rowTaxable: invoiceFigures.rows[0].taxable, rowTax: invoiceFigures.rows[0].lineTax },
    { rowGross: 200, rowDiscount: 10, rowTaxable: 190, rowTax: 9.5 }
  );

  const html = invoice.render(order);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Taxable Value/);
});

test('CURRENT BEHAVIOUR: invoice accepts a decimal gstRate consistently with pricing', () => {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 100, qty: 1, gstRate: 0.05 }]
  });

  assert.deepEqual(
    { tax: figures.tax, total: figures.total, gstPercent: figures.rows[0].gstPercent, rowTax: figures.rows[0].lineTax },
    { tax: 5, total: 105, gstPercent: 5, rowTax: 5 }
  );
});

test('CURRENT BEHAVIOUR: invoice respects coupon minimums and zero GST rates as pricing does', () => {
  const figures = invoice.computeInvoiceFigures({
    coupon: 'FLAT50',
    items: [{ name: 'Small item', price: 20, qty: 1, gstRate: 0 }]
  });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 20, discount: 0, tax: 0, total: 20 }
  );
});
