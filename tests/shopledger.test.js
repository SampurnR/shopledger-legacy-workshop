const test = require('node:test');
const assert = require('node:assert/strict');

const invoice = require('../lib/invoice');
const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');

test('invoice figures match the ledger pricing for HSN GST and capped coupon orders', () => {
  const order = {
    id: 1002,
    customer: 'Anil Kulkarni',
    coupon: 'SAVE10',
    items: [{ id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 1020, qty: 1 }]
  };
  const ledgerTotals = pricing.computeTotals(order.items, order.coupon);
  const invoiceTotals = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceTotals.subtotal, ledgerTotals.subtotal);
  assert.equal(invoiceTotals.discount, ledgerTotals.discount);
  assert.equal(invoiceTotals.tax, ledgerTotals.tax);
  assert.equal(invoiceTotals.total, ledgerTotals.total);
});

test('inventory accepts buying exactly the remaining sellable stock', () => {
  const products = [{ id: 1, stock: 4, reserved: 3 }];
  assert.deepEqual(inventory.check(products, [{ id: 1, qty: 1 }]), { ok: true });
});

test('inventory release returns cancelled order items to stock reservations', () => {
  const products = [{ id: 1, stock: 4, reserved: 3 }];
  inventory.release(products, [{ id: 1, qty: 1 }]);
  assert.equal(products[0].reserved, 2);
});

test('order history sorts DD/MM/YYYY dates chronologically and filters inclusively', () => {
  const db = {
    orders: [
      { id: 1001, date: '28/12/2021' },
      { id: 1004, date: '30/01/2022' },
      { id: 1008, date: '15/03/2022' }
    ]
  };
  assert.deepEqual(orders.list(db, {}).map((order) => order.id), [1008, 1004, 1001]);
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-02-01' }).map((order) => order.id), [1004]);
});

test('Khata settlement treats browser string amounts as numbers', () => {
  const db = {
    customers: [{ id: 1, name: 'Meera', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 }],
    settlements: [],
    nextSettlementId: 501
  };
  const result = ledger.recordSettlement(db, 1, '500', 'upi', 'Part payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});
