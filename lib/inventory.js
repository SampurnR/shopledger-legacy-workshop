var config = require('../config');

function find(products, id) {
  if (!products) return null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id == id) return products[i];
  }
  return null;
}

exports.find = find;

// Vikram (2021-06): sellable stock excludes units held for wholesale quotes
function getSellableStock(product) {
  if (!product) return 0;
  var reserved = Number(product.reserved || 0);
  return Math.max(0, Number(product.stock || 0) - reserved);
}

exports.getSellableStock = getSellableStock;

// returns {ok: true} or {ok: false, msg: '...'}
exports.check = function (products, items) {
  var list = items || [];
  var requestedById = {};
  var productById = {};
  var orderedIds = [];

  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it) return { ok: false, msg: 'Invalid order item' };

    var pid = it.id != null ? it.id : it.productId;
    var p = find(products, pid);
    if (!p) return { ok: false, msg: 'Unknown product ' + pid };

    var qty = Number(it.qty);
    if (typeof it.qty === 'boolean' || !isFinite(qty) || qty <= 0) {
      return { ok: false, msg: 'Invalid quantity for ' + p.name };
    }

    var key = String(p.id);
    if (!productById[key]) {
      productById[key] = p;
      requestedById[key] = 0;
      orderedIds.push(key);
    }
    requestedById[key] += qty;
  }

  for (var j = 0; j < orderedIds.length; j++) {
    var k = orderedIds[j];
    var prod = productById[k];
    var sellable = getSellableStock(prod);
    if (requestedById[k] > sellable) {
      return {
        ok: false,
        msg: prod.name + ' is out of stock (' + sellable + ' sellable available)'
      };
    }
  }

  return { ok: true };
};

// Deducts committed order quantities from physical stock
exports.reserve = function (products, items) {
  var list = items || [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it) continue;
    var pid = it.id != null ? it.id : it.productId;
    var p = find(products, pid);
    var qty = Number(it.qty);
    if (p && typeof it.qty !== 'boolean' && isFinite(qty) && qty > 0) {
      p.stock = Number(p.stock || 0) - qty;
    }
  }
};

// Releases held units back to inventory
exports.release = function (products, items) {
  var list = items || [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it) continue;
    var pid = it.id != null ? it.id : it.productId;
    var p = find(products, pid);
    var qty = Number(it.qty);
    if (!p || typeof it.qty === 'boolean' || !isFinite(qty) || qty <= 0) continue;
    p.stock = Number(p.stock || 0) + qty;
  }
};

exports.summarize = function (products) {
  var totalSkus = products.length;
  var outOfStockCount = 0;
  var lowStockCount = 0;
  var totalValuation = 0;

  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var sellable = getSellableStock(p);
    var reorder = p.reorderLevel || config.inventory.defaultReorderLevel;

    totalValuation += Number(p.stock || 0) * Number(p.price || 0);
    if (sellable === 0) {
      outOfStockCount++;
    } else if (sellable <= reorder) {
      lowStockCount++;
    }
  }

  return {
    totalSkus: totalSkus,
    outOfStockCount: outOfStockCount,
    lowStockCount: lowStockCount,
    totalValuation: Math.round(totalValuation * 100) / 100
  };
};
