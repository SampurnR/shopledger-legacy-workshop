var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

function comparableFigures(totals, fields) {
  return fields.reduce(function (figures, field) {
    figures[field] = totals[field];
    return figures;
  }, {});
}

// These are in-memory copies of the ticket orders. Tests never load or write db.json.
var orders = [
  {
    id: 1001,
    items: [
      { id: 8, name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 2 },
      { id: 2, name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', price: 165, qty: 2 }
    ],
    coupon: '', subtotal: 610, discount: 0, tax: 66.9, total: 676.9
  },
  {
    id: 1002,
    items: [
      { id: 1, name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: 'SAVE10', subtotal: 1020, discount: 102, tax: 45.9, total: 963.9
  },
  {
    id: 1004,
    items: [
      { id: 5, name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', price: 1120, qty: 2 }
    ],
    coupon: 'SAVE10', subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5
  },
  {
    id: 1007,
    items: [
      { id: 6, name: 'A2 Gir Cow Ghee 500ml', sku: 'DRY-001', hsn: '0405', price: 450, qty: 2 },
      { id: 4, name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', price: 190, qty: 2 }
    ],
    coupon: '', subtotal: 1280, discount: 0, tax: 127, total: 1407
  },
  {
    id: 1008,
    items: [
      { id: 8, name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', price: 140, qty: 1 },
      { id: 12, name: 'Kokum Sherbet Concentrate 750ml', sku: 'BEV-003', hsn: '2106', price: 180, qty: 2 }
    ],
    coupon: '', subtotal: 500, discount: 0, tax: 90, total: 590
  }
];

var invoiceFields = ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total'];
var ledgerFields = ['subtotal', 'discount', 'tax', 'total'];

test('invoice figures match checkout ledger figures for ticket orders', async function (t) {
  for (var order of orders) {
    await t.test('order #' + order.id, function () {
      var checkout = pricing.computeTotals(order.items, order.coupon);
      var invoiceFigures = invoice.computeInvoiceFigures(order);
      assert.deepEqual(comparableFigures(invoiceFigures, invoiceFields), comparableFigures(checkout, invoiceFields));
      assert.deepEqual(comparableFigures(order, ledgerFields), comparableFigures(checkout, ledgerFields));
    });
  }
});

test('render omits the Accountant Reconciliation Notice when totals match', function () {
  var html = invoice.render(orders[0]);
  assert.equal(html.includes('Accountant Reconciliation Notice'), false);
});

test('render includes the Accountant Reconciliation Notice when the stored total differs', function () {
  var order = Object.assign({}, orders[0], { total: orders[0].total + 1 });
  var html = invoice.render(order);
  assert.equal(html.includes('Accountant Reconciliation Notice'), true);
});
