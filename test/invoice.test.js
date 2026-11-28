'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

describe('lib/invoice characterization tests', () => {
  it('handles an order with no items', () => {
    const order = { id: 9001, items: [], coupon: '' };
    const fig = invoice.computeInvoiceFigures(order);

    assert.equal(fig.subtotal, 0);
    assert.equal(fig.discount, 0);
    assert.equal(fig.tax, 0);
    assert.equal(fig.cgst, 0);
    assert.equal(fig.sgst, 0);
    assert.equal(fig.total, 0);
    assert.deepEqual(fig.rows, []);
  });

  it('uses explicit gstRate when provided on an item', () => {
    const order = {
      id: 9002,
      items: [
        { id: 1, sku: 'GRN-001', name: 'Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1, gstRate: 5 }
      ],
      coupon: ''
    };
    const fig = invoice.computeInvoiceFigures(order);

    assert.equal(fig.subtotal, 640);
    assert.equal(fig.discount, 0);
    assert.equal(fig.tax, 32);
    assert.equal(fig.cgst, 16);
    assert.equal(fig.sgst, 16);
    assert.equal(fig.total, 672);
    assert.equal(fig.rows[0].gstPercent, 5);
    assert.equal(fig.rows[0].lineTax, 32);
  });

  it('resolves HSN slab GST rates when gstRate is absent', () => {
    const order = {
      id: 1001,
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
        { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
      ],
      coupon: '',
      total: 676.9
    };
    const fig = invoice.computeInvoiceFigures(order);

    assert.equal(fig.subtotal, 610);
    assert.equal(fig.rows[0].gstPercent, 18);
    assert.equal(fig.rows[1].gstPercent, 5);
    assert.equal(fig.tax, 66.9);
    assert.equal(fig.total, 676.9);
  });

  it('applies percent coupon on pre-tax subtotal and computes HSN-slab GST on post-discount value', () => {
    const order = {
      id: 1002,
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: 'SAVE10',
      total: 963.9
    };
    const fig = invoice.computeInvoiceFigures(order);

    assert.equal(fig.subtotal, 1020);
    assert.equal(fig.discount, 102);
    assert.equal(fig.tax, 45.9);
    assert.equal(fig.total, 963.9);
  });

  it('enforces maxDiscount cap on percent coupons', () => {
    const order = {
      id: 1004,
      items: [
        { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
      ],
      coupon: 'SAVE10',
      total: 2194.5
    };
    const fig = invoice.computeInvoiceFigures(order);

    assert.equal(fig.subtotal, 2240);
    assert.equal(fig.discount, 150);
    assert.equal(fig.tax, 104.5);
    assert.equal(fig.total, 2194.5);
  });

  it('apportions flat coupon discount before computing HSN-slab GST', () => {
    const order = {
      id: 1003,
      items: [
        { id: 7, sku: 'DRY-002', name: 'Pasteurized Table Butter 500g', hsn: '0405', price: 260, qty: 1 },
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 }
      ],
      coupon: 'FLAT50',
      total: 399.35
    };
    const fig = invoice.computeInvoiceFigures(order);

    assert.equal(fig.subtotal, 400);
    assert.equal(fig.discount, 50);
    assert.equal(fig.tax, 49.35);
    assert.equal(fig.total, 399.35);
  });

  it('ignores inactive or below-minOrder coupons', () => {
    const inactiveOrder = {
      id: 9003,
      items: [{ id: 8, sku: 'BEV-001', name: 'Chai', hsn: '0902', price: 140, qty: 10 }],
      coupon: 'DIWALI20'
    };
    const figInactive = invoice.computeInvoiceFigures(inactiveOrder);
    assert.equal(figInactive.discount, 0);

    const belowMinOrder = {
      id: 9004,
      items: [{ id: 8, sku: 'BEV-001', name: 'Chai', hsn: '0902', price: 140, qty: 1 }],
      coupon: 'SAVE10'
    };
    const figBelowMin = invoice.computeInvoiceFigures(belowMinOrder);
    assert.equal(figBelowMin.discount, 0);
  });

  it('renders HTML invoice without reconciliation warning when totals match, and with warning when they differ', () => {
    const order = {
      id: 1002,
      date: '05/01/2022',
      customer: 'Anil Kulkarni',
      paymentMode: 'upi',
      status: 'completed',
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 }
      ],
      coupon: 'SAVE10',
      total: 604.8
    };
    const matchingHtml = invoice.render(order);

    assert.match(matchingHtml, /INV-1002/);
    assert.match(matchingHtml, /Anil Kulkarni/);
    assert.doesNotMatch(matchingHtml, /Accountant Reconciliation Notice/);

    const mismatchedHtml = invoice.render({ ...order, total: 500 });
    assert.match(mismatchedHtml, /Accountant Reconciliation Notice/);
  });

  it('CORRECT BEHAVIOUR: matches checkout totals using HSN slabs, pre-tax coupon discount, and maxDiscount cap', () => {
    const order1001 = {
      id: 1001,
      items: [
        { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
        { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
      ],
      coupon: ''
    };
    const fig1001 = invoice.computeInvoiceFigures(order1001);
    assert.equal(fig1001.tax, 66.9);
    assert.equal(fig1001.total, 676.9);

    const order1002 = {
      id: 1002,
      items: [
        { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
        { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
      ],
      coupon: 'SAVE10'
    };
    const fig1002 = invoice.computeInvoiceFigures(order1002);
    assert.equal(fig1002.discount, 102);
    assert.equal(fig1002.tax, 45.9);
    assert.equal(fig1002.total, 963.9);

    const order1004 = {
      id: 1004,
      items: [
        { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
      ],
      coupon: 'SAVE10'
    };
    const fig1004 = invoice.computeInvoiceFigures(order1004);
    assert.equal(fig1004.discount, 150);
    assert.equal(fig1004.tax, 104.5);
    assert.equal(fig1004.total, 2194.5);
  });
});

