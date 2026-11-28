var test = require('node:test');
var assert = require('node:assert/strict');
var dates = require('../lib/dates');
var orders = require('../lib/orders');

test('Dates & Orders Module - Ticket 3 (#3) Chronology & Filtering Suite', function (t) {
  t.test('Date normalization: converts DD/MM/YYYY and YYYY-MM-DD to YYYY-MM-DD', function () {
    assert.equal(dates.normalizeDateKey('30/01/2022'), '2022-01-30');
    assert.equal(dates.normalizeDateKey('15/03/2022'), '2022-03-15');
    assert.equal(dates.normalizeDateKey('04/03/2022'), '2022-03-04');
    assert.equal(dates.normalizeDateKey('28/12/2021'), '2021-12-28');
    assert.equal(dates.normalizeDateKey('2022-01-30'), '2022-01-30');
    assert.equal(dates.normalizeDateKey('2022-03-15'), '2022-03-15');
    assert.equal(dates.normalizeDateKey('1/2/2022'), '2022-02-01');
    assert.equal(dates.normalizeDateKey(''), '');
  });

  t.test('Fiscal year resolution continues to work accurately with normalized dates', function () {
    assert.equal(dates.getFiscalYear('30/01/2022'), 'FY21-22');
    assert.equal(dates.getFiscalYear('15/07/2021'), 'FY21-22');
    assert.equal(dates.getFiscalYear('15/04/2022'), 'FY22-23');
    assert.equal(dates.getFiscalYear('2022-01-15'), 'FY21-22');
  });

  function createOrdersDb() {
    return {
      orders: [
        { id: 1001, date: '28/12/2021', customer: 'Meera Joshi', total: 600, status: 'completed' },
        { id: 1004, date: '30/01/2022', customer: 'Kalyani Foods (Wholesale)', total: 4945.5, status: 'completed' },
        { id: 1007, date: '04/03/2022', customer: 'Suresh Deshmukh', total: 1407, status: 'completed' },
        { id: 1008, date: '15/03/2022', customer: 'Walk-in', total: 590, status: 'completed' }
      ]
    };
  }

  t.test('Order chronology: newest orders appear first by calendar date (Issue #3)', function () {
    var db = createOrdersDb();
    var list = orders.list(db);

    assert.equal(list.length, 4);
    assert.equal(list[0].id, 1008, '15/03/2022 must be 1st');
    assert.equal(list[1].id, 1007, '04/03/2022 must be 2nd');
    assert.equal(list[2].id, 1004, '30/01/2022 must be 3rd');
    assert.equal(list[3].id, 1001, '28/12/2021 must be 4th');
  });

  t.test('Date range filtering: From 2022-01-01 To 2022-01-31 returns only January 2022 orders (Issue #3)', function () {
    var db = createOrdersDb();
    var filtered = orders.list(db, {
      from: '2022-01-01',
      to: '2022-01-31'
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 1004);
    assert.equal(filtered[0].date, '30/01/2022');
  });

  t.test('Date range filtering: accepts DD/MM/YYYY inputs in filters', function () {
    var db = createOrdersDb();
    var filtered = orders.list(db, {
      from: '01/03/2022',
      to: '31/03/2022'
    });

    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, 1008);
    assert.equal(filtered[1].id, 1007);
  });

  t.test('Combined status and date filtering works accurately', function () {
    var db = createOrdersDb();
    db.orders[3].status = 'pending';
    var filtered = orders.list(db, {
      status: 'pending',
      from: '2022-03-01'
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 1008);
  });
});
