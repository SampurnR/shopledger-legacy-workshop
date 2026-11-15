const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

const rice = { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 150, qty: 2 };
const ghee = { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 200, qty: 1 };
const tea = { id: 3, name: 'Tea', sku: 'TEA', hsn: '0902', price: 100, qty: 1 };

function billOrder(items, coupon = '') {
  const db = { nextOrderId: 1, orders: [], customers: [{ id: 1, name: 'Asha' }] };
  const billed = pricing.computeTotals(items, coupon);
  const charge = ledger.chargeOrderToKhata(db, 1, billed.total);
  assert.equal(charge.ok, true);
  const order = orders.add(db, {
    ...billed, items, coupon, customerId: 1, customer: 'Asha',
    paymentMode: 'khata', date: '2021-11-20'
  });
  return { db, order, billed };
}

test('invoice agrees with the billed amount for 18% GST without a coupon', () => {
  const { order } = billOrder([tea]);
  const { subtotal, discount, tax, cgst, sgst, total } = invoice.computeInvoiceFigures(order);
  assert.deepEqual({ subtotal, discount, tax, cgst, sgst, total }, {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
  assert.equal(order.total, 118);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice applies the billed HSN rate when the order line has no explicit GST rate', () => {
  const { order } = billOrder([rice]);
  const computed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(
    { gstPercent: computed.rows[0].gstPercent, gst: computed.tax, total: computed.total },
    { gstPercent: 5, gst: 15, total: 315 }
  );
});

test('mixed HSN rates and SAVE10 produce matching billed and printed figures', () => {
  const { db, order, billed } = billOrder([rice, ghee], 'SAVE10');
  assert.deepEqual(billed.lines.map(({ gstPercent, discount, taxable, tax }) =>
    ({ gstPercent, discount, taxable, tax })), [
    { gstPercent: 5, discount: 30, taxable: 270, tax: 13.5 },
    { gstPercent: 12, discount: 20, taxable: 180, tax: 21.6 }
  ]);
  assert.deepEqual(
    [order.subtotal, order.discount, order.tax, billed.cgst, billed.sgst, order.total],
    [500, 50, 35.1, 17.55, 17.55, 485.1]
  );
  assert.equal(db.customers[0].totalBilled, 485.1);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500, discount: 50, tax: 35.1, cgst: 17.55, sgst: 17.55, total: 485.1,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 150, gstPercent: 5, line: 300, lineTax: 13.5 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 200, gstPercent: 12, line: 200, lineTax: 21.6 }
    ]
  });
  const html = invoice.render(order);
  assert.ok(html.includes('<td class="r">5%</td><td class="r">₹13.50</td>'));
  assert.ok(html.includes('<td class="r">12%</td><td class="r">₹21.60</td>'));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹35.10</td>'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹485.10</td>'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const reconciliation = reports.getGstReconciliation(db);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 1, date: '2021-11-20', customer: 'Asha', coupon: 'SAVE10',
    ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 35.1, ledgerTotal: 485.1,
    invoiceDiscount: 50, invoiceTax: 35.1, invoiceTotal: 485.1, delta: 0, matched: true
  });
});

test('invoice honors the SAVE10 cap and applies GST after the discount', () => {
  const { order } = billOrder([{ ...tea, price: 2000 }], 'SAVE10');
  const computed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  assert.deepEqual([computed.discount, computed.tax, computed.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice and pricing interpret legacy whole, decimal, and zero GST rates consistently', () => {
  const items = [
    { ...tea, gstRate: 5 },
    { ...tea, gstRate: 0.05 },
    { ...tea, gstRate: 0 }
  ];
  const { order, billed } = billOrder(items);
  const computed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(billed.lines.map(line => line.tax), [5, 5, 0]);
  assert.deepEqual(computed.rows.map(row => row.lineTax), [5, 5, 0]);
  assert.deepEqual(computed.rows.map(row => row.gstPercent), [5, 5, 0]);
  assert.equal(order.total, 310);
  assert.equal(computed.total, 310);
});

test('invoice adds the same rounded line GST amounts as checkout', () => {
  const { order, billed } = billOrder([
    { ...tea, price: 0.03 },
    { ...tea, id: 4, price: 0.03 }
  ]);
  const computed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(billed.lines.map(line => line.tax), [0.01, 0.01]);
  assert.deepEqual(computed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual([order.tax, billed.cgst, billed.sgst, order.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual([computed.tax, computed.cgst, computed.sgst, computed.total], [0.02, 0.01, 0.01, 0.08]);
});

test('CURRENT BEHAVIOUR: an equal total hides a GST mismatch from the invoice notice', () => {
  const db = { orders: [{
    id: 1, items: [tea], subtotal: 100, discount: 0, tax: 17, total: 118
  }] };
  const [order] = db.orders;
  const reconciliation = reports.getGstReconciliation(db);
  assert.deepEqual([reconciliation.mismatchCount, reconciliation.totalDelta], [1, 0]);
  const [row] = reconciliation.rows;
  assert.deepEqual([row.ledgerTax, row.invoiceTax, row.matched], [17, 18, false]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice preserves the recorded flat-rate figures for a pre-HSN order', () => {
  const items = [rice, ghee];
  const order = {
    id: 1, date: '21/07/2021', items, coupon: 'SAVE10',
    subtotal: 500, discount: 50, tax: 81, total: 531
  };
  const computed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([computed.subtotal, computed.discount, computed.tax, computed.total], [500, 50, 81, 531]);
  assert.deepEqual(computed.rows.map(row => [row.gstPercent, row.lineTax]), [[18, 48.6], [18, 32.4]]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  const currentOrder = { ...order, date: '20/11/2021', status: 'completed', paymentMode: 'cash' };
  assert.equal(invoice.computeInvoiceFigures(currentOrder).total, 485.1);
  assert.match(invoice.render(currentOrder), /Accountant Reconciliation Notice/);

  assert.equal(orders.cancel({ orders: [order], products: [] }, order.id).ok, true);
  assert.deepEqual(invoice.computeInvoiceFigures(order), computed);

  const fractionalOrder = {
    items: [{ ...rice, price: 500.03, qty: 1 }], coupon: 'SAVE10',
    subtotal: 500.03, discount: 50, tax: 81, total: 531.03
  };
  const fractional = invoice.computeInvoiceFigures(fractionalOrder);
  assert.deepEqual([fractional.discount, fractional.tax, fractional.total], [50, 81, 531.03]);
});
