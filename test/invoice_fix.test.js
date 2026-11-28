const { test, describe } = require('node:test');
const assert = require('node:assert');
const invoice = require('../lib/invoice');

describe('Ticket 1: Correct Behaviour Verification (Failing before fix)', () => {

  test('Order #1001: 5% HSN item should be taxed at 5%, matching billed ledger total 676.90', () => {
    const order1001 = {
      id: 1001,
      customer: 'Meera Joshi',
      coupon: '',
      items: [
        { name: 'Assam CTC Masala Chai 250g', sku: 'BEV-001', hsn: '0902', qty: 2, price: 140 },
        { name: 'Unpolished Toor Dal 1kg', sku: 'GRN-002', hsn: '0713', qty: 2, price: 165 }
      ]
    };
    const res = invoice.computeInvoiceFigures(order1001);
    assert.strictEqual(res.tax, 66.90);
    assert.strictEqual(res.total, 676.90);
  });

  test('Order #1002: Anil Kulkarni (SAVE10) billed 963.90 total with 45.90 GST and 102.00 discount', () => {
    const order1002 = {
      id: 1002,
      customer: 'Anil Kulkarni',
      coupon: 'SAVE10',
      items: [
        { name: 'Indrayani Basmati Rice 5kg', sku: 'GRN-001', hsn: '1006', qty: 1, price: 640 },
        { name: 'Cold-Pressed Sunflower Oil 1L', sku: 'OIL-001', hsn: '1512', qty: 2, price: 190 }
      ]
    };
    const res = invoice.computeInvoiceFigures(order1002);
    assert.strictEqual(res.discount, 102.00);
    assert.strictEqual(res.tax, 45.90);
    assert.strictEqual(res.total, 963.90);
  });

  test('Order #1004: Wholesale order with SAVE10 caps discount at 150, matching billed total 2194.50', () => {
    const order1004 = {
      id: 1004,
      customer: 'Kalyani Foods (Wholesale)',
      coupon: 'SAVE10',
      items: [
        { name: 'Cold-Pressed Groundnut Oil 5L', sku: 'OIL-002', hsn: '1508', qty: 2, price: 1120 }
      ]
    };
    const res = invoice.computeInvoiceFigures(order1004);
    assert.strictEqual(res.discount, 150.00);
    assert.strictEqual(res.tax, 104.50);
    assert.strictEqual(res.total, 2194.50);
  });

});
