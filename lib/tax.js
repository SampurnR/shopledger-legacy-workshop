var config = require('../config');

exports.getRateForItem = function () {
  return config.tax.defaultRate;
};
