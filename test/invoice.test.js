const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function billOrder(items, coupon = '') {
  const billed = pricing.computeTotals(items, coupon);
  // Keep the same pricing fields that the order route saves.
  const order = {
    id: 1,
    status: 'completed',
    items,
    coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total,
  };
  return { billed, order };
}

test('invoice matches the billed total and line GST for a mixed-rate order with a capped coupon', () => {
  const { order } = billOrder([
    { name: 'Rice', hsn: '1006', price: 640, qty: 3 },
    { name: 'Ghee', hsn: '0405', price: 260, qty: 3 },
    { name: 'Tea', hsn: '0902', price: 140, qty: 3 },
  ], 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 150, tax: 252.45, total: 3222.45 },
  );
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 91.38], [12, 89.1], [18, 71.97],
  ]);
  assert.deepEqual([printed.cgst, printed.sgst], [126.23, 126.22]);

  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹252\.45<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹3222\.45<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('historical invoices preserve saved amounts and stay flagged when line GST cannot be reconstructed', () => {
  const order = {
    ...billOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]).order,
    discount: 20,
    tax: 0,
    total: 80,
  };
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.total], [100, 20, 0, 80]);
  assert.deepEqual([printed.cgst, printed.sgst], [0, 0]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[null, null]]);
  const html = invoice.render(order);
  assert.match(html, /<td class="r">&mdash;<\/td><td class="r">&mdash;<\/td>/);
  assert.match(html, /Line GST breakdown is unavailable/);

  const audit = reports.getGstReconciliation({ orders: [order] });
  assert.equal(audit.mismatchCount, 1);
  assert.equal(audit.totalDelta, 0);
  assert.equal(audit.rows[0].matched, false);
});

test('month-end invoice #1002 prints the recorded SAVE10 total and GST', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 },
    ],
  };

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 28.8], [5, 17.1]]);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90<\/td>/);
});

test('month-end invoice #1004 prints the ₹150 SAVE10 cap on ₹2,240', () => {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5,
    items: [{ name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }],
  };

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 104.5, 2194.5]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 104.5]]);
  assert.match(invoice.render(order), /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00<\/td>/);
});

test('checkout and invoice agree for an undiscounted order at the default GST rate', () => {
  const { billed, order } = billOrder([{ name: 'Item', price: 100, qty: 2 }]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.subtotal, billed.discount, billed.tax, billed.total], [200, 0, 36, 236]);
  assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.total], [200, 0, 36, 236]);
  assert.deepEqual([printed.cgst, printed.sgst], [18, 18]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('the invoice prints the GST rates and amounts billed on each HSN line', () => {
  const { billed, order } = billOrder([
    { name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 100, qty: 1 },
  ]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 10], [12, 12], [18, 18]]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [40, 20, 20, 440]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 10], [12, 12], [18, 18]]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [40, 20, 20, 440]);

  const html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹10\.00<\/td>/);
  assert.match(html, /12%<\/td><td class="r">₹12\.00<\/td>/);
  assert.match(html, /18%<\/td><td class="r">₹18\.00<\/td>/);
});

test('the invoice shows the capped percentage discount and GST charged at checkout', () => {
  const { billed, order } = billOrder([
    { name: 'Tea', hsn: '0902', price: 1200, qty: 1 },
    { name: 'Coffee', hsn: '0901', price: 800, qty: 1 },
  ], 'SAVE10');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ discount, tax }) => [discount, tax]), [[90, 199.8], [60, 133.2]]);
  assert.deepEqual([billed.discount, billed.tax, billed.total], [150, 333, 2183]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [199.8, 133.2]);
});

test('the invoice shows GST after the flat coupon discount', () => {
  const { billed, order } = billOrder([{ name: 'Tea', hsn: '0902', price: 400, qty: 1 }], 'FLAT50');
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.discount, billed.tax, billed.total], [50, 63, 413]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [50, 63, 413]);
  assert.equal(printed.rows[0].lineTax, 63);
});

test('the invoice uses checkout GST for whole-percent, decimal, and zero-rate overrides', () => {
  const { billed, order } = billOrder([
    { name: 'Whole-percent override', price: 1000, qty: 1, gstRate: 5 },
    { name: 'Decimal override', price: 1000, qty: 1, gstRate: 0.05 },
    { name: 'Zero-rate override', price: 1000, qty: 1, gstRate: 0 },
  ]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ gstPercent, tax }) => [gstPercent, tax]), [[5, 50], [5, 50], [0, 0]]);
  assert.deepEqual(printed.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [[5, 50], [5, 50], [0, 0]]);
});

test('printed line taxes and GST totals use checkout line rounding', () => {
  const { billed, order } = billOrder([
    { name: 'Item A', price: 10.03, qty: 1 },
    { name: 'Item B', price: 10.03, qty: 1 },
  ]);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(billed.lines.map(({ tax }) => tax), [1.81, 1.81]);
  assert.deepEqual(printed.rows.map(({ lineTax }) => lineTax), [1.81, 1.81]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [3.62, 1.81, 1.81, 23.68]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [3.62, 1.81, 1.81, 23.68]);
});

test('reconciliation matches both GST and grand total for a discounted order', () => {
  const { order } = billOrder([{ name: 'Tea', hsn: '0902', price: 100, qty: 1 }], 'WELCOME');
  const result = reports.getGstReconciliation({ orders: [order] });
  const [row] = result.rows;

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(row.matched, true);
  assert.equal(row.delta, 0);
  assert.deepEqual([row.ledgerTotal, row.ledgerTax], [112.1, 17.1]);
  assert.deepEqual([row.invoiceTotal, row.invoiceTax], [112.1, 17.1]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('reconciliation matches completed and pending orders and skips cancelled orders', () => {
  const { order: riceOrder } = billOrder([{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]);
  const { order: teaOrder } = billOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  const result = reports.getGstReconciliation({
    orders: [riceOrder, { ...teaOrder, id: 2, status: 'pending' }, { ...riceOrder, id: 3, status: 'cancelled' }],
  });

  assert.equal(result.totalChecked, 2);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.deepEqual(result.rows.map(({ orderId, delta, matched }) => [orderId, delta, matched]), [
    [1, 0, true], [2, 0, true],
  ]);
});
