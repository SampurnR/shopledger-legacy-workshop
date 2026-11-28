const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// Order-shaped objects stay in memory. These tests never load the JSON store.
function billedOrder(id, items, coupon = '', status = 'completed') {
  const billed = pricing.computeTotals(items, coupon);
  return {
    id,
    date: '01/01/2022',
    customer: 'Test customer',
    status,
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
}

test('invoice uses the billed 5% HSN rate and GST split', () => {
  const items = [{ id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures(billedOrder(1001, items));

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax,
      cgst: billed.cgst, sgst: billed.sgst, total: billed.total },
    { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax,
      cgst: printed.cgst, sgst: printed.sgst, total: printed.total },
    { subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.equal(billed.lines[0].gstPercent, 5);
  assert.equal(printed.rows[0].gstPercent, 5);
});

test('invoice applies FLAT50 before the line-specific GST calculation', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 200, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 200, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'FLAT50');
  const printed = invoice.computeInvoiceFigures(billedOrder(1002, items, 'FLAT50'));

  assert.deepEqual(billed.lines.map(({ discount, taxable, tax, gstPercent }) =>
    ({ discount, taxable, tax, gstPercent })), [
    { discount: 25, taxable: 175, tax: 8.75, gstPercent: 5 },
    { discount: 25, taxable: 175, tax: 21, gstPercent: 12 }
  ]);
  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 400, discount: 50, tax: 29.75, total: 379.75 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, cgst: printed.cgst,
      sgst: printed.sgst, total: printed.total },
    { discount: 50, tax: 29.75, cgst: 14.88, sgst: 14.87, total: 379.75 }
  );
});

test('invoice respects the billed SAVE10 discount cap and post-discount GST', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const printed = invoice.computeInvoiceFigures(billedOrder(1003, items, 'SAVE10'));

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 150, tax: 92.5, total: 1942.5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 150, tax: 92.5, total: 1942.5 }
  );
});

test('reconciliation matches billed invoices and excludes cancelled orders', () => {
  const rice = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const tea = [{ id: 2, name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  const db = { orders: [
    billedOrder(1001, rice),
    billedOrder(1002, tea),
    billedOrder(1003, rice, '', 'cancelled')
  ] };

  const result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows.map(({ orderId, ledgerTax, invoiceTax,
    ledgerTotal, invoiceTotal, delta, matched }) =>
    ({ orderId, ledgerTax, invoiceTax, ledgerTotal, invoiceTotal, delta, matched })), [
    { orderId: 1001, ledgerTax: 5, invoiceTax: 5,
      ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true },
    { orderId: 1002, ledgerTax: 18, invoiceTax: 18,
      ledgerTotal: 118, invoiceTotal: 118, delta: 0, matched: true }
  ]);
});

test('printable invoice displays the billed GST and total without a mismatch notice', () => {
  const items = [{ id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const html = invoice.render(billedOrder(1001, items));

  assert.match(html, /5%<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
