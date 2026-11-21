var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeOrder(id, customer, items, coupon, checkout) {
  return {
    id: id,
    date: '01/02/2022',
    customer: customer,
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  };
}

function order1002() {
  return makeOrder(1002, 'Anil Kulkarni', [
    { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
    { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ], 'SAVE10', { subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 });
}

function order1004() {
  return makeOrder(1004, 'Kalyani Foods (Wholesale)', [
    { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
  ], 'SAVE10', { subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 });
}

function order1001() {
  return makeOrder(1001, 'Meera Joshi', [
    { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
    { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
  ], '', { subtotal: 610, discount: 0, tax: 66.9, total: 676.9 });
}

function order1007() {
  return makeOrder(1007, 'Suresh Deshmukh', [
    { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
    { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ], '', { subtotal: 1280, discount: 0, tax: 127, total: 1407 });
}

test('Ticket 1 order 1002: invoice matches checkout HSN GST, SAVE10 discount, and total', function () {
  var order = order1002();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: order.subtotal,
    discount: figures.discount,
    gstPercentByLine: figures.rows.map(function (row) { return row.gstPercent; }),
    gstByLine: figures.rows.map(function (row) { return row.lineTax; }),
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: 1020,
    discount: 102,
    gstPercentByLine: [5, 5],
    gstByLine: [28.8, 17.1],
    tax: 45.9,
    cgst: 22.95,
    sgst: 22.95,
    total: 963.9
  });
});

test('Ticket 1 order 1004: invoice applies the SAVE10 maximum discount cap', function () {
  var order = order1004();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    subtotal: order.subtotal,
    discount: figures.discount,
    gstPercentByLine: figures.rows.map(function (row) { return row.gstPercent; }),
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    subtotal: 2240,
    discount: 150,
    gstPercentByLine: [5],
    tax: 104.5,
    cgst: 52.25,
    sgst: 52.25,
    total: 2194.5
  });
});

test('Ticket 1 order 1001: invoice applies the configured 18% and 5% HSN slabs', function () {
  var order = order1001();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    gstPercentByLine: figures.rows.map(function (row) { return row.gstPercent; }),
    gstByLine: figures.rows.map(function (row) { return row.lineTax; }),
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    gstPercentByLine: [18, 5],
    gstByLine: [50.4, 16.5],
    tax: 66.9,
    cgst: 33.45,
    sgst: 33.45,
    total: 676.9
  });
});

test('Ticket 1 order 1007: invoice applies the configured 12% and 5% HSN slabs', function () {
  var order = order1007();
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    gstPercentByLine: figures.rows.map(function (row) { return row.gstPercent; }),
    gstByLine: figures.rows.map(function (row) { return row.lineTax; }),
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  }, {
    gstPercentByLine: [12, 5],
    gstByLine: [108, 19],
    tax: 127,
    cgst: 63.5,
    sgst: 63.5,
    total: 1407
  });
});

test('Ticket 1 reconciliation: correct invoices match all four billed ledger totals and GST', function () {
  var orders = [order1001(), order1002(), order1004(), order1007()];
  var result = reports.getGstReconciliation({ orders: orders });

  assert.deepEqual({
    totalChecked: result.totalChecked,
    mismatchCount: result.mismatchCount,
    totalDelta: result.totalDelta,
    rows: result.rows.map(function (row) {
      return [row.orderId, row.invoiceTax, row.invoiceTotal, row.delta, row.matched];
    })
  }, {
    totalChecked: 4,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [
      [1001, 66.9, 676.9, 0, true],
      [1002, 45.9, 963.9, 0, true],
      [1004, 104.5, 2194.5, 0, true],
      [1007, 127, 1407, 0, true]
    ]
  });
});
