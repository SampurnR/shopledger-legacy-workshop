const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { compileFunction } = require('node:vm');

const filename = require.resolve('../lib/store');
const evaluateStore = compileFunction(readFileSync(filename, 'utf8'), ['require', 'exports', '__dirname'], { filename });

function memoryStore(initialJson = '{}') {
  const directory = path.resolve('virtual-store', 'lib');
  const dbPath = path.resolve(directory, '..', 'data', 'db.json');
  const store = {};
  let json = initialJson;
  const memoryFs = {
    readFileSync(file, encoding) {
      assert.equal(file, dbPath);
      assert.equal(encoding, 'utf8');
      return json;
    },
    writeFileSync(file, contents) {
      assert.equal(file, dbPath);
      json = contents;
    }
  };

  evaluateStore(name => {
    if (name === 'fs') return memoryFs;
    assert.equal(name, 'path');
    return path;
  }, store, directory);

  return { store, get json() { return json; } };
}

test('store reads JSON and supplies missing collections and counters', () => {
  const { store } = memoryStore('{"products":[{"id":1}],"nextOrderId":1009}');

  assert.deepEqual(store.read(), {
    products: [{ id: 1 }], orders: [], customers: [], settlements: [], auditLog: [],
    nextOrderId: 1009, nextSettlementId: 501
  });
});

test('store writes the full state as two-space JSON and can read it back', () => {
  const memory = memoryStore();
  const db = { orders: [{ id: 1001 }], nextOrderId: 1002 };

  memory.store.write(db);

  const expected = {
    orders: [{ id: 1001 }], nextOrderId: 1002, products: [], customers: [],
    settlements: [], auditLog: [], nextSettlementId: 501
  };
  assert.deepEqual(db, expected);
  assert.equal(memory.json, JSON.stringify(expected, null, 2));
  assert.deepEqual(memory.store.read(), expected);
});

test('malformed JSON is surfaced as a parse error', () => {
  const { store } = memoryStore('{"orders":');

  assert.throws(() => store.read(), SyntaxError);
});

test('audit prepends a timestamped entry and retains the newest 100', () => {
  const { store } = memoryStore();
  const db = { auditLog: Array.from({ length: 100 }, (_, index) => ({ action: 'OLDER_' + index })) };

  store.appendAudit(db, 'ORDER_CREATED');

  const { ts, ...entry } = db.auditLog[0];
  assert.equal(new Date(ts).toISOString(), ts);
  assert.deepEqual(entry, { action: 'ORDER_CREATED', details: '' });
  assert.equal(db.auditLog.length, 100);
  assert.equal(db.auditLog.at(-1).action, 'OLDER_98');
});
