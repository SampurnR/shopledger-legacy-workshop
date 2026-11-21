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

// Restores cancelled order quantities to physical inventory
exports.release = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    var itemId = item.id;
    if (typeof item.qty === 'boolean') {
      console.warn('Skipping inventory release for invalid order item at index ' + i);
      continue;
    }
    var qty = Number(item.qty);

    if (itemId == null || !isFinite(qty) || qty <= 0) {
      console.warn('Skipping inventory release for invalid order item at index ' + i);
      continue;
    }

    var p = find(products, itemId);
    if (!p) {
      console.warn('Skipping inventory release for unknown product ID ' + itemId);
      continue;
    }

    var stock = Number(p.stock);
    var restoredStock = stock + qty;
    if (!isFinite(stock) || !isFinite(restoredStock)) {
      console.warn('Skipping inventory release for product ID ' + itemId + ' because stock would be invalid');
      continue;
    }

    p.stock = restoredStock;
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
