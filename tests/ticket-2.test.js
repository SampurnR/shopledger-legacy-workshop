var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');

test('allows selling exactly the available sellable stock', function () {
  var products = [{ id: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }];

  assert.deepEqual(inventory.check(products, [{ id: 'SPC-001', qty: 1 }]), { ok: true });
});

test('rejects quantities above the available sellable stock', function () {
  var products = [{ id: 'SPC-001', name: 'Byadgi Chilli Powder', stock: 4, reserved: 3 }];

  assert.deepEqual(inventory.check(products, [{ id: 'SPC-001', qty: 2 }]), {
    ok: false,
    msg: 'Byadgi Chilli Powder is out of stock (1 sellable available)'
  });
});
