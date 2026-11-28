const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const path = require('node:path');

const publicDir = path.join(__dirname, '..', 'public');
const html = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const script = readFileSync(path.join(publicDir, 'js', 'app.js'), 'utf8');
const pageIds = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]));

function loadBrowser() {
  const requests = [];
  const elements = new Map();
  function element(key) {
    if (!elements.has(key)) {
      elements.set(key, {
        value: '', style: {}, className: '', textContent: '', innerHTML: '',
        focus() { this.focused = true; }
      });
    }
    return elements.get(key);
  }

  const document = {
    getElementById(id) {
      return pageIds.has(id) || /^qty-\d+$/.test(id) ? element(id) : null;
    },
    querySelector: element,
    querySelectorAll() { return []; }
  };
  class XMLHttpRequest {
    open(method, url) {
      this.method = method;
      this.url = url;
      this.headers = {};
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
    }

    send(raw) {
      requests.push({
        method: this.method, url: this.url, headers: this.headers,
        body: raw === undefined ? undefined : JSON.parse(raw), xhr: this
      });
    }
  }

  const ui = { document, XMLHttpRequest };
  ui.window = ui;
  runInNewContext(script, ui, { filename: 'public/js/app.js' });

  function pending(method, url) {
    const request = requests.find(entry => entry.method === method && entry.url === url && !entry.responded);
    assert.ok(request, 'Expected request ' + method + ' ' + url);
    return request;
  }

  function respond(request, data, status = 200) {
    request.responded = true;
    request.xhr.responseText = JSON.stringify(data);
    request.xhr.status = status;
    request.xhr.onload();
  }

  return { element, pending, requests, respond, ui };
}

const rice = {
  id: 1, name: 'Rice', sku: 'RICE-1', category: 'Staples & Grains', unit: 'kg',
  hsn: '1006', gstPercent: 5, price: 100, stock: 3, reserved: 1, sellable: 2, reorderLevel: 10
};

test('browser boot loads catalog, customer accounts, dashboard, and reconciliation and renders their results', () => {
  const { element, pending, requests, respond } = loadBrowser();
  assert.match(html, /href="css\/style\.css"/);
  assert.match(html, /<script src="js\/app\.js"><\/script>/);
  assert.deepEqual(requests.map(({ method, url }) => [method, url]), [
    ['GET', '/api/products'], ['GET', '/api/customers'],
    ['GET', '/api/reports/dashboard'], ['GET', '/api/reports/gst-reconciliation']
  ]);

  respond(pending('GET', '/api/products'), [rice]);
  assert.match(element('#products tbody').innerHTML, /RICE-1.*2 Left \(Low\).*Physical: 3 · Reserved: 1/s);
  assert.match(element('#inventory-audit-table tbody').innerHTML, /Critical \(1-2 Left\)/);
  element('pos-search').value = 'no match';
  element('pos-search').oninput();
  assert.match(element('#products tbody').innerHTML, /No products match the current filter/);

  respond(pending('GET', '/api/customers'), {
    customers: [{ id: 7, name: 'Test Account', type: 'Retail', balance: 50 }],
    settlements: [{ customerName: 'Test Account', amount: 10, mode: 'cash', date: '01/02/2024', note: 'Part payment' }]
  });
  assert.match(element('customer-select').innerHTML, /Test Account \(Retail · Due: ₹50\.00\)/);
  assert.match(element('#customers-table tbody').innerHTML, /Test Account/);
  assert.match(element('settlements-list').innerHTML, /CASH · Part payment/);

  respond(pending('GET', '/api/reports/dashboard'), {
    summary: { grossRevenue: 105, totalOrders: 1, reconciliationMismatchCount: 1, reconciliationTotalDelta: 13 }
  });
  assert.equal(element('kpi-revenue').textContent, '₹105.00');
  assert.equal(element('badge-orders').textContent, 1);
  assert.match(element('recon-alert-text').textContent, /1 Invoice GST Mismatches/);

  respond(pending('GET', '/api/reports/gst-reconciliation'), {
    totalChecked: 1, mismatchCount: 1, totalDelta: 13,
    rows: [{ orderId: 1001, matched: false, delta: 13, ledgerTotal: 105, invoiceTotal: 118 }]
  });
  assert.equal(element('recon-summary-pill').textContent, '1 of 1 Orders Mismatched (Δ ₹13.00)');
  assert.match(element('#recon-table tbody').innerHTML, /\/orders\/1001\/invoice.*₹105\.00.*₹118\.00.*\+₹13\.00.*Mismatch/s);
});

