var config = require('../config');

exports.calculateDiscount = function (subtotal, code) {
  var c = config.coupons[code];
  if (!c) return 0;
  if (c.type === 'percent') return subtotal * c.value / 100;
  if (c.type === 'flat') return Math.min(c.value, subtotal);
  return 0;
};
