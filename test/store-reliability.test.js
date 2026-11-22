const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-store-test-'));
const file = path.join(directory, 'fixture.json');
const previousDbFile = process.env.SHOPLEDGER_DB_FILE;
process.env.SHOPLEDGER_DB_FILE = file;
const store = require('../lib/store');
if (previousDbFile === undefined) delete process.env.SHOPLEDGER_DB_FILE;
else process.env.SHOPLEDGER_DB_FILE = previousDbFile;

test.after(() => {
  fs.unlinkSync(file);
  fs.rmdirSync(directory);
});

test('store rejects another writer and a stale snapshot without losing the committed update', () => {
  fs.writeFileSync(file, '{"orders":[]}');
  const first = store.read();
  const second = store.read();
  const lock = file + '.lock';
  fs.writeFileSync(lock, '');
  try {
    assert.throws(() => store.write(first), { code: 'STORE_CONFLICT' });
  } finally {
    fs.unlinkSync(lock);
  }

  first.orders.push({ id: 1 });
  store.write(first);
  second.orders.push({ id: 2 });
  assert.throws(() => store.write(second), { code: 'STORE_CONFLICT' });
  assert.deepEqual(store.read().orders, [{ id: 1 }]);
  assert.deepEqual(fs.readdirSync(directory), ['fixture.json']);
});

test('failed atomic replacement preserves the original JSON and cleans up temporary files', (t) => {
  fs.writeFileSync(file, '{"orders":[]}');
  const db = store.read();
  db.orders.push({ id: 1 });
  t.mock.method(fs, 'renameSync', () => { throw new Error('Replacement failed'); });

  assert.throws(() => store.write(db), /Replacement failed/);
  assert.deepEqual(store.read().orders, []);
  assert.deepEqual(fs.readdirSync(directory), ['fixture.json']);
});
