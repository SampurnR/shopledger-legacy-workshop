const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createStore } = require('../lib/store');

test('writers serialize replacement and reject a stale snapshot without losing committed work', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-store-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixture = path.join(directory, 'orders-fixture.json');
  fs.writeFileSync(fixture, '{}');
  const first = createStore(fixture);
  const second = createStore(fixture);
  const current = first.read();
  const stale = second.read();

  current.orders.push({ id: 1 });
  stale.orders.push({ id: 2 });
  first.write(current);
  assert.throws(() => second.write(stale), { code: 'STORE_CONFLICT' });
  assert.deepEqual(second.read().orders, [{ id: 1 }]);

  const fresh = second.read();
  fresh.orders.push({ id: 2 });
  fs.writeFileSync(fixture + '.lock', '');
  assert.throws(() => second.write(fresh), { code: 'STORE_CONFLICT' });
  fs.unlinkSync(fixture + '.lock');
  second.write(fresh);
  assert.deepEqual(first.read().orders, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(fs.readdirSync(directory), ['orders-fixture.json']);
});
