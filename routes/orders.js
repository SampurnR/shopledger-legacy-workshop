var express = require('express');
var store = require('../lib/store');
var inventory = require('../lib/inventory');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

var router = express.Router();

var IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
var IDEMPOTENCY_MAX_ENTRIES = 500;
var inFlightKeys = new Set();
var completedKeys = new Map();
var inFlightPayloads = new Set();

function parsePositiveIntQty(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && Number.isInteger(raw) && raw >= 1 ? raw : null;
  }
  if (typeof raw === 'string') {
    var s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    var n = Number(s);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }
  return null;
}

function getIdempotencyKey(req, body) {
  var headerKey = req.get('Idempotency-Key');
  var raw = (headerKey !== undefined && headerKey !== null && String(headerKey).trim() !== '')
    ? headerKey
    : (body.idempotencyKey !== undefined && body.idempotencyKey !== null && String(body.idempotencyKey).trim() !== '')
      ? body.idempotencyKey
      : body.clientRequestId;
  if (raw === undefined || raw === null) return null;
  var key = String(raw).trim();
  return key || null;
}

router.get('/orders', function (req, res) {
  var db = store.read();
  var filters = {
    status: req.query.status || 'all',
    search: req.query.search || '',
    from: req.query.from || '',
    to: req.query.to || ''
  };
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
  var body = (req.body && typeof req.body === 'object') ? req.body : {};
  var items = [];

  var orderStatus = (body.status === undefined || body.status === null) ? 'completed' : body.status;
  if (orderStatus !== 'completed' && orderStatus !== 'pending') {
    return res.status(400).json({ error: 'Invalid initial order status: ' + body.status });
  }

  if (body.paymentMode !== undefined && body.paymentMode !== null && typeof body.paymentMode !== 'string') {
    return res.status(400).json({ error: 'Invalid payment mode' });
  }
  var paymentMode = (typeof body.paymentMode === 'string' && body.paymentMode.trim()) ? body.paymentMode.trim().toLowerCase() : 'cash';

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'Pick at least one item to place an order' });
  }

  for (var i = 0; i < body.items.length; i++) {
    var rawItem = body.items[i];
    if (!rawItem || typeof rawItem !== 'object') {
      return res.status(400).json({ error: 'Invalid line item' });
    }
    if (rawItem.id === undefined || rawItem.id === null || rawItem.id === '') {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    var p = inventory.find(db.products, rawItem.id);
    if (!p) {
      return res.status(400).json({ error: 'Unknown product ID ' + rawItem.id });
    }
    var q = parsePositiveIntQty(rawItem.qty);
    if (q === null) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    // Preserve hsn and explicit numeric gstRate (including 0) on line items
    var item = {
      id: p.id,
      sku: p.sku,
      name: p.name,
      hsn: p.hsn,
      price: p.price,
      qty: q
    };
    if (typeof p.gstRate === 'number' && !isNaN(p.gstRate)) {
      item.gstRate = p.gstRate;
    }
    items.push(item);
  }

  var rawCoupon = coupons.normalizeCode(body.coupon);
  var customerId = body.customerId ? Number(body.customerId) : null;
  var customerName = (typeof body.customer === 'string' ? body.customer.trim() : '') || 'Walk-in';
  if (customerId) {
    var custObj = ledger.findCustomer(db, customerId);
    if (custObj) {
      customerName = custObj.name;
    }
  }

  var payloadHash = JSON.stringify({
    customerId: customerId,
    customer: customerId ? '' : customerName,
    paymentMode: paymentMode,
    status: orderStatus,
    coupon: rawCoupon,
    items: items.map(function (it) { return { id: it.id, qty: it.qty }; })
  });

  var idempKey = getIdempotencyKey(req, body);
  if (idempKey) {
    if (inFlightKeys.has(idempKey)) {
      return res.status(409).json({ error: 'Checkout submission already in progress' });
    }
    if (completedKeys.has(idempKey)) {
      var entry = completedKeys.get(idempKey);
      var existing = orders.get(db, entry.body.id);
      var stillExists = Boolean(
        existing &&
        existing.total === entry.body.total &&
        existing.date === entry.body.date &&
        (existing.items || []).length === (entry.body.items || []).length
      );
      if ((Date.now() - entry.ts > IDEMPOTENCY_TTL_MS) || !stillExists) {
        completedKeys.delete(idempKey);
      } else if (entry.payloadHash !== payloadHash) {
        return res.status(409).json({ error: 'Idempotency key already used with a different request payload' });
      } else {
        return res.status(entry.status).json(entry.body);
      }
    }
    inFlightKeys.add(idempKey);
  } else {
    if (inFlightPayloads.has(payloadHash)) {
      return res.status(409).json({ error: 'Duplicate checkout submission detected' });
    }
    inFlightPayloads.add(payloadHash);
  }

  try {
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

    if (paymentMode === 'khata') {
      if (!customerId) {
        return res.status(400).json({ error: 'Select a registered Khata customer account for credit billing' });
      }
      var khataRes = ledger.chargeOrderToKhata(db, customerId, totals.total);
      if (!khataRes.ok) {
        return res.status(409).json({ error: khataRes.error });
      }
    }

    inventory.reserve(db.products, items);

    var order = orders.add(db, {
      customer: customerName,
      customerId: customerId,
      paymentMode: paymentMode,
      status: orderStatus,
      items: items,
      coupon: rawCoupon,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total
    });

    store.appendAudit(db, 'ORDER_CREATED', 'Order #' + order.id + ' (' + customerName + ') ₹' + order.total.toFixed(2));
    store.write(db);

    if (idempKey) {
      if (completedKeys.size >= IDEMPOTENCY_MAX_ENTRIES) {
        var oldestKey = completedKeys.keys().next().value;
        if (oldestKey !== undefined) completedKeys.delete(oldestKey);
      }
      completedKeys.set(idempKey, {
        ts: Date.now(),
        payloadHash: payloadHash,
        status: 201,
        body: JSON.parse(JSON.stringify(order))
      });
    }

    return res.status(201).json(order);
  } finally {
    if (idempKey) {
      inFlightKeys.delete(idempKey);
    } else {
      inFlightPayloads.delete(payloadHash);
    }
  }
});

router.post('/orders/:id/cancel', function (req, res) {
  var db = store.read();
  var reason = (req.body && req.body.reason) ? req.body.reason : 'Cancelled from order desk';
  var result = orders.cancel(db, req.params.id, reason);

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(db, 'ORDER_CANCELLED', 'Order #' + result.order.id + ' cancelled');
  store.write(db);

  res.json(result.order);
});

module.exports = router;
