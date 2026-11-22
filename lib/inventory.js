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
  var requested = new Map();
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    if (!p) return { ok: false, msg: 'Unknown product ' + items[i].id };

    var rawQty = items[i].qty;
    var qty = Number(rawQty);
    if ((typeof rawQty !== 'number' && typeof rawQty !== 'string') ||
        !Number.isSafeInteger(qty) || qty <= 0) {
      return { ok: false, msg: 'Quantity must be a positive integer for ' + p.name };
    }
    // Aggregate by resolved product so duplicate numeric/string IDs share stock.
    var totalRequested = (requested.get(p) || 0) + qty;
    requested.set(p, totalRequested);
    var sellable = getSellableStock(p);
    if (totalRequested > sellable) {
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

// Undo physical stock deduction; wholesale quote reservations stay unchanged.
exports.release = function (products, items) {
  if (!Array.isArray(items)) {
    return { ok: false, error: 'Invalid order items for stock restoration' };
  }
  // Validate the entire plan before applying any physical stock changes.
  var restoredStock = new Map();
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item || item.id == null) {
      return { ok: false, error: 'Invalid order line for stock restoration' };
    }
    var p = find(products, item.id);
    if (!p) return { ok: false, error: 'Unknown product ' + item.id + ' for stock restoration' };
    var rawQty = item.qty;
    if (typeof rawQty !== 'number' && typeof rawQty !== 'string') {
      return { ok: false, error: 'Quantity must be a positive integer for stock restoration' };
    }
    var qty = Number(rawQty);
    if (!Number.isSafeInteger(qty) || qty <= 0) {
      return { ok: false, error: 'Quantity must be a positive integer for stock restoration' };
    }
    var rawStock = p.stock;
    if ((typeof rawStock !== 'number' && typeof rawStock !== 'string') ||
        (typeof rawStock === 'string' && rawStock.trim() === '')) {
      return { ok: false, error: 'Invalid physical stock for product ' + item.id };
    }
    var stock = restoredStock.has(p) ? restoredStock.get(p) : Number(rawStock);
    if (!Number.isSafeInteger(stock) || stock < 0 || !Number.isSafeInteger(stock + qty)) {
      return { ok: false, error: 'Invalid physical stock for product ' + item.id };
    }
    restoredStock.set(p, stock + qty);
  }
  restoredStock.forEach(function (stock, product) { product.stock = stock; });
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
