var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

function browser() {
  var elements = {};
  var requests = [];
  function element(id) {
    if (!elements[id]) elements[id] = { value: '', textContent: '', innerHTML: '', className: '', style: {} };
    return elements[id];
  }
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function (method, url) { this.url = url; };
  XMLHttpRequest.prototype.setRequestHeader = function () {};
  XMLHttpRequest.prototype.send = function (body) {
    this.body = body && JSON.parse(body);
    requests.push(this);
  };
  var context = vm.createContext({
    document: { getElementById: element, querySelector: element, querySelectorAll: function () { return []; } },
    XMLHttpRequest: XMLHttpRequest
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8'), context);
  context.allProducts = [{ id: 1, name: 'Ghee', price: 100 }];
  return {
    app: context,
    element: element,
    previews: function () { return requests.filter(function (r) { return r.url === '/api/pricing/preview'; }); }
  };
}

function respond(request, amount, valid) {
  request.status = 200;
  request.responseText = JSON.stringify({
    totals: { subtotal: amount, discount: 10, tax: 5, total: amount - 5 },
    couponStatus: { valid: valid, error: 'Old coupon invalid' }
  });
  request.onload();
}

function screen(b) {
  return ['preview-subtotal', 'preview-discount', 'preview-tax', 'preview-total', 'coupon-feedback'].map(function (id) {
    return b.element(id).textContent;
  });
}

test('latest pricing response formats totals and coupon feedback', function () {
  var b = browser();
  b.element('coupon').value = 'SAVE10';
  b.app.onQtyInput(1, '1');
  assert.equal(b.previews()[0].body.items[0].qty, 1);
  assert.equal(b.previews()[0].body.coupon, 'SAVE10');
  respond(b.previews()[0], 100, true);
  assert.deepEqual(screen(b), ['₹100.00', '-₹10.00', '₹5.00', '₹95.00', 'Promo applied: saved ₹10.00']);
});

test('REGRESSION: older pricing response cannot overwrite newer totals or coupon feedback', function () {
  var b = browser();
  b.element('coupon').value = 'OLD';
  b.app.onQtyInput(1, '1');
  b.element('coupon').value = 'SAVE10';
  b.app.onQtyInput(1, '2');
  respond(b.previews()[1], 200, true);
  respond(b.previews()[0], 100, false);
  assert.deepEqual(screen(b), ['₹200.00', '-₹10.00', '₹5.00', '₹195.00', 'Promo applied: saved ₹10.00']);
});

test('REGRESSION: pending pricing response cannot overwrite cleared cart totals', function () {
  var b = browser();
  b.element('coupon').value = 'SAVE10';
  b.app.onQtyInput(1, '1');
  b.element('clear-cart').onclick();
  assert.deepEqual(screen(b), ['₹0.00', '-₹0.00', '₹0.00', '₹0.00', '']);
  assert.equal(b.previews().length, 1);
  respond(b.previews()[0], 100, true);
  assert.deepEqual(screen(b), ['₹0.00', '-₹0.00', '₹0.00', '₹0.00', '']);
});
