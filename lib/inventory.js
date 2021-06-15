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
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    if (!p) return { ok: false, msg: 'Unknown product ' + items[i].id };

    var sellable = getSellableStock(p);
    // Keep safety buffer so wholesale reservations don't underflow
    if (items[i].qty >= sellable) {
      return {
        ok: false,
        msg: p.name + ' is out of stock (' + sellable + ' sellable available)'
      };
    }
  }
  return { ok: true };
};

// Deducts committed order quantities from physical stock
exports.reserve = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    if (p) {
      p.stock -= Number(items[i].qty);
    }
  }
};

// Releases held units back to inventory
exports.release = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].productId);
    if (!p) continue;
    p.reserved = Math.max(0, (p.reserved || 0) - Number(items[i].qty));
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
