var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function addBilledOrder(db, orderData) {
  var totals = pricing.computeTotals(orderData.items, orderData.coupon);

  return orders.add(db, {
    date: orderData.date,
    customer: orderData.customer,
    customerId: orderData.customerId,
    paymentMode: orderData.paymentMode,
    status: orderData.status,
    items: orderData.items,
    coupon: orderData.coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

function reportedOrderData() {
  return [
    {
      date: '28/12/2021', customer: 'Meera Joshi', customerId: 1, paymentMode: 'khata', status: 'completed', coupon: '',
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
        { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
      ]
    },
    {
      date: '05/01/2022', customer: 'Anil Kulkarni', customerId: 2, paymentMode: 'upi', status: 'completed', coupon: 'SAVE10',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ]
    },
    {
      date: '14/01/2022', customer: 'Walk-in', customerId: null, paymentMode: 'cash', status: 'completed', coupon: 'FLAT50',
      items: [
        { id: 7, sku: 'DRY-002', name: 'Pasteurized Table Butter 500g', hsn: '0405', price: 260, qty: 1 },
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 }
      ]
    },
    {
      date: '30/01/2022', customer: 'Kalyani Foods (Wholesale)', customerId: 5, paymentMode: 'khata', status: 'completed', coupon: 'SAVE10',
      items: [
        { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
      ]
    },
    {
      date: '02/02/2022', customer: 'Priya Nair', customerId: 3, paymentMode: 'upi', status: 'completed', coupon: 'FLAT50',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
      ]
    },
    {
      date: '18/02/2022', customer: 'Meera Joshi', customerId: 1, paymentMode: 'khata', status: 'completed', coupon: 'WELCOME',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 9, sku: 'BEV-002', name: 'Filter Coffee Decoction Blend 500g', hsn: '0901', price: 310, qty: 1 }
      ]
    },
    {
      date: '04/03/2022', customer: 'Suresh Deshmukh', customerId: 4, paymentMode: 'khata', status: 'pending', coupon: '',
      items: [
        { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ]
    },
    {
      date: '15/03/2022', customer: 'Walk-in', customerId: null, paymentMode: 'cash', status: 'completed', coupon: '',
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
        { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
      ]
    }
  ];
}

function reportedOrdersInMemory() {
  var db = { nextOrderId: 1001, orders: [], customers: [] };
  reportedOrderData().forEach(function (orderData) {
    addBilledOrder(db, orderData);
  });
  return db;
}

test('invoice uses the HSN GST slabs and capped coupon discount billed at checkout for order #1002', function () {
  var order = reportedOrdersInMemory().orders[1];
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    ledgerTotal: order.total,
    ledgerTax: order.tax,
    invoiceTotal: figures.total,
    invoiceTax: figures.tax,
    invoiceDiscount: figures.discount,
    invoiceGstPercents: figures.rows.map(function (row) { return row.gstPercent; })
  }, {
    ledgerTotal: 963.9,
    ledgerTax: 45.9,
    invoiceTotal: 963.9,
    invoiceTax: 45.9,
    invoiceDiscount: 102,
    invoiceGstPercents: [5, 5]
  });
});

test('invoice applies the SAVE10 cap and HSN 5% slab for order #1004', function () {
  var order = reportedOrdersInMemory().orders[3];
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    ledgerDiscount: order.discount,
    ledgerTax: order.tax,
    ledgerTotal: order.total,
    invoiceDiscount: figures.discount,
    invoiceTax: figures.tax,
    invoiceTotal: figures.total,
    invoiceGstPercent: figures.rows[0].gstPercent
  }, {
    ledgerDiscount: 150,
    ledgerTax: 104.5,
    ledgerTotal: 2194.5,
    invoiceDiscount: 150,
    invoiceTax: 104.5,
    invoiceTotal: 2194.5,
    invoiceGstPercent: 5
  });
});

test('invoice matches no-coupon HSN orders and all-18% orders', function () {
  var db = reportedOrdersInMemory();
  var figures1001 = invoice.computeInvoiceFigures(db.orders[0]);
  var figures1007 = invoice.computeInvoiceFigures(db.orders[6]);
  var figures1008 = invoice.computeInvoiceFigures(db.orders[7]);

  assert.deepEqual({
    order1001: { ledgerTax: db.orders[0].tax, invoiceTax: figures1001.tax, ledgerTotal: db.orders[0].total, invoiceTotal: figures1001.total },
    order1007: { ledgerTax: db.orders[6].tax, invoiceTax: figures1007.tax, ledgerTotal: db.orders[6].total, invoiceTotal: figures1007.total },
    order1008: { ledgerTax: db.orders[7].tax, invoiceTax: figures1008.tax, ledgerTotal: db.orders[7].total, invoiceTotal: figures1008.total }
  }, {
    order1001: { ledgerTax: 66.9, invoiceTax: 66.9, ledgerTotal: 676.9, invoiceTotal: 676.9 },
    order1007: { ledgerTax: 127, invoiceTax: 127, ledgerTotal: 1407, invoiceTotal: 1407 },
    order1008: { ledgerTax: 90, invoiceTax: 90, ledgerTotal: 590, invoiceTotal: 590 }
  });
});

test('GST reconciliation matches all eight in-memory reported orders', function () {
  var reconciliation = reports.getGstReconciliation(reportedOrdersInMemory());

  assert.equal(reconciliation.totalChecked, 8);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows.map(function (row) {
    return { orderId: row.orderId, matched: row.matched };
  }), [
    { orderId: 1001, matched: true },
    { orderId: 1002, matched: true },
    { orderId: 1003, matched: true },
    { orderId: 1004, matched: true },
    { orderId: 1005, matched: true },
    { orderId: 1006, matched: true },
    { orderId: 1007, matched: true },
    { orderId: 1008, matched: true }
  ]);
});

test('invoice preserves checkout per-line GST rounding', function () {
  var db = { nextOrderId: 1, orders: [] };
  var order = addBilledOrder(db, {
    items: [
      { id: 1, name: 'A', sku: 'A', price: 0.03, qty: 1 },
      { id: 2, name: 'B', sku: 'B', price: 0.03, qty: 1 },
      { id: 3, name: 'C', sku: 'C', price: 0.03, qty: 1 }
    ],
    coupon: ''
  });
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    billedTax: order.tax,
    billedTotal: order.total,
    invoiceTax: figures.tax,
    invoiceTotal: figures.total,
    invoiceCgst: figures.cgst,
    invoiceSgst: figures.sgst,
    displayedLineTaxes: figures.rows.map(function (row) { return row.lineTax; })
  }, {
    billedTax: 0.03,
    billedTotal: 0.12,
    invoiceTax: 0.03,
    invoiceTotal: 0.12,
    invoiceCgst: 0.02,
    invoiceSgst: 0.01,
    displayedLineTaxes: [0.01, 0.01, 0.01]
  });
});
