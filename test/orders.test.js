var test = require('node:test');
var assert = require('node:assert/strict');

var dates = require('../lib/dates');
var orders = require('../lib/orders');

function order(id, date) {
  return {
    id: id,
    date: date,
    customer: 'Test Customer',
    status: 'completed'
  };
}

test('order history sorts DD/MM/YYYY values newest first', function () {
  var db = {
    orders: [
      order(1004, '30/01/2022'),
      order(1001, '28/12/2021'),
      order(1008, '15/03/2022')
    ]
  };

  var result = orders.list(db, {});

  assert.deepEqual(result.map(function (item) {
    return item.id;
  }), [1008, 1004, 1001]);
});

test('date filter includes only orders inside the selected calendar range', function () {
  var db = {
    orders: [
      order(1003, '14/01/2022'),
      order(1005, '02/02/2022'),
      order(1007, '04/03/2022')
    ]
  };

  var result = orders.list(db, {
    from: '2022-02-01',
    to: '2022-02-28'
  });

  assert.deepEqual(result.map(function (item) {
    return item.id;
  }), [1005]);
});

test('fiscal year calculation still accepts stored DD/MM/YYYY dates', function () {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
});
