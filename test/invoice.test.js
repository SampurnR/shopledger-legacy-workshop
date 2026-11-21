var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Use the same line fields and saved totals as checkout, entirely in memory.
function sale(items, coupon = '') {
  var bill = pricing.computeTotals(items, coupon);
  var order = {
    id: 1, items: items, coupon: coupon,
    subtotal: bill.subtotal, discount: bill.discount, tax: bill.tax, total: bill.total
  };
  return { bill: bill, order: order, printed: invoice.computeInvoiceFigures(order) };
}

function amounts(figures) {
  var { discount, tax, cgst, sgst, total } = figures;
  return { discount, tax, cgst, sgst, total };
}

test('checkout and invoice agree on undiscounted tea at 18% GST', function () {
  var tea = { name: 'Tea', hsn: '0902', price: 100, qty: 2 };
  var { bill, printed, order } = sale([tea]);
  var expected = { discount: 0, tax: 36, cgst: 18, sgst: 18, total: 236 };
  assert.deepEqual(amounts(bill), expected);
  assert.deepEqual(amounts(printed), expected);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('invoice uses each HSN slab after allocating the flat discount', function () {
  var rice = { name: 'Rice', hsn: '1006', price: 100, qty: 2 };
  var ghee = { name: 'Ghee', hsn: '0405', price: 300, qty: 1 };
  var { bill, printed, order } = sale([rice, ghee], 'FLAT50');

  // Checkout allocates the ₹50 discount as ₹20 on rice and ₹30 on ghee.
  assert.deepEqual(bill.lines.map(line => [line.gstPercent, line.discount, line.tax]),
    [[5, 20, 9], [12, 30, 32.4]]);
  assert.deepEqual(amounts(bill), { discount: 50, tax: 41.4, cgst: 20.7, sgst: 20.7, total: 491.4 });
  assert.deepEqual(printed.rows.map(row => [row.gstPercent, row.lineTax]), [[5, 9], [12, 32.4]]);
  assert.deepEqual(amounts(printed), amounts(bill));

  var text = invoice.render(order).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text, /CGST \+ SGST \(Total GST\) ₹41\.40/);
  assert.match(text, /Invoice Total ₹491\.40/);
  assert.doesNotMatch(text, /Accountant Reconciliation Notice/);
});

test('invoice applies the ₹150 SAVE10 cap before GST', function () {
  var tea = { name: 'Tea', hsn: '0902', price: 100, qty: 20 };
  var { bill, printed } = sale([tea], 'SAVE10');
  assert.deepEqual(amounts(bill), { discount: 150, tax: 333, cgst: 166.5, sgst: 166.5, total: 2183 });
  assert.deepEqual(amounts(printed), amounts(bill));
});

test('invoice reconciles both the GST and the grand total on a percentage discount', function () {
  var tea = { name: 'Tea', hsn: '0902', price: 100, qty: 5 };
  var { bill, printed, order } = sale([tea], 'SAVE10');
  assert.deepEqual(amounts(bill), { discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531 });
  assert.deepEqual(amounts(printed), amounts(bill));
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);

  var report = reports.getGstReconciliation({ orders: [order] });
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.rows[0].delta, 0);
});

test('invoice sums GST rounded to the paisa on each line', function () {
  var items = [
    { name: 'Tea', hsn: '0902', price: 0.03, qty: 1 },
    { name: 'Coffee', hsn: '0901', price: 0.03, qty: 1 }
  ];
  var { bill, printed } = sale(items);
  assert.deepEqual(printed.rows.map(row => row.lineTax), [0.01, 0.01]);
  assert.deepEqual(amounts(bill), { discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08 });
  assert.deepEqual(amounts(printed), amounts(bill));
});

test('a ₹640 rice sale with SAVE10 prints the billed total and GST', function () {
  var rice = { name: 'Rice', hsn: '1006', price: 640, qty: 1 };
  var { printed } = sale([rice], 'SAVE10');
  assert.deepEqual(amounts(printed), { discount: 64, tax: 28.8, cgst: 14.4, sgst: 14.4, total: 604.8 });
});

test('reprinting a sale keeps its recorded discount after the coupon expires', function () {
  var order = {
    items: [{ name: 'Rice', hsn: '1006', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 40, total: 840
  };
  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(amounts(printed), { discount: 200, tax: 40, cgst: 20, sgst: 20, total: 840 });
  assert.equal(printed.rows[0].lineTax, 40);
});
