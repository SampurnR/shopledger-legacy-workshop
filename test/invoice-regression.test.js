const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

// In-memory copy of the supported order 1002 scenario; no database access.
const order1002 = {
  id: 1002,
  items: [
    { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
    { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
  ],
  coupon: 'SAVE10'
};

test('invoice uses checkout GST slabs and SAVE10 cap for order 1002', function () {
  const figures = invoice.computeInvoiceFigures(order1002);

  assert.deepEqual(
    {
      subtotal: figures.subtotal,
      discount: figures.discount,
      tax: figures.tax,
      cgst: figures.cgst,
      sgst: figures.sgst,
      total: figures.total,
      rows: figures.rows.map(row => ({ hsn: row.hsn, gstPercent: row.gstPercent, lineTax: row.lineTax }))
    },
    {
      subtotal: 1020,
      discount: 102,
      tax: 45.9,
      cgst: 22.95,
      sgst: 22.95,
      total: 963.9,
      rows: [
        { hsn: '1006', gstPercent: 5, lineTax: 28.8 },
        { hsn: '1512', gstPercent: 5, lineTax: 17.1 }
      ]
    }
  );
});
