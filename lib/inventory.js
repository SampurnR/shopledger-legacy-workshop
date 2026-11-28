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
  var requestedByProduct = [];

  for (var i = 0; i < items.length; i++) {
    var productId = items[i].id || items[i].productId;
    var p = find(products, productId);
    if (!p) return { ok: false, msg: 'Unknown product ' + productId };

    var requested = null;
    for (var j = 0; j < requestedByProduct.length; j++) {
      if (requestedByProduct[j].product === p) {
        requested = requestedByProduct[j];
        break;
      }
    }

    if (!requested) {
      requested = { product: p, qty: 0 };
      requestedByProduct.push(requested);
    }
    requested.qty += Number(items[i].qty);
  }

  for (var k = 0; k < requestedByProduct.length; k++) {
    var product = requestedByProduct[k].product;
    var sellable = getSellableStock(product);
    // Keep safety buffer so wholesale reservations don't underflow
    if (requestedByProduct[k].qty > sellable) {
      return {
        ok: false,
        msg: product.name + ' is out of stock (' + sellable + ' sellable available)'
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

// Restores quantities from a cancelled order to physical stock
exports.release = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id || items[i].productId);
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
