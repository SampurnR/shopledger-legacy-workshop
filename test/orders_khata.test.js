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
// Characterization Tests: lib/dates.js & lib/orders.js (Bug 1)
// ---------------------------------------------------------------------------

test('CURRENT BEHAVIOUR: normalizeDateKey converts YYYY-MM-DD to DD/MM/YYYY causing lexical day comparison', function () {
  var keyIso = dates.normalizeDateKey('2022-01-30');
  var keyDmy = dates.normalizeDateKey('15/03/2022');
  // Currently, HTML5 date 2022-01-30 is converted to '30/01/2022'
  assert.equal(keyIso, '30/01/2022');
  assert.equal(keyDmy, '15/03/2022');
  // Flawed lexical comparison compares the day digits first ('30' > '15')
  assert.ok(keyIso > keyDmy);
});

test('CURRENT BEHAVIOUR: Order History sorts by DD/MM/YYYY string putting #1004 and #1001 above #1008', function () {
  var db = getMockDb();
  var result = orders.list(db);
  var ids = result.map(function (o) { return o.id; });

  // Unfixed sorting: '30/01/2022' (#1004) > '28/12/2021' (#1001) > '15/03/2022' (#1008)
  assert.equal(ids[0], 1004); // 30/01/2022 appears first
  assert.equal(ids[1], 1001); // 28/12/2021 appears above March 2022!
  assert.equal(ids[2], 1008); // 15/03/2022 pushed down
  assert.deepEqual(ids, [1004, 1001, 1008, 1002, 1007]);
});

test('CURRENT BEHAVIOUR: filtering by date range returns wrong results due to DD/MM/YYYY string comparisons', function () {
  var db = getMockDb();
  // Filter for January 2022: from 2022-01-01 to 2022-01-31
  var result = orders.list(db, { from: '2022-01-01', to: '2022-01-31' });
  var ids = result.map(function (o) { return o.id; });

  // In unfixed code: '01/01/2022' <= o.date <= '31/01/2022'
  // '28/12/2021' (day 28) and '15/03/2022' (day 15) and '04/03/2022' (day 04) all match!
  // All 5 orders are returned instead of only January orders (#1002 and #1004)
  assert.equal(result.length, 5);
  assert.ok(ids.includes(1001)); // Dec 2021 wrongly included
  assert.ok(ids.includes(1008)); // Mar 2022 wrongly included
  assert.ok(ids.includes(1007)); // Mar 2022 wrongly included
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
// Characterization Tests: lib/ledger.js (Bug 2)
// ---------------------------------------------------------------------------

test('CURRENT BEHAVIOUR: recording settlement with string amount corrupts totalSettled and balance', function () {
  var db = getMockDb();
  // Meera Joshi: openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01
  // Request payload from frontend passes amount as string "500"
  var res = ledger.recordSettlement(db, 1, '500', 'cash', 'Khata settlement');

  assert.equal(res.ok, true);
  // c.totalSettled = c.totalSettled + amount -> 1200 + '500' = '1200500'
  assert.equal(res.customer.totalSettled, '1200500');
  // c.balance = round2((450) + (1982.01) - '1200500') = -1198067.99
  assert.equal(res.customer.balance, -1198067.99);
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
});

test('ledger.recordSettlement returns error if customer not found', function () {
  var db = getMockDb();
  var res = ledger.recordSettlement(db, 999, 100, 'cash', 'test');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'Customer not found');
});
