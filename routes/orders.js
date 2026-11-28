var express = require('express');
var createHash = require('node:crypto').createHash;
var dates = require('../lib/dates');
var store = require('../lib/store');
var inventory = require('../lib/inventory');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

var router = express.Router();

function positiveInteger(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return 0;
  var number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

router.get('/orders', function (req, res) {
  var db = store.read();
  var filters = {
    status: req.query.status || 'all',
    search: req.query.search || '',
    from: req.query.from || '',
    to: req.query.to || ''
  };
  if ((filters.from && !dates.sortKey(filters.from)) || (filters.to && !dates.sortKey(filters.to)) ||
      (filters.from && filters.to && dates.sortKey(filters.from) > dates.sortKey(filters.to))) {
    return res.status(400).json({ error: 'Invalid date range' });
  }
  res.json(orders.list(db, filters));
});

router.get('/orders/:id', function (req, res) {
  var db = store.read();
  var o = orders.get(db, req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  res.json(o);
});

router.post('/orders', function (req, res) {
  var db = store.read();
  var body = req.body || {};
  var items = [];

  if (!Array.isArray(body.items) || !body.items.length) {
    return res.status(400).json({ error: 'Pick at least one item to place an order' });
  }

  var paymentMode = typeof body.paymentMode === 'string' ? body.paymentMode.toLowerCase() : body.paymentMode;
  if (paymentMode == null) paymentMode = 'cash';
  var status = body.status == null ? 'completed' : body.status;
  if (!['cash', 'upi', 'card', 'khata'].includes(paymentMode) || !['completed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payment mode or fulfillment status' });
  }
  if ((body.customer != null && typeof body.customer !== 'string') ||
      (body.coupon != null && typeof body.coupon !== 'string')) {
    return res.status(400).json({ error: 'Invalid customer name or coupon' });
  }

  var customerId = body.customerId == null ? null : positiveInteger(body.customerId);
  var customerName = (body.customer || '').trim() || 'Walk-in';
  var rawCoupon = coupons.normalizeCode(body.coupon);
  if (customerId === 0 || (paymentMode === 'khata' && customerId == null)) {
    return res.status(400).json({ error: 'Select a valid customer account' });
  }

  var requested = new Map();
  for (var i = 0; i < body.items.length; i++) {
    var line = body.items[i];
    var id = line && positiveInteger(line.id);
    var quantity = line && positiveInteger(line.qty);
    var combined = quantity + (requested.get(id) || 0);
    if (!id || !quantity || !Number.isSafeInteger(combined)) {
      return res.status(400).json({ error: 'Each item requires a product ID and a positive whole quantity' });
    }
    requested.set(id, combined);
  }

  var requestKey = req.get('Idempotency-Key');
  if (!requestKey || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestKey)) {
    return res.status(400).json({ error: 'A valid Idempotency-Key header is required' });
  }
  var requestItems = Array.from(requested).sort(function (a, b) { return a[0] - b[0]; });
  var fingerprint = createHash('sha256').update(JSON.stringify([
    requestItems, customerId, customerName, paymentMode, status, rawCoupon
  ])).digest('hex');
  var previous = db.orders.find(function (order) { return order.requestKey === requestKey; });
  if (previous) {
    if (previous.requestFingerprint !== fingerprint) {
      return res.status(409).json({ error: 'This idempotency key was used for a different order' });
    }
    return res.status(201).json(previous);
  }

  if (customerId != null) {
    var customer = ledger.findCustomer(db, customerId);
    if (!customer) return res.status(400).json({ error: 'Unknown customer account' });
    customerName = customer.name;
  }

  for (var entry of requested) {
    var product = inventory.find(db.products, entry[0]);
    if (!product) return res.status(400).json({ error: 'Unknown product ID ' + entry[0] });
    items.push({
      id: product.id,
      sku: product.sku,
      name: product.name,
      hsn: product.hsn,
      gstRate: product.gstRate,
      price: product.price,
      qty: entry[1]
    });
  }

  var stock = inventory.check(db.products, items);
  if (!stock.ok) {
    return res.status(409).json({ error: stock.msg });
  }

  var sub = pricing.subtotal(items);
  if (rawCoupon) {
    var checkCoupon = coupons.validate(rawCoupon, sub);
    if (!checkCoupon.valid) {
      return res.status(400).json({ error: checkCoupon.error });
    }
  }

  var totals = pricing.computeTotals(items, rawCoupon);
  if (paymentMode === 'khata' && status === 'completed') {
    var khataRes = ledger.chargeOrderToKhata(db, customerId, totals.total);
    if (!khataRes.ok) {
      return res.status(409).json({ error: khataRes.error });
    }
  }

  var heldForDispatch = status === 'pending';
  if (heldForDispatch) inventory.adjustHold(db.products, items, 1);
  else inventory.reserve(db.products, items);

  var order = orders.add(db, {
    customer: customerName,
    customerId: customerId,
    paymentMode: paymentMode,
    status: status,
    heldForDispatch: heldForDispatch,
    requestKey: requestKey,
    requestFingerprint: fingerprint,
    linePricing: totals.lines,
    items: items,
    coupon: rawCoupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  store.appendAudit(db, 'ORDER_CREATED', 'Order #' + order.id + ' (' + customerName + ') ₹' + order.total.toFixed(2));
  store.write(db);

  res.status(201).json(order);
});

router.post('/orders/:id/complete', function (req, res) {
  var db = store.read();
  var result = orders.complete(db, req.params.id);
  if (!result.ok) return res.status(409).json({ error: result.error });
  store.appendAudit(db, 'ORDER_COMPLETED', 'Order #' + result.order.id + ' completed');
  store.write(db);
  res.json(result.order);
});

router.post('/orders/:id/cancel', function (req, res) {
  var db = store.read();
  var reason = (req.body && req.body.reason) ? req.body.reason : 'Cancelled from order desk';
  if (typeof reason !== 'string') return res.status(400).json({ error: 'Invalid cancellation reason' });
  var result = orders.cancel(db, req.params.id, reason);

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(db, 'ORDER_CANCELLED', 'Order #' + result.order.id + ' cancelled');
  store.write(db);

  res.json(result.order);
});

module.exports = router;
