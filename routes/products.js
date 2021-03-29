var express = require('express');
var store = require('../lib/store');
var inventory = require('../lib/inventory');
var tax = require('../lib/tax');
var coupons = require('../lib/coupons');

var router = express.Router();

router.get('/products', function (req, res) {
  var db = store.read();
  var category = req.query.category;
  var search = (req.query.search || '').toLowerCase().trim();

  var list = (db.products || []).map(function (p) {
    return {
      id: p.id,
      sku: p.sku || ('SKU-' + p.id),
      name: p.name,
      category: p.category || 'General',
      unit: p.unit || 'unit',
      hsn: p.hsn || '',
      gstPercent: tax.getSlabPercent(p),
      price: p.price,
      stock: p.stock,
      reserved: p.reserved || 0,
      sellable: inventory.getSellableStock(p),
      reorderLevel: p.reorderLevel || 10
    };
  });

  if (category && category !== 'all') {
    list = list.filter(function (p) {
      return p.category.toLowerCase() === category.toLowerCase();
    });
  }

  if (search) {
    list = list.filter(function (p) {
      return p.name.toLowerCase().indexOf(search) !== -1 ||
        p.sku.toLowerCase().indexOf(search) !== -1 ||
        p.hsn.indexOf(search) !== -1;
    });
  }

  res.json(list);
});

router.get('/coupons', function (req, res) {
  res.json(coupons.listActive());
});

module.exports = router;
