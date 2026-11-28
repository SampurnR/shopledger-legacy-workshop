const assert = require('node:assert/strict');
const { test } = require('node:test');
const access = require('../lib/access');

test('authentication fails closed and the export role requires distinct admin credentials', t => {
  const names = ['SHOPLEDGER_STAFF_PASSWORD', 'SHOPLEDGER_ADMIN_PASSWORD'];
  const original = names.map(name => process.env[name]);
  t.after(() => names.forEach((name, index) => {
    if (original[index] === undefined) delete process.env[name];
    else process.env[name] = original[index];
  }));
  names.forEach(name => delete process.env[name]);

  function authorize(credentials, adminOnly) {
    const req = { get: () => credentials && 'Basic ' + Buffer.from(credentials).toString('base64') };
    const res = {
      status: 200,
      set() {},
      sendStatus(status) { this.status = status; }
    };
    access.requireStaff(req, res, () => {
      if (adminOnly) access.requireAdmin(req, res, () => {});
    });
    return res.status;
  }

  assert.equal(authorize(), 401);
  assert.equal(authorize('staff:any-password'), 401);
  process.env.SHOPLEDGER_STAFF_PASSWORD = 'fixture-staff-password';
  process.env.SHOPLEDGER_ADMIN_PASSWORD = 'fixture-admin-password';
  assert.equal(authorize('staff:wrong-password'), 401);
  assert.equal(authorize('staff:fixture-staff-password'), 200);
  assert.equal(authorize('staff:fixture-staff-password', true), 403);
  assert.equal(authorize('admin:fixture-admin-password', true), 200);
  process.env.SHOPLEDGER_ADMIN_PASSWORD = process.env.SHOPLEDGER_STAFF_PASSWORD;
  assert.equal(authorize('admin:fixture-staff-password', true), 401);
});
