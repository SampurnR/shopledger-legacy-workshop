var config = require('../config');

function find(products, id) {
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
  var requestedById = {};
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var prodId = item.id != null ? item.id : item.productId;
    var p = find(products, prodId);
    if (!p) return { ok: false, msg: 'Unknown product ' + prodId };

    var qty = Number(item.qty);
    if (!isFinite(qty) || qty <= 0) {
      return { ok: false, msg: 'Invalid quantity for ' + p.name };
    }
    requestedById[p.id] = (requestedById[p.id] || 0) + qty;
  }

  if (config.inventory && config.inventory.allowBackorder) {
    return { ok: true };
  }

  var ids = Object.keys(requestedById);
  for (var j = 0; j < ids.length; j++) {
    var prod = find(products, ids[j]);
    var sellable = getSellableStock(prod);
    if (requestedById[ids[j]] > sellable) {
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
  for (var i = 0; i < items.length; i++) {
    var prodId = items[i].id != null ? items[i].id : items[i].productId;
    var p = find(products, prodId);
    if (p) {
      p.stock = Math.max(0, Number(p.stock || 0) - Number(items[i].qty || 0));
    }
  }
};

// Returns cancelled order quantities back to physical stock
exports.release = function (products, items) {
  for (var i = 0; i < (items || []).length; i++) {
    var prodId = items[i].id != null ? items[i].id : items[i].productId;
    var p = find(products, prodId);
    if (!p) continue;
    p.stock = Number(p.stock || 0) + Number(items[i].qty || 0);
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
    var reorder = p.reorderLevel != null ? p.reorderLevel : config.inventory.defaultReorderLevel;

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
