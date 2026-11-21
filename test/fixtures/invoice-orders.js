// Explicit in-memory fixtures. Never import store or load the real data file.
function item(id, price, qty, hsn) {
  return { id, name: 'Fixture item ' + id, sku: 'TEST-' + id, price, qty, hsn };
}
module.exports = [
  { id: 1001, items: [item(8, 140, 2, '0902'), item(2, 165, 2, '0713')], coupon: '', subtotal: 610, discount: 0, tax: 66.9, total: 676.9 },
  { id: 1002, items: [item(1, 640, 1, '1006'), item(4, 190, 2, '1512')], coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9 },
  { id: 1003, items: [item(7, 260, 1, '0405'), item(8, 140, 1, '0902')], coupon: 'FLAT50', subtotal: 400, discount: 50, tax: 49.35, total: 399.35 },
  { id: 1004, items: [item(5, 1120, 2, '1508')], coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5 },
  { id: 1005, items: [item(1, 640, 1, '1006'), item(12, 180, 2, '2106')], coupon: 'FLAT50', subtotal: 1000, discount: 50, tax: 91.96, total: 1041.96 },
  { id: 1006, items: [item(6, 450, 2, '0405'), item(9, 310, 1, '0901')], coupon: 'WELCOME', subtotal: 1210, discount: 60.5, tax: 155.61, total: 1305.11 },
  { id: 1007, items: [item(6, 450, 2, '0405'), item(4, 190, 2, '1512')], coupon: '', subtotal: 1280, discount: 0, tax: 127, total: 1407 },
  { id: 1008, items: [item(8, 140, 1, '0902'), item(12, 180, 2, '2106')], coupon: '', subtotal: 500, discount: 0, tax: 90, total: 590 }
];
