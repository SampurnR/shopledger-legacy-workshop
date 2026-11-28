var express = require('express');
var config = require('../config');
var store = require('../lib/store');
var inventory = require('../lib/inventory');
var reports = require('../lib/reports');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');

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
  var rawItems = Array.isArray(body.items) ? body.items : [];
  var resolved = [];

  for (var i = 0; i < rawItems.length; i++) {
    var entry = rawItems[i];
    if (!entry || entry.id == null) continue;
    var p = inventory.find(db.products, entry.id);
    var qty = parseInt(entry.qty, 10);
    if (p && qty > 0) {
      resolved.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        hsn: p.hsn,
        price: p.price,
        qty: qty
      });
    }
  }

  var sub = pricing.subtotal(resolved);
  var code = coupons.normalizeCode(body.coupon);
  var couponStatus = coupons.validate(code, sub);
  var totals = pricing.computeTotals(resolved, couponStatus.valid ? code : '');

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
