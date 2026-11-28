var express = require('express');
var config = require('../config');
var store = require('../lib/store');
var reports = require('../lib/reports');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');

var router = express.Router();

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
  var body = (req.body && typeof req.body === 'object') ? req.body : {};
  if (body.items !== undefined && !Array.isArray(body.items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }
  var rawItems = body.items || [];
  var resolved = [];

  for (var i = 0; i < rawItems.length; i++) {
    var raw = rawItems[i];
    if (!raw || typeof raw !== 'object') {
      return res.status(400).json({ error: 'Invalid line item' });
    }
    if (raw.id === undefined || raw.id === null || raw.id === '') {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    var p = null;
    for (var j = 0; j < db.products.length; j++) {
      if (db.products[j].id == raw.id) {
        p = db.products[j];
        break;
      }
    }
    if (!p) {
      return res.status(400).json({ error: 'Unknown product ID ' + raw.id });
    }
    var q = parsePositiveIntQty(raw.qty);
    if (q === null) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }
    var resolvedItem = {
      id: p.id,
      name: p.name,
      hsn: p.hsn,
      price: p.price,
      qty: q
    };
    if (typeof p.gstRate === 'number' && !isNaN(p.gstRate)) {
      resolvedItem.gstRate = p.gstRate;
    }
    resolved.push(resolvedItem);
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
