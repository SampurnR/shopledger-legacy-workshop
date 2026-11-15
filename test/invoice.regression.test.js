var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Synthetic equivalent of the order reproduced through the temporary app.
// No server, filesystem, or persistence module is loaded by these tests.
function billedOrder() {
  return {
    id: 1001, date: '15/11/2026', customer: 'Synthetic invoice reproduction',
    status: 'completed', paymentMode: 'cash', coupon: 'SAVE10',
    items: [
      { id: 1, sku: 'TEST-RICE', name: 'Synthetic rice', hsn: '1006', price: 200, qty: 1 },
      { id: 2, sku: 'TEST-GHEE', name: 'Synthetic ghee', hsn: '0405', price: 200, qty: 1 },
      { id: 3, sku: 'TEST-TEA', name: 'Synthetic tea', hsn: '0902', price: 200, qty: 1 }
    ],
    subtotal: 600, discount: 60, tax: 63, total: 603
  };
}

test('REGRESSION: invoice total and GST breakdown match the mixed-slab discounted bill', function () {
  assert.deepEqual(invoice.computeInvoiceFigures(billedOrder()), {
    subtotal: 600, discount: 60, tax: 63, cgst: 31.5, sgst: 31.5, total: 603,
    rows: [
      { name: 'Synthetic rice', sku: 'TEST-RICE', hsn: '1006', qty: 1, price: 200,
        gstPercent: 5, line: 200, lineTax: 9 },
      { name: 'Synthetic ghee', sku: 'TEST-GHEE', hsn: '0405', qty: 1, price: 200,
        gstPercent: 12, line: 200, lineTax: 21.6 },
      { name: 'Synthetic tea', sku: 'TEST-TEA', hsn: '0902', qty: 1, price: 200,
        gstPercent: 18, line: 200, lineTax: 32.4 }
    ]
  });
});

test('REGRESSION: printed invoice and reconciliation agree with the mixed-slab discounted bill', function () {
  var order = billedOrder();
  var html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹63.00'));
  assert.ok(html.includes('Coupon Discount (SAVE10)</td><td class="r" style="color:#16a34a">-₹60.00'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹603.00'));
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });
  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
