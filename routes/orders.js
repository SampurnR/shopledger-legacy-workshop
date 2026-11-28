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

router.post('/orders', store.mutation(function (req, res, db, save) {
  var body = req.body || {};
  var status = body.status === undefined ? 'completed' : body.status;
  if (status !== 'completed' && status !== 'pending') {
    return res.status(400).json({ error: 'New orders must be completed or pending' });
  }
  var resolved = pricing.resolveItems(db.products, body.items);
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  var items = resolved.items;

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
  var paymentMode = (body.paymentMode || 'cash').toLowerCase();
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
    items: items,
    coupon: rawCoupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  order.pricingSnapshot = {
    cgst: totals.cgst,
    sgst: totals.sgst,
    lines: totals.lines
  };

  store.appendAudit(db, 'ORDER_CREATED', 'Order #' + order.id + ' (' + customerName + ') ₹' + order.total.toFixed(2));
  return save(order);
}, true));

router.post('/orders/:id/cancel', store.mutation(function (req, res, db) {
  var reason = (req.body && req.body.reason) ? req.body.reason : 'Cancelled from order desk';
  var result = orders.cancel(db, req.params.id, reason);

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(db, 'ORDER_CANCELLED', 'Order #' + result.order.id + ' cancelled');
  store.write(db);

  res.json(result.order);
}));

router.post('/orders/:id/dispatch', store.mutation(function (req, res, db) {
  var order = orders.get(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') return res.status(409).json({ error: 'Only pending orders can be dispatched' });
  order.status = 'completed';
  store.appendAudit(db, 'ORDER_DISPATCHED', 'Order #' + order.id + ' dispatched');
  store.write(db);
  return res.json(order);
}));

module.exports = router;
