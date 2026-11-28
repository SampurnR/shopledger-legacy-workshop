const assert = require('node:assert/strict');
const { test } = require('node:test');
const dates = require('../lib/dates');
const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');

test('dates use day/month/year and the fiscal year changes in April', () => {
  assert.match(dates.today(), /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(dates.normalizeDateKey(' 2024-03-31 '), '31/03/2024');
  assert.equal(dates.normalizeDateKey('01/04/2024'), '01/04/2024');
  assert.equal(dates.getFiscalYear('2024-03-31'), 'FY23-24');
  assert.equal(dates.getFiscalYear('01/04/2024'), 'FY24-25');
});

test('CURRENT BEHAVIOUR: a missing date maps to the FY21-22 fallback', () => {
  assert.equal(dates.normalizeDateKey(), '');
  assert.equal(dates.getFiscalYear(), 'FY21-22');
});

test('inventory finds numeric or string IDs and subtracts wholesale holds from sellable stock', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];

  assert.equal(inventory.find(products, '1'), products[0]);
  assert.equal(inventory.find(products, 2), null);
  assert.equal(inventory.getSellableStock(products[0]), 7);
  assert.equal(inventory.getSellableStock({ stock: 1, reserved: 2 }), 0);
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 6 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 2, qty: 1 }]), {
    ok: false, msg: 'Unknown product 2'
  });
});

test('CURRENT BEHAVIOUR: the stock check rejects the exact sellable quantity', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];

  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 7 }]), {
    ok: false, msg: 'Rice is out of stock (7 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: repeated product lines are checked individually against sellable stock', () => {
  const products = [{ id: 1, stock: 7, reserved: 2 }];
  const items = [{ id: 1, qty: 3 }, { id: 1, qty: 3 }];

  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.equal(products[0].stock, 1);
  assert.equal(products[0].reserved, 2);
  assert.equal(inventory.getSellableStock(products[0]), 0);
});

test('inventory deducts committed units from physical stock and releases quote holds separately', () => {
  const products = [{ id: 1, stock: 10, reserved: 3 }];

  inventory.reserve(products, [{ id: 1, qty: 2 }]);
  assert.deepEqual(products[0], { id: 1, stock: 8, reserved: 3 });

  inventory.release(products, [{ productId: 1, qty: 4 }]);
  assert.deepEqual(products[0], { id: 1, stock: 8, reserved: 0 });
});

test('inventory summaries classify by sellable units and value physical stock', () => {
  const products = [
    { stock: 4, reserved: 4, price: 10 },
    { stock: 5, reserved: 3, price: 12.5, reorderLevel: 2 },
    { stock: 12, reserved: 1, price: 5 }
  ];

  assert.deepEqual(inventory.summarize(products), {
    totalSkus: 3, outOfStockCount: 1, lowStockCount: 1, totalValuation: 162.5
  });
});

test('orders assign IDs, fill in defaults, and look up string IDs', () => {
  const db = { orders: [], nextOrderId: 1001 };
  const order = orders.add(db, { date: '02/01/2024', subtotal: 100, discount: 0, tax: 5, total: 105 });

  assert.deepEqual(order, {
    id: 1001, date: '02/01/2024', customer: 'Walk-in', customerId: null, paymentMode: 'cash',
    status: 'completed', items: [], coupon: '', subtotal: 100, discount: 0, tax: 5, total: 105
  });
  assert.equal(db.nextOrderId, 1002);
  assert.equal(orders.get(db, '1001'), order);
  assert.equal(orders.get(db, 999), null);
});

test('order history searches ID, customer, and coupon and filters within a month', () => {
  const db = { orders: [
    { id: 101, date: '01/02/2024', customer: 'Asha', status: 'completed' },
    { id: 102, date: '03/02/2024', customer: 'Asha', coupon: 'SAVE10', status: 'pending' },
    { id: 103, date: '02/02/2024', customer: 'Ravi' }
  ] };

  assert.deepEqual(orders.list(db, { search: ' ASHA ' }).map(order => order.id), [102, 101]);
  assert.deepEqual(orders.list(db, { search: 'save10', status: 'pending' }).map(order => order.id), [102]);
  assert.deepEqual(orders.list(db, { search: '103', status: 'completed' }).map(order => order.id), [103]);
  const range = orders.list(db, { from: '2024-02-02', to: '2024-02-03' });
  assert.deepEqual(range.map(order => order.id), [102, 103]);
});

