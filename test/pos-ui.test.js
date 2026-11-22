const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

function browserFixture() {
  const nodes = new Map();
  const requests = [];
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false });
      return nodes.get(id);
    },
    querySelectorAll: () => []
  };
  class Request {
    constructor() { this.headers = {}; }
    open(_method, url) { this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(body) { this.body = body; requests.push(this); }
    respond(status, result) {
      this.status = status;
      this.responseText = JSON.stringify(result);
      this.onload();
    }
  }
  const browser = vm.createContext({ document, XMLHttpRequest: Request, window: { crypto: webcrypto } });
  vm.runInContext(source.split('// Initial boot')[0], browser);
  browser.allProducts = [{ id: 1, name: 'Rice', price: 100 }];
  return { browser, requests, get: document.getElementById };
}

test('slow preview responses cannot replace newer totals or refill a cleared cart', () => {
  const { browser, requests, get } = browserFixture();
  const priced = (total) => ({ totals: { subtotal: total, tax: 0, discount: 0, total } });
  browser.cartQuantities = { 1: 1 };
  browser.updateCartPreview();
  browser.cartQuantities = { 1: 2 };
  browser.updateCartPreview();
  requests[1].respond(200, priced(200));
  requests[0].respond(200, priced(100));
  assert.equal(get('preview-total').textContent, '₹200.00');

  browser.updateCartPreview();
  browser.cartQuantities = {};
  browser.updateCartPreview();
  requests[2].respond(200, priced(200));
  assert.equal(get('preview-total').textContent, '₹0.00');
});

test('checkout and settlement guard repeated clicks and reuse the request key after a connection failure', () => {
  const { browser, requests, get } = browserFixture();
  browser.cartQuantities = { 1: 1 };
  get('settle-customer').value = '1';
  get('settle-amount').value = '10.00';

  for (const [buttonId, messageId, fail] of [
    ['place', 'msg', 'ontimeout'], ['btn-record-settlement', 'khata-msg', 'onerror']
  ]) {
    const button = get(buttonId);
    const offset = requests.length;
    button.onclick();
    button.onclick();
    assert.equal(requests.length, offset + 1);
    assert.equal(button.disabled, true);
    const first = requests[offset];
    const key = first.headers['Idempotency-Key'];
    assert.match(key, /^[a-f0-9]{32}$/);

    first[fail]();
    assert.equal(button.disabled, false);
    assert.match(get(messageId).textContent, /No response/);
    button.onclick();
    assert.equal(requests[offset + 1].headers['Idempotency-Key'], key);
    assert.equal(requests[offset + 1].body, first.body);
    requests[offset + 1].respond(400, { error: 'Rejected' });
    assert.equal(button.disabled, false);
  }
});

test('promo shortcuts use native keyboard-operable buttons', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.equal([...html.matchAll(/<button type="button" class="promo-chip" data-code="[A-Z0-9]+"/g)].length, 4);
});
