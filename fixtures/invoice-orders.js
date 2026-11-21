'use strict';

// Hand-authored, in-memory ticket examples. Never load the application database.
function item(id, name, hsn, price, qty) {
  return { id, name, sku: 'TEST-' + id, hsn, price, qty };
}

function order(id, items, coupon, subtotal, discount, tax, total) {
  return { id, date: '01/01/2022', customer: 'Test Customer', status: 'completed',
    paymentMode: 'cash', items, coupon, subtotal, discount, tax, total };
}

exports.examples = [
  order(1001, [item(8, 'Tea', '0902', 140, 2), item(2, 'Dal', '0713', 165, 2)], '', 610, 0, 66.9, 676.9),
  order(1002, [item(1, 'Rice', '1006', 640, 1), item(4, 'Oil', '1512', 190, 2)], 'SAVE10', 1020, 102, 45.9, 963.9),
  order(1003, [item(7, 'Butter', '0405', 260, 1), item(8, 'Tea', '0902', 140, 1)], 'FLAT50', 400, 50, 49.35, 399.35),
  order(1004, [item(5, 'Groundnut oil', '1508', 1120, 2)], 'SAVE10', 2240, 150, 104.5, 2194.5),
  order(1005, [item(1, 'Rice', '1006', 640, 1), item(12, 'Kokum', '2106', 180, 2)], 'FLAT50', 1000, 50, 91.96, 1041.96),
  order(1006, [item(6, 'Ghee', '0405', 450, 2), item(9, 'Coffee', '0901', 310, 1)], 'WELCOME', 1210, 60.5, 155.61, 1305.11),
  order(1007, [item(6, 'Ghee', '0405', 450, 2), item(4, 'Oil', '1512', 190, 2)], '', 1280, 0, 127, 1407),
  order(1008, [item(8, 'Tea', '0902', 140, 1), item(12, 'Kokum', '2106', 180, 2)], '', 500, 0, 90, 590)
];

exports.item = item;
exports.order = order;
