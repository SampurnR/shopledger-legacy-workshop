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
  var quantities = new Map();
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    if (!p) return { ok: false, msg: 'Unknown product ' + items[i].id };

    quantities.set(p, (quantities.get(p) ?? 0) + Number(items[i].qty));
  }

  for (var [product, quantity] of quantities) {
    var sellable = getSellableStock(product);
    if (!Number.isFinite(quantity) || quantity > sellable) {
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

function parseStoredNumber(value) {
  if (typeof value === 'number' || (typeof value === 'string' && value.trim())) {
    return Number(value);
  }
  return NaN;
}

// Validate and calculate all stock changes before applying any of them.
exports.release = function (products, items) {
  if (!Array.isArray(items)) return { ok: false, error: 'Invalid saved order items' };
  var stockByProduct = new Map();
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item || item.id == null) {
      return { ok: false, error: 'Invalid saved order line at position ' + (i + 1) };
    }
    var p = find(products, item.id);
    if (!p) continue;

    var quantity = parseStoredNumber(item.qty);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return { ok: false, error: 'Invalid saved quantity for product ' + p.id };
    }

    var stock = stockByProduct.get(p) ?? parseStoredNumber(p.stock);
    if (!Number.isSafeInteger(stock) || !Number.isSafeInteger(stock + quantity)) {
      return { ok: false, error: 'Invalid resulting stock for product ' + p.id };
    }
    stockByProduct.set(p, stock + quantity);
  }

  for (var [product, resultingStock] of stockByProduct) {
    if (resultingStock < 0) {
      return { ok: false, error: 'Invalid resulting stock for product ' + product.id };
    }
  }
  for (var [product, stock] of stockByProduct) {
    product.stock = stock;
  }
  return { ok: true };
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
