function find(products, id) {
  for (var i = 0; i < products.length; i++) {
    if (products[i].id == id) return products[i];
  }
  return null;
}

exports.find = find;

// returns {ok: true} or {ok: false, msg: '...'}
exports.check = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    if (!p) return { ok: false, msg: 'Unknown product ' + items[i].id };
    if (items[i].qty > p.stock) {
      return { ok: false, msg: p.name + ' is out of stock' };
    }
  }
  return { ok: true };
};

exports.reserve = function (products, items) {
  for (var i = 0; i < items.length; i++) {
    var p = find(products, items[i].id);
    p.stock -= items[i].qty;
  }
};
