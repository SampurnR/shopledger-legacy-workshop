const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

test('reliability across checkout, settlement, dispatch, invoicing and persistence', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-reliability-'));
  const filename = path.join(dir, 'fixture.json');
  process.env.SHOPLEDGER_DB_FILE = filename;
  const app = require('../server');
  delete process.env.SHOPLEDGER_DB_FILE;
  const config = require('../config');
  const store = require('../lib/store');
  const snapshot = () => JSON.parse(fs.readFileSync(filename, 'utf8'));
  store.write({
    products: [
      { id: 1, name: 'Rice', hsn: '1006', gstRate: 12, price: 50.05, stock: 20 },
      { id: 2, name: 'Tea', hsn: '0902', price: 50.05, stock: 20 }
    ],
    customers: [{ id: 1, name: 'Customer', creditLimit: 5000 }, { id: 2, name: 'No credit', creditLimit: 0 }]
  });

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = async (url, body, status, key) => {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetch(base + url, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(response.status, status);
    return response.json();
  };

  const body = {
    items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }],
    customerId: 1, paymentMode: 'khata', status: 'pending', coupon: 'WELCOME'
  };

  await t.test('preview and checkout reject the same invalid quantities and status is checked before billing', async () => {
    const before = snapshot();
    for (const qty of [0, 1.5, '2x', null, true]) {
      const invalid = { items: [{ id: 1, qty }] };
      await post('/api/pricing/preview', invalid, 400);
      await post('/api/orders', invalid, 400);
    }
    await post('/api/orders', { ...body, status: 'cancelled' }, 400);
    const customers = await (await fetch(base + '/api/customers')).json();
    assert.equal(customers.customers[1].creditLimit, 0);
    await post('/api/orders', { ...body, customerId: 2 }, 409);
    assert.deepEqual(snapshot(), before);
  });

  let order;
  await t.test('checkout retry applies one charge and stock deduction and snapshots its exact GST', async () => {
    const preview = await post('/api/pricing/preview', body, 200);
    assert.deepEqual(preview.totals.lines.map((line) => line.gstPercent), [12, 18]);
    assert.equal(preview.totals.discount, 5.01);
    assert.equal(preview.totals.lines.reduce((cents, line) => cents + Math.round(line.discount * 100), 0), 501);
    const replies = await Promise.all([
      post('/api/orders', body, 201, 'order-1'),
      post('/api/orders', body, 201, 'order-1')
    ]);
    order = replies[0];
    assert.deepEqual(replies[1], order);
    assert.equal(order.total, preview.totals.total);
    assert.equal(snapshot().orders.length, 1);
    assert.equal(snapshot().customers[0].totalBilled, order.total);
    assert.deepEqual(snapshot().products.map((p) => p.stock), [19, 19]);
    await post('/api/orders', { ...body, coupon: '' }, 409, 'order-1');

    const rate = config.tax.hsnSlabs['0902'];
    const oldDiscount = config.coupons.WELCOME.value;
    try {
      config.tax.hsnSlabs['0902'] = 5;
      config.coupons.WELCOME.value = 10;
      const figures = require('../lib/invoice').computeInvoiceFigures(order);
      assert.deepEqual(figures.rows.map((row) => row.gstPercent), [12, 18]);
      assert.equal(figures.tax, order.tax);
      assert.equal(figures.total, order.total);
      const invoice = await fetch(base + '/orders/' + order.id + '/invoice');
      assert.equal(invoice.status, 200);
      assert.doesNotMatch(await invoice.text(), /Accountant Reconciliation Notice/);
    } finally {
      config.tax.hsnSlabs['0902'] = rate;
      config.coupons.WELCOME.value = oldDiscount;
    }
  });

  await t.test('settlement retries post once and share receipt and account precision', async () => {
    const before = snapshot();
    const url = '/api/customers/1/settle';
    await post(url, { amount: '0.004' }, 400, 'too-small');
    assert.deepEqual(snapshot(), before);
    const receipt = await post(url, { amount: '1.235' }, 201, 'payment-1');
    assert.deepEqual(await post(url, { amount: '1.235' }, 201, 'payment-1'), receipt);
    assert.equal(receipt.settlement.amount, 1.24);
    assert.equal(snapshot().customers[0].totalSettled, 1.24);
    assert.equal(snapshot().settlements.length, 1);
  });

  await t.test('dispatch completes a pending order once without another stock or credit change', async () => {
    const before = snapshot();
    const url = '/api/orders/' + order.id + '/dispatch';
    assert.equal((await post(url, {}, 200)).status, 'completed');
    await post(url, {}, 409);
    assert.deepEqual(snapshot().products, before.products);
    assert.deepEqual(snapshot().customers, before.customers);
  });

  await t.test('busy lock and failed atomic replacement preserve the fixture', async () => {
    const before = snapshot();
    fs.mkdirSync(filename + '.lock');
    try {
      await post('/api/orders', body, 503, 'busy');
    } finally {
      fs.rmdirSync(filename + '.lock');
    }
    const rename = t.mock.method(fs, 'renameSync', () => { throw new Error('replacement failed'); });
    try {
      assert.throws(() => store.write({ orders: [] }), /replacement failed/);
    } finally {
      rename.mock.restore();
    }
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(fs.readdirSync(dir), ['fixture.json']);
  });
});

test('cart ignores out-of-order previews and previews arriving after Clear Cart', () => {
  const elements = new Map();
  const requests = [];
  const context = vm.createContext({
    window: { crypto: require('node:crypto').webcrypto },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '' });
        return elements.get(id);
      },
      querySelectorAll() { return []; }
    },
    XMLHttpRequest: class {
      open(method, url) { this.url = url; }
      setRequestHeader(name, value) { (this.headers ||= {})[name] = value; }
      send() { requests.push(this); }
    }
  });
  const script = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  vm.runInContext(script, context);
  context.allProducts = [{ id: 1, name: 'Rice', price: 100 }];
  context.cartQuantities = { 1: 1 };
  context.updateCartPreview();
  context.cartQuantities = { 1: 2 };
  context.updateCartPreview();
  const previews = requests.filter((request) => request.url === '/api/pricing/preview');
  function respond(request, total) {
    request.status = 200;
    request.responseText = JSON.stringify({ totals: { total } });
    request.onload();
  }
  respond(previews[1], 200);
  respond(previews[0], 100);
  assert.equal(elements.get('preview-total').textContent, '₹200.00');
  context.updateCartPreview();
  const late = requests.at(-1);
  context.cartQuantities = {};
  context.updateCartPreview();
  respond(late, 200);
  assert.equal(elements.get('preview-total').textContent, '₹0.00');

  const button = { disabled: false };
  const result = [];
  const submit = () => context.submit(button, '/api/orders', { items: [{ id: 1, qty: 1 }] },
    (status, body) => result.push({ status, body }));
  submit();
  const unanswered = requests.at(-1);
  submit();
  assert.equal(requests.at(-1), unanswered);
  unanswered.ontimeout();
  assert.equal(button.disabled, false);
  assert.equal(result[0].status, 0);
  assert.match(result[0].body.error, /retry/i);
  submit();
  assert.notEqual(requests.at(-1), unanswered);
  assert.equal(requests.at(-1).headers['Idempotency-Key'], unanswered.headers['Idempotency-Key']);
});
