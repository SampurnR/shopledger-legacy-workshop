var express = require('express');
var store = require('../lib/store');
var inventory = require('../lib/inventory');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

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
  store.withLock(function () {
    var db = store.read();
    var body = req.body || {};
    var requestId = String(body.requestId || '').trim();
    var requestFingerprint = JSON.stringify({
      items: body.items || [],
      customerId: body.customerId || null,
      customer: body.customer || '',
      paymentMode: body.paymentMode || 'cash',
      status: body.status || 'completed',
      coupon: coupons.normalizeCode(body.coupon)
    });
    var duplicate = orders.findByRequestId(db, requestId);
    if (duplicate) {
      if (duplicate.requestFingerprint !== requestFingerprint) {
        return res.status(409).json({ error: 'Request ID was already used for a different order' });
      }
      return res.status(200).json(duplicate);
    }

    if (!body.items || !body.items.length) {
      return res.status(400).json({ error: 'Pick at least one item to place an order' });
    }
    if (!orders.isValidStatus(body.status)) {
      return res.status(400).json({ error: 'Order status must be completed or pending' });
    }

    var paymentMode = String(body.paymentMode || 'cash').toLowerCase();
    if (['cash', 'upi', 'khata'].indexOf(paymentMode) === -1) {
      return res.status(400).json({ error: 'Payment mode must be cash, upi, or khata' });
    }

    var resolved = orders.resolveItems(db.products, body.items);
    if (!resolved.ok) return res.status(400).json({ error: resolved.error });
    var items = resolved.items;
    var stock = inventory.check(db.products, items);
    if (!stock.ok) return res.status(409).json({ error: stock.msg });

    var sub = pricing.subtotal(items);
    var rawCoupon = coupons.normalizeCode(body.coupon);
    if (rawCoupon) {
      var checkCoupon = coupons.validate(rawCoupon, sub);
      if (!checkCoupon.valid) return res.status(400).json({ error: checkCoupon.error });
    }

    var totals = pricing.computeTotals(items, rawCoupon);
    for (var i = 0; i < items.length; i++) {
      items[i].gstRate = totals.lines[i].gstPercent;
      items[i].lineDiscount = totals.lines[i].discount;
      items[i].taxable = totals.lines[i].taxable;
      items[i].lineTax = totals.lines[i].tax;
    }

    var customerName = (body.customer || '').trim() || 'Walk-in';
    var customerId = body.customerId ? Number(body.customerId) : null;
    if (customerId) {
      var customer = ledger.findCustomer(db, customerId);
      if (customer) customerName = customer.name;
    }

    if (paymentMode === 'khata') {
      if (!customerId) return res.status(400).json({ error: 'Select a registered Khata customer account for credit billing' });
      var khataResult = ledger.chargeOrderToKhata(db, customerId, totals.total);
      if (!khataResult.ok) return res.status(409).json({ error: khataResult.error });
    }

    inventory.reserve(db.products, items);
    var order = orders.add(db, {
      customer: customerName,
      customerId: customerId,
      paymentMode: paymentMode,
      status: body.status || 'completed',
      items: items,
      coupon: rawCoupon,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      requestId: requestId,
      requestFingerprint: requestId ? requestFingerprint : null
    });

    store.appendAudit(db, 'ORDER_CREATED', 'Order #' + order.id + ' (' + customerName + ') ₹' + order.total.toFixed(2));
    store.write(db);
    res.status(201).json(order);
  });
});

router.post('/orders/:id/cancel', function (req, res) {
  store.withLock(function () {
    var db = store.read();
    var reason = (req.body && req.body.reason) ? req.body.reason : 'Cancelled from order desk';
    var result = orders.cancel(db, req.params.id, reason);
    if (!result.ok) return res.status(400).json({ error: result.error });
    store.appendAudit(db, 'ORDER_CANCELLED', 'Order #' + result.order.id + ' cancelled');
    store.write(db);
    res.json(result.order);
  });
});

router.post('/orders/:id/complete', function (req, res) {
  store.withLock(function () {
    var db = store.read();
    var result = orders.complete(db, req.params.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    store.appendAudit(db, 'ORDER_COMPLETED', 'Order #' + result.order.id + ' dispatched');
    store.write(db);
    res.json(result.order);
  });
});

module.exports = router;
