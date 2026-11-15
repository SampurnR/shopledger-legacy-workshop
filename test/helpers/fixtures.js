exports.product = function (overrides) {
  return Object.assign({ id: 1, name: 'Rice', stock: 5, reserved: 2, price: 100 }, overrides);
};

exports.database = function () {
  return {
    products: [exports.product()],
    orders: [],
    customers: [{ id: 1, openingBalance: 0, totalBilled: 0, totalSettled: 0 }],
    settlements: [],
    auditLog: [],
    nextOrderId: 1,
    nextSettlementId: 1
  };
};
