var express = require('express');
var store = require('../lib/store');
var inventory = require('../lib/inventory');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');
var replay = require('../lib/request-replay');

var router = express.Router();

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
  var remember = replay.start(db, req, res, 'order');
  if (!remember) return;
  var body = req.body || {};
  var resolved = inventory.resolveOrderItems(db.products, body.items || []);
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  var items = resolved.items;
  if (!items.length) {
    return res.status(400).json({ error: 'Pick at least one item to place an order' });
  }

  var status = body.status === undefined ? 'completed' : body.status;
  if (status !== 'completed' && status !== 'pending') {
    return res.status(400).json({ error: 'New orders must be pending or completed' });
  }

  var stock = inventory.check(db.products, items);
  if (!stock.ok) {
    return res.status(409).json({ error: stock.msg });
  }

  var sub = pricing.subtotal(items);
  var rawCoupon = coupons.normalizeCode(body.coupon);
  if (rawCoupon) {
    var checkCoupon = coupons.validate(rawCoupon, sub);
    if (!checkCoupon.valid) {
      return res.status(400).json({ error: checkCoupon.error });
    }
  }

  var totals = pricing.computeTotals(items, rawCoupon);
  var paymentMode = String(body.paymentMode || 'cash').toLowerCase();
  if (['cash', 'upi', 'khata'].indexOf(paymentMode) === -1) {
    return res.status(400).json({ error: 'Unsupported payment mode' });
  }
  var customerName = (body.customer || '').trim() || 'Walk-in';
  var customerId = body.customerId ? Number(body.customerId) : null;

  if (customerId) {
    var custObj = ledger.findCustomer(db, customerId);
    if (custObj) {
      customerName = custObj.name;
    }
  }

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
    status: status,
    pricingVersion: 2,
    items: items,
    coupon: rawCoupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });

  store.appendAudit(db, 'ORDER_CREATED', 'Order #' + order.id + ' (' + customerName + ') ₹' + order.total.toFixed(2));
  remember(order);
  store.write(db);

  res.status(201).json(order);
});

router.post('/orders/:id/dispatch', function (req, res) {
  var db = store.read();
  var result = orders.dispatch(db, req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });

  if (result.changed) {
    store.appendAudit(db, 'ORDER_DISPATCHED', 'Order #' + result.order.id + ' dispatched');
    store.write(db);
  }
  res.json(result.order);
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
