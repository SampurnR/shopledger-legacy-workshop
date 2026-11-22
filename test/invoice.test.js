const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const store = require('../lib/store');
const orderRouter = require('../routes/orders');

function orderFromPricing(items, coupon = '') {
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, coupon);
  return { id: 1001, items, coupon, subtotal, discount, tax, total };
}

test('invoice for a billed 5% HSN line shows the recorded total and GST breakdown', () => {
  const order = {
    id: 1001,
    items: [{ name: 'Rice', hsn: '1006', price: 640, qty: 1 }],
    subtotal: 640, discount: 0, tax: 32, total: 672
  };

  const { rows, ...totals } = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals, {
    subtotal: 640, discount: 0, tax: 32, cgst: 16, sgst: 16, total: 672
  });
  assert.equal(rows[0].gstPercent, 5);
  assert.equal(rows[0].lineTax, 32);

  const html = invoice.render(order);
  assert.match(html, />5%<\/td><td class="r">₹32\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹32\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹672\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('checkout caps SAVE10 and apportions it before computing mixed-slab GST', () => {
  const items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ];
  const { lines, ...totals } = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, taxable: 1850,
    tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(lines, [
    {
      id: 1, name: 'Rice', hsn: '1006', gstPercent: 5,
      gross: 1000, discount: 75, taxable: 925, tax: 46.25, net: 971.25
    },
    {
      id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12,
      gross: 1000, discount: 75, taxable: 925, tax: 111, net: 1036
    }
  ]);
});

test('a placed order prints its capped discount and checkout GST by HSN', async (t) => {
  const db = {
    nextOrderId: 1001,
    orders: [],
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', gstRate: 5, price: 500, stock: 20 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', gstRate: 12, price: 1000, stock: 20 }
    ]
  };
  t.mock.method(store, 'read', () => db);
  const write = t.mock.method(store, 'write', () => {});

  const order = await new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/orders',
      body: { items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }], coupon: ' save10 ' }
    };
    const res = {
      status(code) {
        assert.equal(code, 201);
        return this;
      },
      json: resolve
    };
    orderRouter.handle(req, res, (error) => reject(error || new Error('Order route did not respond')));
  });

  assert.equal(write.mock.callCount(), 1);
  assert.equal(write.mock.calls[0].arguments[0], db);
  assert.equal(db.orders[0], order);
  assert.equal(order.coupon, 'SAVE10');
  assert.deepEqual(order.items, [
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
    { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ]);
  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 157.25);
  assert.equal(order.total, 2007.25);

  const { rows, ...totals } = invoice.computeInvoiceFigures(order);
  assert.deepEqual(totals, {
    subtotal: 2000, discount: 150, tax: 157.25, cgst: 78.63, sgst: 78.62, total: 2007.25
  });
  assert.deepEqual(rows, [
    { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 46.25 },
    { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000, gstPercent: 12, line: 1000, lineTax: 111 }
  ]);

  const html = invoice.render(order);
  assert.match(html, />5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, />12%<\/td><td class="r">₹111\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice and checkout interpret percentage, decimal and zero GST rates alike', () => {
  const items = [12, 0.12, 0].map((gstRate) => ({ price: 100, qty: 1, gstRate }));
  const checkout = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(checkout.lines.map((line) => [line.gstPercent, line.tax]), [[12, 12], [12, 12], [0, 0]]);
  assert.deepEqual(printed.rows.map((row) => [row.gstPercent, row.lineTax]), [[12, 12], [12, 12], [0, 0]]);
  assert.equal(checkout.tax, 24);
  assert.equal(printed.tax, 24);
});

test('invoice uses the saved discount for zero discounts and coupons that have since expired', () => {
  const zeroDiscount = {
    items: [{ price: 400, qty: 1 }], coupon: 'FLAT50', subtotal: 400, discount: 0, tax: 72, total: 472
  };
  const expired = {
    items: [{ price: 100, qty: 1 }], coupon: 'DIWALI20', subtotal: 100, discount: 20, tax: 14.4, total: 94.4
  };

  assert.equal(pricing.computeTotals(zeroDiscount.items, zeroDiscount.coupon).discount, 50);
  assert.equal(invoice.computeInvoiceFigures(zeroDiscount).discount, 0);
  assert.equal(invoice.computeInvoiceFigures(zeroDiscount).total, 472);
  const printed = invoice.computeInvoiceFigures(expired);
  assert.equal(printed.discount, 20);
  assert.equal(printed.tax, 14.4);
  assert.equal(printed.total, 94.4);
});

test('invoice GST uses the same per-line rounding as checkout', () => {
  const items = [
    { id: 1, price: 0.10, qty: 1, gstRate: 5 },
    { id: 2, price: 0.10, qty: 1, gstRate: 5 }
  ];
  const checkout = pricing.computeTotals(items);
  const printed = invoice.computeInvoiceFigures({ items });

  assert.deepEqual(printed.rows.map((row) => row.lineTax), [0.01, 0.01]);
  assert.equal(printed.tax, 0.02);
  assert.equal(printed.cgst, 0.01);
  assert.equal(printed.sgst, 0.01);
  assert.equal(printed.total, 0.22);
  assert.equal(checkout.tax, 0.02);
  assert.equal(checkout.total, 0.22);
});

test('reconciliation matches billed GST and still flags inconsistent saved tax', () => {
  const matched = orderFromPricing([{ price: 1000, qty: 1 }], 'WELCOME');
  const order = { ...matched, id: 1002, tax: 180 };
  const cancelled = { ...order, id: 1003, status: 'cancelled' };

  const result = reports.getGstReconciliation({ orders: [matched, order, cancelled] });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, true);
  assert.deepEqual(result.rows[1], {
    orderId: 1002, date: undefined, customer: 'Walk-in', coupon: 'WELCOME',
    ledgerSubtotal: 1000, ledgerDiscount: 50, ledgerTax: 180, ledgerTotal: 1121,
    invoiceDiscount: 50, invoiceTax: 171, invoiceTotal: 1121, delta: 0, matched: false
  });
  assert.doesNotMatch(invoice.render(matched), /Accountant Reconciliation Notice/);
});
