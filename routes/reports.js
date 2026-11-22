var express = require('express');
var config = require('../config');
var store = require('../lib/store');
var reports = require('../lib/reports');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var inventory = require('../lib/inventory');

var router = express.Router();

router.get('/reports/dashboard', function (req, res) {
  var db = store.read();
  res.json({
    shop: config.shop,
    summary: reports.getDashboardSummary(db),
    recentAudit: (db.auditLog || []).slice(0, 12)
  });
});

router.get('/reports/gst-reconciliation', function (req, res) {
  var db = store.read();
  res.json(reports.getGstReconciliation(db));
});

// Cart live preview calculation for the POS drawer
router.post('/pricing/preview', function (req, res) {
  var db = store.read();
  var body = req.body || {};
  var resolved = inventory.resolveOrderItems(db.products, body.items || []);
  if (resolved.error) return res.status(400).json({ error: resolved.error });

  var sub = pricing.subtotal(resolved.items);
  var code = coupons.normalizeCode(body.coupon);
  var couponStatus = coupons.validate(code, sub);
  var totals = pricing.computeTotals(resolved.items, couponStatus.valid ? code : '');

  res.json({
    totals: totals,
    couponStatus: couponStatus
  });
});

router.get('/admin/export', function (req, res) {
  if (req.query.key != config.adminKey) return res.sendStatus(403);
  res.json(store.read());
});

module.exports = router;
