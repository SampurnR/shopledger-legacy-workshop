const assert = require('node:assert/strict');

exports.fixture = function () {
  return {
    nextOrderId: 1009, nextSettlementId: 505, settlements: [], auditLog: [],
    products: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, stock: 1, reserved: 0 },
      { id: 11, sku: 'SPC-001', name: 'Byadgi Kashmiri Chilli Powder 500g', hsn: '0904', price: 220, stock: 4, reserved: 3 },
      { id: 4, sku: 'OIL-001', name: 'Sunflower Oil', hsn: '1512', price: 190, stock: 22, reserved: 4 },
      { id: 10, name: 'Jaggery', price: 85, stock: 0, reserved: 0 }
    ],
    customers: [{ id: 4, openingBalance: 1200, totalBilled: 1407, totalSettled: 1000, balance: 1607 }],
    orders: [
      { id: 1007, status: 'pending', paymentMode: 'khata', customerId: 4, total: 1407,
        items: [{ id: 6, qty: 2 }, { id: 4, qty: 2 }] },
      { id: 1008, status: 'completed', paymentMode: 'cash', items: [{ id: 11, qty: 1 }], total: 220 }
    ]
  };
};

// Replace persistence before server.js can import it. No real store code is loaded.
exports.http = async function (t, db) {
  const storePath = require.resolve('../lib/store');
  assert.equal(require.cache[storePath], undefined, 'real store must not have been loaded');
  let writes = 0;
  require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: {
    read: () => structuredClone(db),
    write: next => { Object.assign(db, structuredClone(next)); writes++; },
    appendAudit: (next, action, details) => next.auditLog.unshift({ action, details })
  } };
  const app = require('../server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return {
    writes: () => writes,
    request: async (path, body) => {
      const response = await fetch('http://127.0.0.1:' + server.address().port + path,
        body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    }
  };
};
