const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');
const ledger = require('../lib/ledger');

test('invoice figures match pricing for HSN tax and capped coupon discount', () => {
  const order = {
    items: [
      { id: 'A', sku: 'A', name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
      { id: 'B', sku: 'B', name: 'Tea', hsn: '0902', price: 1000, qty: 1 }
    ],
    coupon: 'SAVE10'
  };

  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 212.75);
  assert.equal(figures.total, 2062.75);
  assert.deepEqual(figures.rows.map((row) => row.gstPercent), [5, 18]);
});

test('orders are sorted and date-filtered chronologically', () => {
  const db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1008, date: '15/03/2022' },
      { id: 1004, date: '30/01/2022' }
    ]
  };

  assert.deepEqual(orders.list(db).map((order) => order.id), [1008, 1004, 1001]);
  assert.deepEqual(
    orders.list(db, { from: '2022-01-01', to: '2022-02-01' }).map((order) => order.id),
    [1004]
  );
});

test('settlement amount strings update numeric Khata balances', () => {
  const db = {
    nextSettlementId: 501,
    customers: [{ id: 1, name: 'Meera', totalBilled: 1232.01, totalSettled: 1200, openingBalance: 0 }],
    settlements: []
  };

  const result = ledger.recordSettlement(db, 1, '500', 'cash', 'Test');

  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalSettled, 1700);
  assert.equal(db.customers[0].balance, -467.99);
  assert.equal(db.settlements[0].amount, 500);
});
