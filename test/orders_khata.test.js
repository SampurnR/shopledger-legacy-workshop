var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

// In-memory test fixtures - NEVER touch data/db.json
function getMockDb() {
  return {
    nextOrderId: 1009,
    nextSettlementId: 505,
    orders: [
      {
        id: 1001,
        date: '28/12/2021',
        customer: 'Meera Joshi',
        customerId: 1,
        paymentMode: 'khata',
        status: 'completed',
        items: [
          { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
          { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
        ],
        coupon: '',
        subtotal: 610,
        discount: 0,
        tax: 66.90,
        total: 676.90
      },
      {
        id: 1002,
        date: '05/01/2022',
        customer: 'Anil Kulkarni',
        customerId: null,
        paymentMode: 'upi',
        status: 'completed',
        items: [
          { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
          { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
        ],
        coupon: 'SAVE10',
        subtotal: 1020,
        discount: 102,
        tax: 45.90,
        total: 963.90
      },
      {
        id: 1004,
        date: '30/01/2022',
        customer: 'Kalyani Foods (Wholesale)',
        customerId: 3,
        paymentMode: 'khata',
        status: 'completed',
        items: [
          { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
        ],
        coupon: 'SAVE10',
        subtotal: 2240,
        discount: 150,
        tax: 104.50,
        total: 2194.50
      },
      {
        id: 1007,
        date: '04/03/2022',
        customer: 'Suresh Deshmukh',
        customerId: 2,
        paymentMode: 'khata',
        status: 'completed',
        items: [
          { id: 7, sku: 'DRY-001', name: 'Organic A2 Gir Cow Ghee 500ml', hsn: '0405', price: 680, qty: 1 },
          { id: 10, sku: 'SPC-001', name: 'Byadgi Chilli Powder 500g', hsn: '0910', price: 210, qty: 1 }
        ],
        coupon: '',
        subtotal: 890,
        discount: 0,
        tax: 84.10,
        total: 974.10
      },
      {
        id: 1008,
        date: '15/03/2022',
        customer: 'Walk-in',
        customerId: null,
        paymentMode: 'cash',
        status: 'completed',
        items: [
          { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
          { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
        ],
        coupon: '',
        subtotal: 500,
        discount: 0,
        tax: 90,
        total: 590
      }
    ],
    customers: [
      {
        id: 1,
        name: 'Meera Joshi',
        phone: '98230 11420',
        type: 'Retail',
        gstin: '',
        creditLimit: 5000,
        openingBalance: 450,
        totalBilled: 1982.01,
        totalSettled: 1200,
        balance: 1232.01
      },
      {
        id: 2,
        name: 'Suresh Deshmukh',
        phone: '94220 88310',
        type: 'Retail',
        gstin: '',
        creditLimit: 8000,
        openingBalance: 1200,
        totalBilled: 974.10,
        totalSettled: 1000,
        balance: 1174.10
      }
    ],
    settlements: []
  };
}

// ---------------------------------------------------------------------------
// Unit & Integration Tests: lib/dates.js & lib/orders.js (Bug 1 Fixed)
// ---------------------------------------------------------------------------

test('normalizeDateKey normalizes both DD/MM/YYYY and YYYY-MM-DD to YYYY-MM-DD for chronological comparison', function () {
  var keyIso = dates.normalizeDateKey('2022-01-30');
  var keyDmy = dates.normalizeDateKey('15/03/2022');
  assert.equal(keyIso, '2022-01-30');
  assert.equal(keyDmy, '2022-03-15');
  // Chronological comparison works correctly: March 2022 > January 2022
  assert.ok(keyDmy > keyIso);

  // Additional boundary formats
  assert.equal(dates.normalizeDateKey('28/12/2021'), '2021-12-28');
  assert.equal(dates.normalizeDateKey(''), '');
});

test('dates.getFiscalYear correctly determines fiscal year with YYYY-MM-DD and DD/MM/YYYY', function () {
  assert.equal(dates.getFiscalYear('15/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-03-15'), 'FY21-22');
  assert.equal(dates.getFiscalYear('15/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('2022-04-15'), 'FY22-23');
});

test('Order History sorts chronologically newest first (#1008 appears above #1004 and #1001)', function () {
  var db = getMockDb();
  var result = orders.list(db);
  var ids = result.map(function (o) { return o.id; });

  // Correct chronological order (newest first):
  // #1008 (15/03/2022) -> #1007 (04/03/2022) -> #1004 (30/01/2022) -> #1002 (05/01/2022) -> #1001 (28/12/2021)
  assert.equal(ids[0], 1008); // 15/03/2022 newest order is first
  assert.equal(ids[1], 1007); // 04/03/2022
  assert.equal(ids[2], 1004); // 30/01/2022
  assert.equal(ids[3], 1002); // 05/01/2022
  assert.equal(ids[4], 1001); // 28/12/2021 oldest order is last
  assert.deepEqual(ids, [1008, 1007, 1004, 1002, 1001]);
});

test('orders.list date range filter accurately filters by date range', function () {
  var db = getMockDb();
  // Filter for January 2022: from 2022-01-01 to 2022-01-31
  var janOrders = orders.list(db, { from: '2022-01-01', to: '2022-01-31' });
  var janIds = janOrders.map(function (o) { return o.id; });

  assert.equal(janOrders.length, 2);
  assert.deepEqual(janIds, [1004, 1002]); // Only Jan 30 and Jan 05 orders
  assert.ok(!janIds.includes(1001)); // Dec 2021 correctly excluded
  assert.ok(!janIds.includes(1008)); // Mar 2022 correctly excluded

  // Filter for March 2022
  var marOrders = orders.list(db, { from: '2022-03-01', to: '2022-03-31' });
  var marIds = marOrders.map(function (o) { return o.id; });
  assert.equal(marOrders.length, 2);
  assert.deepEqual(marIds, [1008, 1007]);
});

test('orders.list filters by search query matching customer or id', function () {
  var db = getMockDb();
  var result = orders.list(db, { search: 'Meera' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1001);
});

test('orders.list filters by order status', function () {
  var db = getMockDb();
  db.orders[0].status = 'cancelled';
  var completed = orders.list(db, { status: 'completed' });
  assert.equal(completed.length, 4);
  var cancelled = orders.list(db, { status: 'cancelled' });
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].id, 1001);
});

// ---------------------------------------------------------------------------
// Unit & Integration Tests: lib/ledger.js (Bug 2 Fixed)
// ---------------------------------------------------------------------------

test('recording settlement with string amount converts to Number and updates balance correctly', function () {
  var db = getMockDb();
  // Meera Joshi: openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01
  // Request payload from frontend passes amount as string "500"
  var res = ledger.recordSettlement(db, 1, '500', 'cash', 'Khata settlement');

  assert.equal(res.ok, true);
  // c.totalSettled updated cleanly as numeric sum: 1200 + 500 = 1700
  assert.equal(typeof res.customer.totalSettled, 'number');
  assert.equal(res.customer.totalSettled, 1700);
  // Balance due updated accurately: 450 + 1982.01 - 1700 = 732.01
  assert.equal(res.customer.balance, 732.01);
  assert.equal(res.settlement.amount, 500);
});

test('ledger.recordSettlement with valid Number amount updates balance cleanly', function () {
  var db = getMockDb();
  var res = ledger.recordSettlement(db, 1, 500, 'cash', 'Khata settlement');
  assert.equal(res.ok, true);
  assert.equal(res.customer.totalSettled, 1700);
  assert.equal(res.customer.balance, 732.01);
});

test('ledger.recordSettlement rejects invalid settlement amounts', function () {
  var db = getMockDb();
  var resZero = ledger.recordSettlement(db, 1, 0, 'cash', 'test');
  assert.equal(resZero.ok, false);
  assert.equal(resZero.error, 'Settlement amount must be greater than zero');

  var resNeg = ledger.recordSettlement(db, 1, -100, 'cash', 'test');
  assert.equal(resNeg.ok, false);

  var resNan = ledger.recordSettlement(db, 1, 'not-a-number', 'cash', 'test');
  assert.equal(resNan.ok, false);
});

test('ledger.recordSettlement returns error if customer not found', function () {
  var db = getMockDb();
  var res = ledger.recordSettlement(db, 999, 100, 'cash', 'test');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Customer not found');
});
