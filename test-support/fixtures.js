'use strict';

// Independent in-memory fixtures. Never import or read data/db.json here.
exports.orderDb = function () {
  return {
    orders: [
      { id: 1001, date: '28/12/2021', customer: 'Meera Joshi', status: 'completed', coupon: '' },
      { id: 1002, date: '05/01/2022', customer: 'Anil Kulkarni', status: 'completed', coupon: 'SAVE10' },
      { id: 1003, date: '14/01/2022', customer: 'Walk-in', status: 'completed', coupon: 'FLAT50' },
      { id: 1004, date: '30/01/2022', customer: 'Kalyani Foods', status: 'completed', coupon: 'SAVE10' },
      { id: 1005, date: '02/02/2022', customer: 'Priya Nair', status: 'completed', coupon: 'FLAT50' },
      { id: 1006, date: '18/02/2022', customer: 'Meera Joshi', status: 'completed', coupon: 'WELCOME' },
      { id: 1007, date: '04/03/2022', customer: 'Suresh Deshmukh', status: 'pending', coupon: '' },
      { id: 1008, date: '15/03/2022', customer: 'Walk-in', status: 'completed', coupon: '' }
    ]
  };
};

exports.ledgerDb = function () {
  return {
    customers: [{ id: 1, name: 'Meera Joshi', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01, creditLimit: 6000 }],
    settlements: [],
    nextSettlementId: 501
  };
};