test('CURRENT BEHAVIOUR: the day-first string puts 31 January inside a February-onward filter', () => {
  const db = { orders: [{ date: '01/02/2024' }, { date: '31/01/2024' }, { date: '15/02/2024' }] };

  assert.deepEqual(orders.list(db, { from: '2024-02-01' }).map(order => order.date), [
    '31/01/2024', '15/02/2024', '01/02/2024'
  ]);
});

test('CURRENT BEHAVIOUR: cancellation reverses Khata but does not restore physical stock', () => {
  const customer = { id: 1, openingBalance: 10, totalBilled: 125, totalSettled: 5 };
  const product = { id: 2, stock: 8, reserved: 2 };
  const order = { id: 3, items: [{ id: 2, qty: 2 }], customerId: 1, paymentMode: 'khata', total: 105 };
  const db = { customers: [customer], products: [product], orders: [order] };

  assert.deepEqual(orders.cancel(db, '3', 'Changed mind'), { ok: true, order });
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, 'Changed mind');
  assert.match(order.cancelledAt, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(product, { id: 2, stock: 8, reserved: 2 });
  assert.equal(customer.totalBilled, 20);
  assert.equal(customer.balance, 25);
  assert.deepEqual(orders.cancel(db, '3'), { ok: false, error: 'Order #3 is already cancelled' });
  assert.deepEqual(orders.cancel(db, '99'), { ok: false, error: 'Order not found' });
});

test('Khata computes balances, accepts a charge at the credit limit, and rejects a higher charge', () => {
  const customer = { id: 1, name: 'Asha', openingBalance: 20, totalBilled: 30, totalSettled: 10, creditLimit: 100 };
  const db = { customers: [customer] };

  assert.equal(ledger.listCustomers(db)[0].balance, 40);
  assert.equal(ledger.findCustomer(db, '1'), customer);
  assert.equal(ledger.chargeOrderToKhata(db, 1, '60').ok, true);
  assert.equal(customer.totalBilled, 90);
  assert.equal(customer.balance, 100);
  assert.match(ledger.chargeOrderToKhata(db, 1, 0.01).error, /credit limit exceeded/);
  assert.equal(customer.balance, 100);
  assert.deepEqual(ledger.chargeOrderToKhata(db, 42, 10), {
    ok: false, error: 'Customer account not found for Khata billing'
  });
});

test('CURRENT BEHAVIOUR: a zero Khata limit is displayed as 5000 and allows a larger charge', () => {
  const db = { customers: [{ id: 1, creditLimit: 0 }] };

  assert.equal(ledger.listCustomers(db)[0].creditLimit, 5000);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 5100).ok, true);
  assert.equal(db.customers[0].balance, 5100);
});

test('a numeric settlement updates the balance and prepends a receipt', () => {
  const customer = { id: 1, name: 'Asha', openingBalance: 20, totalBilled: 300, totalSettled: 100 };
  const db = { customers: [customer], settlements: [{ id: 500 }], nextSettlementId: 501 };

  assert.deepEqual(ledger.recordSettlement(db, 1, 0), {
    ok: false, error: 'Settlement amount must be greater than zero'
  });
  const result = ledger.recordSettlement(db, '1', 50);
  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, 150);
  assert.equal(customer.balance, 170);
  assert.equal(db.nextSettlementId, 502);
  const { date, ...receipt } = db.settlements[0];
  assert.match(date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(receipt, {
    id: 501, customerId: 1, customerName: 'Asha', amount: 50, mode: 'upi', note: 'Khata settlement'
  });
  assert.equal(db.settlements[1].id, 500);
});

test('CURRENT BEHAVIOUR: a string settlement concatenates the ledger total but records a numeric receipt', () => {
  const customer = { id: 1, openingBalance: 1000, totalBilled: 0, totalSettled: 100 };
  const db = { customers: [customer], nextSettlementId: 501 };

  const result = ledger.recordSettlement(db, 1, '50', 'cash', 'Test receipt');

  assert.equal(result.ok, true);
  assert.equal(customer.totalSettled, '10050');
  assert.equal(customer.balance, -9050);
  assert.equal(result.settlement.amount, 50);
});
