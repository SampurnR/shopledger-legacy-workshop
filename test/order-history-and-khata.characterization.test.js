var test = require('node:test');
var assert = require('node:assert/strict');

var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function order(id, date) {
  return {
    id: id,
    date: date,
    customer: 'Walk-in',
    status: 'completed'
  };
}

test('Order History sorts DD/MM/YYYY dates newest first', function () {
  var db = {
    orders: [
      order(1001, '28/12/2021'),
      order(1004, '30/01/2022'),
      order(1008, '15/03/2022')
    ]
  };

  assert.deepEqual(
    orders.list(db, { status: 'all' }).map(function (item) { return item.id; }),
    [1008, 1004, 1001]
  );
});

test('Order History returns only orders within an inclusive February date range', function () {
  var db = {
    orders: [
      order(1001, '28/12/2021'),
      order(1004, '30/01/2022'),
      order(1006, '18/02/2022'),
      order(1008, '15/03/2022')
    ]
  };

  assert.deepEqual(
    orders.list(db, {
      status: 'all',
      from: '2022-02-01',
      to: '2022-02-28'
    }).map(function (item) { return item.id; }),
    [1006]
  );
});

test('Khata settlement converts a submitted string amount before updating the customer balance', function () {
  var db = {
    nextSettlementId: 505,
    customers: [{
      id: 1,
      name: 'Meera Joshi',
      phone: '98230 11420',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01
    }],
    settlements: []
  };

  var result = ledger.recordSettlement(db, 1, '500', 'upi', 'Characterization only');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.deepEqual(result.settlement, {
    id: 505,
    customerId: 1,
    customerName: 'Meera Joshi',
    date: result.settlement.date,
    amount: 500,
    mode: 'upi',
    note: 'Characterization only'
  });
});
