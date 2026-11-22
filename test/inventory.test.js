const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

const product = {
  id: 1,
  sku: 'RICE-1',
  name: 'Rice',
  hsn: '1006',
  price: 100,
  stock: 1,
  reserved: 0
};

test('CURRENT BEHAVIOUR: accepts quantity 1 when sellable stock is 1', () => {
  assert.deepEqual(inventory.check([product], [{ id: product.id, qty: 1 }]), {
    ok: true
  });
});

test('CURRENT BEHAVIOUR: rejects quantity 2 when sellable stock is 1', () => {
  assert.deepEqual(inventory.check([product], [{ id: product.id, qty: 2 }]), {
    ok: false,
    msg: 'Rice is out of stock (1 sellable available)'
  });
});

test('CURRENT BEHAVIOUR: accepts quantity 0 when sellable stock is 1', () => {
  assert.deepEqual(inventory.check([product], [{ id: product.id, qty: 0 }]), {
    ok: true
  });
});

test('CURRENT BEHAVIOUR: stock 4 with 3 reserved leaves 1 sellable and accepts quantity 1', () => {
  const partlyReserved = { ...product, stock: 4, reserved: 3 };

  assert.equal(inventory.getSellableStock(partlyReserved), 1);
  assert.deepEqual(inventory.check([partlyReserved], [{ id: partlyReserved.id, qty: 1 }]), {
    ok: true
  });
});

test('CURRENT BEHAVIOUR: cancelling a pending order restores stock', () => {
  const stockedProduct = { ...product, stock: 4, reserved: 1 };
  const items = [{
    id: stockedProduct.id,
    sku: stockedProduct.sku,
    name: stockedProduct.name,
    hsn: stockedProduct.hsn,
    price: stockedProduct.price,
    qty: 2
  }];
  const db = { products: [stockedProduct], orders: [] };

  const beforeOrder = { stock: stockedProduct.stock, reserved: stockedProduct.reserved };
  inventory.reserve(db.products, items);
  const afterReserve = { stock: stockedProduct.stock, reserved: stockedProduct.reserved };

  const order = { id: 1001, status: 'pending', paymentMode: 'cash', items };
  db.orders.push(order);
  const result = orders.cancel(db, order.id, 'Characterization test');
  const afterCancel = { stock: stockedProduct.stock, reserved: stockedProduct.reserved };

  assert.equal(result.ok, true);
  assert.equal(order.status, 'cancelled');
  assert.deepEqual({ beforeOrder, afterReserve, afterCancel }, {
    beforeOrder: { stock: 4, reserved: 1 },
    afterReserve: { stock: 2, reserved: 1 },
    afterCancel: { stock: 4, reserved: 1 }
  });
});

test('sells all remaining units and restores physical stock exactly once', () => {
  const stockedProduct = { ...product, stock: 4, reserved: 2 };
  const { id, sku, name, hsn, price } = stockedProduct;
  const line = { id, sku, name, hsn, price, qty: 1 };
  const items = [line, { ...line }];
  const order = { id: 1001, status: 'pending', paymentMode: 'cash', items };
  const db = { products: [stockedProduct], orders: [order] };

  assert.equal(inventory.check(db.products, [{ ...line, qty: 2 }]).ok, true);
  assert.equal(inventory.check(db.products, items).ok, true);
  assert.equal(inventory.check(db.products, [...items, { ...line }]).ok, false);
  inventory.reserve(db.products, items);
  assert.equal(stockedProduct.stock, 2);
  assert.equal(inventory.check(db.products, [line]).ok, false);

  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.equal(stockedProduct.stock, 4);
  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.equal(stockedProduct.stock, 4);
  assert.equal(stockedProduct.reserved, 2);
});
