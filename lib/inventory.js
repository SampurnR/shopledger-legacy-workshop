var config = require('../config');
var tax = require('./tax');

function find(products, id) {
  for (var i = 0; i < products.length; i++) {
    if (products[i].id == id) return products[i];
  }
  return null;
}

exports.find = find;

exports.resolveOrderItems = function (products, rawItems) {
  if (!Array.isArray(rawItems)) return { error: 'Items must be an array' };

  var items = [];
  for (var i = 0; i < rawItems.length; i++) {
    var item = rawItems[i];
    var p = item && find(products, item.id);
    if (!p) return { error: 'Unknown product on line ' + (i + 1) };

    var qty = typeof item.qty === 'number' || typeof item.qty === 'string' ? Number(item.qty) : NaN;
    if (!Number.isSafeInteger(qty) || qty < 1) {
      return { error: 'Quantity must be a positive whole number on line ' + (i + 1) };
    }

    items.push({ id: p.id, sku: p.sku, name: p.name, hsn: p.hsn, price: p.price, qty: qty, gstRate: tax.getRateForItem(p) });
  }
  return { items: items };
};

// Vikram (2021-06): sellable stock excludes units held for wholesale quotes
function getSellableStock(product) {
  if (!product) return 0;
  var reserved = Number(product.reserved || 0);
  return Math.max(0, Number(product.stock || 0) - reserved);
}

exports.getSellableStock = getSellableStock;

// returns {ok: true} or {ok: false, msg: '...'}
exports.check = function (products, items) {
  var requested = new Map();
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    if (!p) return { ok: false, msg: 'Unknown product ' + items[i].id };

    var quantity = (requested.get(p.id) || 0) + Number(items[i].qty);
    var sellable = getSellableStock(p);
    if (quantity > sellable) {
      return {
        ok: false,
        msg: p.name + ' is out of stock (' + sellable + ' sellable available)'
      };
    }
    requested.set(p.id, quantity);
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

// Restores the physical units deducted when the order was placed.
exports.release = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var p = find(products, item.id == null ? item.productId : item.id);
    if (!p) continue;
    p.stock = Number(p.stock || 0) + Number(item.qty);
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
