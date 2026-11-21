const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice GST breakdown and total match the checkout ledger for an HSN-rated item', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const order = {
    id: 1,
    date: '2026-11-21',
    items,
    subtotal: ledger.subtotal,
    discount: ledger.discount,
    tax: ledger.tax,
    total: ledger.total
  };

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { subtotal: ledger.subtotal, tax: ledger.tax, total: ledger.total },
    { subtotal: 100, tax: 5, total: 105 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: 100, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.equal(invoice.render(order).includes('Accountant Reconciliation Notice'), false);
});

test('invoice respects decimal order-item GST rates just like checkout', () => {
  const items = [{ name: 'Tiny taxable item', price: 1, qty: 1, gstRate: 0.05 }];
  const ledger = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items });

  assert.equal(ledger.tax, 0.05);
  assert.equal(printed.tax, ledger.tax);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice coupon discount, GST and total match checkout', () => {
  const items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({ items, coupon: 'WELCOME' });

  assert.deepEqual(
    { discount: ledger.discount, tax: ledger.tax, total: ledger.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 5, tax: 17.1, total: 112.1 }
  );
});

test('GST split assigns an odd cent to CGST', () => {
  const printed = invoice.computeInvoiceFigures({
    items: [{ name: 'Item', price: 1, qty: 1, gstRate: 5 }]
  });

  assert.deepEqual({ tax: printed.tax, cgst: printed.cgst, sgst: printed.sgst }, {
    tax: 0.05,
    cgst: 0.03,
    sgst: 0.02
  });
});

test('GST reconciliation reports a match when invoice figures follow the checkout ledger', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const ledger = pricing.computeTotals(items, '');
  const db = {
    orders: [{ id: 7, date: '2026-11-21', customer: 'A Customer', items, ...ledger }],
    customers: [],
    products: []
  };

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.deepEqual(
    { ledgerTax: reconciliation.rows[0].ledgerTax, invoiceTax: reconciliation.rows[0].invoiceTax,
      ledgerTotal: reconciliation.rows[0].ledgerTotal, invoiceTotal: reconciliation.rows[0].invoiceTotal,
      delta: reconciliation.rows[0].delta, matched: reconciliation.rows[0].matched },
    { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true }
  );
});
