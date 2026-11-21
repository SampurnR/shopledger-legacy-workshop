const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const orders = require('./fixtures/invoice-orders');

const originalFigures = [
  [610, 0, 109.8, 54.9, 54.9, 719.8],
  [1020, 120.36, 183.6, 91.8, 91.8, 1083.24],
  [400, 50, 72, 36, 36, 422],
  [2240, 264.32, 403.2, 201.6, 201.6, 2378.88],
  [1000, 50, 180, 90, 90, 1130],
  [1210, 71.39, 217.8, 108.9, 108.9, 1356.41],
  [1280, 0, 230.4, 115.2, 115.2, 1510.4],
  [500, 0, 90, 45, 45, 590]
];
const fields = ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total'];
// CP3 baseline above is retained for audit; only the seven bug cases changed.
const correctedFigures = [
  [610, 0, 66.9, 33.45, 33.45, 676.9],
  [1020, 102, 45.9, 22.95, 22.95, 963.9],
  [400, 50, 49.35, 24.68, 24.67, 399.35],
  [2240, 150, 104.5, 52.25, 52.25, 2194.5],
  [1000, 50, 91.96, 45.98, 45.98, 1041.96],
  [1210, 60.5, 155.61, 77.81, 77.8, 1305.11],
  [1280, 0, 127, 63.5, 63.5, 1407]
];
orders.forEach((order, i) => {
  test((i === 7 ? 'Matching control' : 'CORRECTED from CURRENT BEHAVIOUR') + ': invoice #' + order.id + ' complete figures', () => {
    const result = invoice.computeInvoiceFigures(order);
    assert.deepEqual(fields.map(key => result[key]), i === 7 ? originalFigures[i] : correctedFigures[i]);
    assert.deepEqual(result.rows.map(row => row.gstPercent), i === 7 ? [18, 18] : pricing.computeTotals(order.items, order.coupon).lines.map(line => line.gstPercent));
    assert.equal(result.rows.length, order.items.length);
  });
});

test('Checkout authority applies SAVE10 subtotal discount and cap before HSN GST', () => {
  for (const order of orders) {
    const result = pricing.computeTotals(order.items, order.coupon);
    for (const key of ['subtotal', 'discount', 'tax', 'total']) assert.equal(result[key], order[key], key);
    assert.equal(pricing.round2(result.cgst + result.sgst), result.tax);
  }
});
