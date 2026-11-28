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
  var db = store.read();
  var body = req.body || {};
  var resolved = orders.resolveItems(db.products, body.items == null ? [] : body.items);
  if (!resolved.ok) return res.status(400).json({ error: resolved.error });
  var items = resolved.items;

  if (!items.length) {
    return res.status(400).json({ error: 'Pick at least one item to place an order' });
  }

  var stock = inventory.check(db.products, items);
  if (!stock.ok) {
    return res.status(409).json({ error: stock.msg });
  }

  if ((body.customer != null && typeof body.customer !== 'string') ||
      (body.coupon != null && typeof body.coupon !== 'string')) {
    return res.status(400).json({ error: 'Customer name and coupon must be text' });
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
  var paymentMode = body.paymentMode == null || body.paymentMode === '' ? 'cash' : body.paymentMode;
  if (typeof paymentMode === 'string') paymentMode = paymentMode.toLowerCase();
  if (paymentMode !== 'cash' && paymentMode !== 'upi' && paymentMode !== 'khata') {
    return res.status(400).json({ error: 'Select cash, UPI, or Khata as the payment mode' });
  }
  var status = body.status == null || body.status === '' ? 'completed' : body.status;
  if (status !== 'completed' && status !== 'pending') {
    return res.status(400).json({ error: 'New orders must be completed or pending' });
  }

  var customerName = (body.customer || '').trim() || 'Walk-in';
  var customerId = null;
  var requestedId = body.customerId;
  if (requestedId != null && requestedId !== '') {
    customerId = typeof requestedId === 'number' || typeof requestedId === 'string' ? Number(requestedId) : NaN;
    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      return res.status(400).json({ error: 'Customer ID must be a positive whole number' });
    }
    var customer = ledger.findCustomer(db, customerId);
    if (!customer) return res.status(paymentMode === 'khata' ? 409 : 400).json({ error: 'Customer account not found' });
    customerName = customer.name;
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

  store.appendAudit(db, 'ORDER_CREATED', 'Order #' + order.id + ' (' + customerName + ') ₹' + order.total.toFixed(2));
  store.write(db);

  res.status(201).json(order);
});

router.post('/orders/:id/cancel', function (req, res) {
  var db = store.read();
  var reason = req.body && req.body.reason;
  if (reason != null && typeof reason !== 'string') {
    return res.status(400).json({ error: 'Cancellation reason must be text' });
  }
  var result = orders.cancel(db, req.params.id, reason || 'Cancelled from order desk');

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(db, 'ORDER_CANCELLED', 'Order #' + result.order.id + ' cancelled');
  store.write(db);

  res.json(result.order);
});

module.exports = router;
