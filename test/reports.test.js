const assert = require('node:assert/strict');
const { test } = require('node:test');
const reports = require('../lib/reports');

test('empty reports return zero counts and amounts', () => {
  assert.deepEqual(reports.getDashboardSummary({}), {
    grossRevenue: 0,
    totalTaxCollected: 0,
    totalDiscountGiven: 0,
    totalOrders: 0,
    activeOrdersCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    totalKhataReceivable: 0,
    inventory: { totalSkus: 0, outOfStockCount: 0, lowStockCount: 0, totalValuation: 0 },
    reconciliationMismatchCount: 0,
    reconciliationTotalDelta: 0
  });
  assert.deepEqual(reports.getGstReconciliation({}), {
    totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: []
  });
});

test('CURRENT BEHAVIOUR: dashboard revenue includes pending and Khata orders and excludes cancellations', () => {
  const db = {
    orders: [
      {
        id: 1, status: 'completed', paymentMode: 'khata', coupon: 'FLAT50',
        items: [{ hsn: '0902', price: 300, qty: 1 }], subtotal: 300, discount: 50, tax: 45, total: 295
      },
      {
        id: 2, status: 'pending', paymentMode: 'cash',
        items: [{ hsn: '1006', price: 100, qty: 1 }], subtotal: 100, discount: 0, tax: 5, total: 105
      },
      { id: 3, status: 'cancelled', discount: 80, tax: 90, total: 500 }
    ],
    customers: [
      { openingBalance: 500, totalBilled: 100, totalSettled: 50 },
      { totalSettled: 25 }
    ],
    products: [{ stock: 5, reserved: 1, price: 20 }]
  };

  assert.deepEqual(reports.getDashboardSummary(db), {
    grossRevenue: 400,
    totalTaxCollected: 50,
    totalDiscountGiven: 50,
    totalOrders: 3,
    activeOrdersCount: 2,
    pendingCount: 1,
    cancelledCount: 1,
    totalKhataReceivable: 525,
    inventory: { totalSkus: 1, outOfStockCount: 0, lowStockCount: 1, totalValuation: 100 },
    reconciliationMismatchCount: 0,
    reconciliationTotalDelta: 0
  });
});

test('reconciliation preserves signed row deltas and sums their absolute amounts', () => {
  const db = {
    orders: [
      { id: 1, items: [{ hsn: '1006', price: 100, qty: 1 }], subtotal: 100, discount: 0, tax: 4, total: 104 },
      {
        id: 2, coupon: 'SAVE10', items: [{ hsn: '0902', price: 2000, qty: 1 }],
        subtotal: 2000, discount: 150, tax: 340, total: 2190
      },
      {
        id: 3, items: [{ hsn: '0902', price: 100, qty: 1 }],
        subtotal: 100, discount: 0, tax: 18, total: 118
      },
      { id: 4, status: 'cancelled' },
      {
        id: 5, items: [{ hsn: '0902', price: 100, qty: 1 }],
        subtotal: 100, discount: 0, tax: 17, total: 118
      }
    ]
  };
  const { totalChecked, mismatchCount, totalDelta, rows } = reports.getGstReconciliation(db);

  assert.deepEqual({ totalChecked, mismatchCount, totalDelta }, { totalChecked: 4, mismatchCount: 3, totalDelta: 8 });
  assert.deepEqual(rows.map(({ orderId, delta, matched }) => ({ orderId, delta, matched })), [
    { orderId: 1, delta: 1, matched: false },
    { orderId: 2, delta: -7, matched: false },
    { orderId: 3, delta: 0, matched: true },
    { orderId: 5, delta: 0, matched: false }
  ]);
});

test('reconciliation matches the billed percentage discount and GST when the totals agree', () => {
  const order = {
    id: 5, coupon: 'SAVE10', items: [{ hsn: '0902', price: 1000, qty: 1 }],
    subtotal: 1000, discount: 100, tax: 162, total: 1062
  };
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows[0], {
    orderId: 5, date: undefined, customer: 'Walk-in', coupon: 'SAVE10',
    ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 162, ledgerTotal: 1062,
    invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: true
  });
});