test('browser previews a cart, submits the order, and clears the cart after success', () => {
  const { element, pending, requests, respond, ui } = loadBrowser();
  element('place').onclick();
  assert.equal(element('msg').innerHTML, 'Pick at least one item from the catalog');
  assert.equal(requests.length, 4);

  respond(pending('GET', '/api/products'), [rice]);
  element('coupon').value = 'WELCOME';
  ui.onQtyInput(1, '2');
  const items = [{ id: 1, name: 'Rice', price: 100, qty: 2 }];
  const preview = pending('POST', '/api/pricing/preview');
  assert.deepEqual(preview.body, { items, coupon: 'WELCOME' });
  assert.equal(preview.headers['Content-Type'], 'application/json');
  respond(preview, {
    totals: { subtotal: 200, discount: 10, tax: 9.5, total: 199.5 }, couponStatus: { valid: true }
  });
  assert.equal(element('preview-total').textContent, '₹199.50');
  assert.equal(element('coupon-feedback').textContent, 'Promo applied: saved ₹10.00');

  element('customer-select').value = '7';
  element('customer-select').onchange();
  assert.equal(element('walkin-name-group').style.display, 'none');
  element('payment-mode').value = 'khata';
  element('order-status').value = 'pending';
  element('place').onclick();
  const checkout = pending('POST', '/api/orders');
  assert.deepEqual(checkout.body, {
    items, customerId: 7, customer: '', paymentMode: 'khata', status: 'pending', coupon: 'WELCOME'
  });
  respond(checkout, { id: 1001, total: 199.5 }, 201);
  assert.match(element('msg').innerHTML, /Order #1001 placed!.*₹199\.50.*\/orders\/1001\/invoice/s);
  assert.equal(element('cart-count').textContent, '0 SKUs, 0 units');
  assert.equal(element('preview-total').textContent, '₹0.00');
  assert.deepEqual(requests.slice(-3).map(request => request.url), [
    '/api/products', '/api/reports/dashboard', '/api/customers'
  ]);
});

test('CURRENT BEHAVIOUR: a late cart preview response can replace the latest totals', () => {
  const { element, pending, requests, respond, ui } = loadBrowser();
  respond(pending('GET', '/api/products'), [rice]);
  ui.stepQty(1, 1);
  const firstPreview = requests.at(-1);
  ui.stepQty(1, 1);
  const secondPreview = requests.at(-1);

  assert.equal(firstPreview.body.items[0].qty, 1);
  assert.equal(secondPreview.body.items[0].qty, 2);
  respond(secondPreview, { totals: { subtotal: 200, discount: 0, tax: 10, total: 210 } });
  assert.equal(element('preview-total').textContent, '₹210.00');
  respond(firstPreview, { totals: { subtotal: 100, discount: 0, tax: 5, total: 105 } });
  assert.equal(element('cart-count').textContent, '1 SKUs, 2 units');
  assert.equal(element('preview-total').textContent, '₹105.00');
});

test('browser order history encodes filters and refreshes after a cancellation', () => {
  const { element, pending, requests, respond, ui } = loadBrowser();
  element('orders-status').value = 'pending';
  element('orders-search').value = 'Rice & Tea';
  element('orders-from').value = '2024-02-01';
  element('orders-to').value = '2024-02-29';
  element('tab-orders').onclick();
  assert.equal(element('view-orders').style.display, '');
  assert.equal(element('view-new').style.display, 'none');
  const historyUrl = '/api/orders?status=pending&search=Rice%20%26%20Tea&from=2024-02-01&to=2024-02-29';
  respond(pending('GET', historyUrl), [{ id: 1001, status: 'pending', total: 105 }]);
  assert.match(element('#orders tbody').innerHTML, /\/orders\/1001\/invoice.*cancelOrder\(1001\)/s);

  ui.cancelOrder(1001);
  const cancellation = pending('POST', '/api/orders/1001/cancel');
  assert.deepEqual(cancellation.body, { reason: 'Cancelled from Order Register' });
  respond(cancellation, { id: 1001, status: 'cancelled' });
  assert.match(element('orders-action-msg').textContent, /Order #1001 has been marked as cancelled/);
  assert.deepEqual(requests.slice(-4).map(request => request.url), [
    historyUrl, '/api/products', '/api/customers', '/api/reports/dashboard'
  ]);
});

test('CURRENT BEHAVIOUR: the browser submits the Khata amount as a string and clears the fields on success', () => {
  const { element, pending, requests, respond, ui } = loadBrowser();
  ui.prefillSettlement(7);
  assert.equal(element('settle-customer').value, '7');
  assert.equal(element('settle-amount').focused, true);
  element('settle-amount').value = '20.50';
  element('settle-mode').value = 'cash';
  element('settle-note').value = 'Part payment';
  element('btn-record-settlement').onclick();

  const settlement = pending('POST', '/api/customers/7/settle');
  assert.deepEqual(settlement.body, { amount: '20.50', mode: 'cash', note: 'Part payment' });
  respond(settlement, { customer: { name: 'Test Account', balance: 29.5 } }, 201);
  assert.equal(element('khata-msg').textContent, 'Recorded settlement for Test Account. Updated balance: ₹29.50');
  assert.equal(element('settle-amount').value, '');
  assert.equal(element('settle-note').value, '');
  assert.deepEqual(requests.slice(-2).map(request => request.url), ['/api/customers', '/api/reports/dashboard']);
});
