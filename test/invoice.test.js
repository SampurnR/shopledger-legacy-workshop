const { test, describe } = require('node:test');
const assert = require('node:assert');
const invoice = require('../lib/invoice');

describe('Invoice Module - Fixed Correct Behaviour Suite (104 Tests)', () => {
  describe('Suite 1: Historical Orders (#1001 - #1008) - Correct Reconciliation', () => {
    test('Order #1001 (Meera Joshi) verified against ledger figures', () => {
      const order = {"id":1001,"customer":"Meera Joshi","coupon":"","items":[{"id":8,"sku":"BEV-001","name":"Assam CTC Masala Chai 250g","hsn":"0902","price":140,"qty":2},{"id":2,"sku":"GRN-002","name":"Unpolished Toor Dal 1kg","hsn":"0713","price":165,"qty":2}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 610);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 66.9);
      assert.strictEqual(res.total, 676.9);
      assert.strictEqual(res.rows.length, 2);
    });
    test('Order #1002 (Anil Kulkarni) verified against ledger figures', () => {
      const order = {"id":1002,"customer":"Anil Kulkarni","coupon":"SAVE10","items":[{"id":1,"sku":"GRN-001","name":"Indrayani Basmati Rice 5kg","hsn":"1006","price":640,"qty":1},{"id":4,"sku":"OIL-001","name":"Cold-Pressed Sunflower Oil 1L","hsn":"1512","price":190,"qty":2}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1020);
      assert.strictEqual(res.discount, 102);
      assert.strictEqual(res.tax, 45.9);
      assert.strictEqual(res.total, 963.9);
      assert.strictEqual(res.rows.length, 2);
    });
    test('Order #1003 (Walk-in) verified against ledger figures', () => {
      const order = {"id":1003,"customer":"Walk-in","coupon":"FLAT50","items":[{"id":7,"sku":"DRY-002","name":"Pasteurized Table Butter 500g","hsn":"0405","price":260,"qty":1},{"id":8,"sku":"BEV-001","name":"Assam CTC Masala Chai 250g","hsn":"0902","price":140,"qty":1}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 400);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 49.35);
      assert.strictEqual(res.total, 399.35);
      assert.strictEqual(res.rows.length, 2);
    });
    test('Order #1004 (Kalyani Foods (Wholesale)) verified against ledger figures', () => {
      const order = {"id":1004,"customer":"Kalyani Foods (Wholesale)","coupon":"SAVE10","items":[{"id":5,"sku":"OIL-002","name":"Cold-Pressed Groundnut Oil 5L","hsn":"1508","price":1120,"qty":2}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 2240);
      assert.strictEqual(res.discount, 150);
      assert.strictEqual(res.tax, 104.5);
      assert.strictEqual(res.total, 2194.5);
      assert.strictEqual(res.rows.length, 1);
    });
    test('Order #1005 (Priya Nair) verified against ledger figures', () => {
      const order = {"id":1005,"customer":"Priya Nair","coupon":"FLAT50","items":[{"id":1,"sku":"GRN-001","name":"Indrayani Basmati Rice 5kg","hsn":"1006","price":640,"qty":1},{"id":12,"sku":"BEV-003","name":"Kokum Sherbet Concentrate 750ml","hsn":"2106","price":180,"qty":2}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1000);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 91.96);
      assert.strictEqual(res.total, 1041.96);
      assert.strictEqual(res.rows.length, 2);
    });
    test('Order #1006 (Meera Joshi) verified against ledger figures', () => {
      const order = {"id":1006,"customer":"Meera Joshi","coupon":"WELCOME","items":[{"id":6,"sku":"DRY-001","name":"A2 Gir Cow Ghee 500ml","hsn":"0405","price":450,"qty":2},{"id":9,"sku":"BEV-002","name":"Filter Coffee Decoction Blend 500g","hsn":"0901","price":310,"qty":1}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1210);
      assert.strictEqual(res.discount, 60.5);
      assert.strictEqual(res.tax, 155.61);
      assert.strictEqual(res.total, 1305.11);
      assert.strictEqual(res.rows.length, 2);
    });
    test('Order #1007 (Suresh Deshmukh) verified against ledger figures', () => {
      const order = {"id":1007,"customer":"Suresh Deshmukh","coupon":"","items":[{"id":6,"sku":"DRY-001","name":"A2 Gir Cow Ghee 500ml","hsn":"0405","price":450,"qty":2},{"id":4,"sku":"OIL-001","name":"Cold-Pressed Sunflower Oil 1L","hsn":"1512","price":190,"qty":2}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1280);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 127);
      assert.strictEqual(res.total, 1407);
      assert.strictEqual(res.rows.length, 2);
    });
    test('Order #1008 (Walk-in) verified against ledger figures', () => {
      const order = {"id":1008,"customer":"Walk-in","coupon":"","items":[{"id":8,"sku":"BEV-001","name":"Assam CTC Masala Chai 250g","hsn":"0902","price":140,"qty":1},{"id":12,"sku":"BEV-003","name":"Kokum Sherbet Concentrate 750ml","hsn":"2106","price":180,"qty":2}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 500);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 90);
      assert.strictEqual(res.total, 590);
      assert.strictEqual(res.rows.length, 2);
    });
  });

  describe('Suite 2: 12-Product Catalog x 4 Coupon States (48 Tests)', () => {
    test('Correct rate: Product GRN-001 (Indrayani Basmati Rice 5kg) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":1,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 640);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 32);
      assert.strictEqual(res.total, 672);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-001 (Indrayani Basmati Rice 5kg) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":1,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 640);
      assert.strictEqual(res.discount, 64);
      assert.strictEqual(res.tax, 28.8);
      assert.strictEqual(res.total, 604.8);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-001 (Indrayani Basmati Rice 5kg) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":1,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 640);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 29.5);
      assert.strictEqual(res.total, 619.5);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-001 (Indrayani Basmati Rice 5kg) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":1,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 640);
      assert.strictEqual(res.discount, 32);
      assert.strictEqual(res.tax, 30.4);
      assert.strictEqual(res.total, 638.4);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-002 (Unpolished Toor Dal 1kg) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":1,"price":165}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 165);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 8.25);
      assert.strictEqual(res.total, 173.25);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-002 (Unpolished Toor Dal 1kg) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":1,"price":165}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 165);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 8.25);
      assert.strictEqual(res.total, 173.25);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-002 (Unpolished Toor Dal 1kg) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":1,"price":165}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 165);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 8.25);
      assert.strictEqual(res.total, 173.25);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-002 (Unpolished Toor Dal 1kg) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":1,"price":165}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 165);
      assert.strictEqual(res.discount, 8.25);
      assert.strictEqual(res.tax, 7.84);
      assert.strictEqual(res.total, 164.59);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-003 (Kolhapuri Thick Poha 500g) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":1,"price":48}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 48);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 2.4);
      assert.strictEqual(res.total, 50.4);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-003 (Kolhapuri Thick Poha 500g) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":1,"price":48}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 48);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 2.4);
      assert.strictEqual(res.total, 50.4);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-003 (Kolhapuri Thick Poha 500g) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":1,"price":48}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 48);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 2.4);
      assert.strictEqual(res.total, 50.4);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-003 (Kolhapuri Thick Poha 500g) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":1,"price":48}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 48);
      assert.strictEqual(res.discount, 2.4);
      assert.strictEqual(res.tax, 2.28);
      assert.strictEqual(res.total, 47.88);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-001 (Cold-Pressed Sunflower Oil 1L) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":1,"price":190}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 190);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 9.5);
      assert.strictEqual(res.total, 199.5);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-001 (Cold-Pressed Sunflower Oil 1L) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":1,"price":190}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 190);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 9.5);
      assert.strictEqual(res.total, 199.5);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-001 (Cold-Pressed Sunflower Oil 1L) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":1,"price":190}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 190);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 9.5);
      assert.strictEqual(res.total, 199.5);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-001 (Cold-Pressed Sunflower Oil 1L) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":1,"price":190}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 190);
      assert.strictEqual(res.discount, 9.5);
      assert.strictEqual(res.tax, 9.03);
      assert.strictEqual(res.total, 189.53);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-002 (Cold-Pressed Groundnut Oil 5L) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":1,"price":1120}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1120);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 56);
      assert.strictEqual(res.total, 1176);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-002 (Cold-Pressed Groundnut Oil 5L) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":1,"price":1120}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1120);
      assert.strictEqual(res.discount, 112);
      assert.strictEqual(res.tax, 50.4);
      assert.strictEqual(res.total, 1058.4);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-002 (Cold-Pressed Groundnut Oil 5L) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":1,"price":1120}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1120);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 53.5);
      assert.strictEqual(res.total, 1123.5);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product OIL-002 (Cold-Pressed Groundnut Oil 5L) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":1,"price":1120}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1120);
      assert.strictEqual(res.discount, 56);
      assert.strictEqual(res.tax, 53.2);
      assert.strictEqual(res.total, 1117.2);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product DRY-001 (A2 Gir Cow Ghee 500ml) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":1,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 450);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 54);
      assert.strictEqual(res.total, 504);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-001 (A2 Gir Cow Ghee 500ml) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":1,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 450);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 54);
      assert.strictEqual(res.total, 504);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-001 (A2 Gir Cow Ghee 500ml) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":1,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 450);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 48);
      assert.strictEqual(res.total, 448);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-001 (A2 Gir Cow Ghee 500ml) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":1,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 450);
      assert.strictEqual(res.discount, 22.5);
      assert.strictEqual(res.tax, 51.3);
      assert.strictEqual(res.total, 478.8);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-002 (Pasteurized Table Butter 500g) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":1,"price":260}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 260);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 31.2);
      assert.strictEqual(res.total, 291.2);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-002 (Pasteurized Table Butter 500g) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":1,"price":260}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 260);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 31.2);
      assert.strictEqual(res.total, 291.2);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-002 (Pasteurized Table Butter 500g) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":1,"price":260}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 260);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 31.2);
      assert.strictEqual(res.total, 291.2);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product DRY-002 (Pasteurized Table Butter 500g) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":1,"price":260}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 260);
      assert.strictEqual(res.discount, 13);
      assert.strictEqual(res.tax, 29.64);
      assert.strictEqual(res.total, 276.64);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product BEV-001 (Assam CTC Masala Chai 250g) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-001 (Assam CTC Masala Chai 250g) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-001 (Assam CTC Masala Chai 250g) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-001 (Assam CTC Masala Chai 250g) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 7);
      assert.strictEqual(res.tax, 23.94);
      assert.strictEqual(res.total, 156.94);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-002 (Filter Coffee Decoction Blend 500g) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Filter Coffee Decoction Blend 500g","sku":"BEV-002","hsn":"0901","qty":1,"price":310}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 310);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 55.8);
      assert.strictEqual(res.total, 365.8);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-002 (Filter Coffee Decoction Blend 500g) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Filter Coffee Decoction Blend 500g","sku":"BEV-002","hsn":"0901","qty":1,"price":310}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 310);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 55.8);
      assert.strictEqual(res.total, 365.8);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-002 (Filter Coffee Decoction Blend 500g) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Filter Coffee Decoction Blend 500g","sku":"BEV-002","hsn":"0901","qty":1,"price":310}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 310);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 46.8);
      assert.strictEqual(res.total, 306.8);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-002 (Filter Coffee Decoction Blend 500g) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Filter Coffee Decoction Blend 500g","sku":"BEV-002","hsn":"0901","qty":1,"price":310}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 310);
      assert.strictEqual(res.discount, 15.5);
      assert.strictEqual(res.tax, 53.01);
      assert.strictEqual(res.total, 347.51);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product GRN-004 (Organic Kolhapuri Jaggery 1kg) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Organic Kolhapuri Jaggery 1kg","sku":"GRN-004","hsn":"1701","qty":1,"price":85}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 85);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 4.25);
      assert.strictEqual(res.total, 89.25);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-004 (Organic Kolhapuri Jaggery 1kg) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Organic Kolhapuri Jaggery 1kg","sku":"GRN-004","hsn":"1701","qty":1,"price":85}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 85);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 4.25);
      assert.strictEqual(res.total, 89.25);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-004 (Organic Kolhapuri Jaggery 1kg) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Organic Kolhapuri Jaggery 1kg","sku":"GRN-004","hsn":"1701","qty":1,"price":85}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 85);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 4.25);
      assert.strictEqual(res.total, 89.25);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product GRN-004 (Organic Kolhapuri Jaggery 1kg) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Organic Kolhapuri Jaggery 1kg","sku":"GRN-004","hsn":"1701","qty":1,"price":85}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 85);
      assert.strictEqual(res.discount, 4.25);
      assert.strictEqual(res.tax, 4.04);
      assert.strictEqual(res.total, 84.79);
      assert.strictEqual(res.rows[0].gstPercent, 5);
    });
    test('Correct rate: Product SPC-001 (Byadgi Kashmiri Chilli Powder 500g) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Byadgi Kashmiri Chilli Powder 500g","sku":"SPC-001","hsn":"0904","qty":1,"price":220}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 220);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 26.4);
      assert.strictEqual(res.total, 246.4);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product SPC-001 (Byadgi Kashmiri Chilli Powder 500g) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Byadgi Kashmiri Chilli Powder 500g","sku":"SPC-001","hsn":"0904","qty":1,"price":220}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 220);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 26.4);
      assert.strictEqual(res.total, 246.4);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product SPC-001 (Byadgi Kashmiri Chilli Powder 500g) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Byadgi Kashmiri Chilli Powder 500g","sku":"SPC-001","hsn":"0904","qty":1,"price":220}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 220);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 26.4);
      assert.strictEqual(res.total, 246.4);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product SPC-001 (Byadgi Kashmiri Chilli Powder 500g) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Byadgi Kashmiri Chilli Powder 500g","sku":"SPC-001","hsn":"0904","qty":1,"price":220}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 220);
      assert.strictEqual(res.discount, 11);
      assert.strictEqual(res.tax, 25.08);
      assert.strictEqual(res.total, 234.08);
      assert.strictEqual(res.rows[0].gstPercent, 12);
    });
    test('Correct rate: Product BEV-003 (Kokum Sherbet Concentrate 750ml) with coupon NO_COUPON', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"","items":[{"name":"Kokum Sherbet Concentrate 750ml","sku":"BEV-003","hsn":"2106","qty":1,"price":180}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 180);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 32.4);
      assert.strictEqual(res.total, 212.4);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-003 (Kokum Sherbet Concentrate 750ml) with coupon SAVE10', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"SAVE10","items":[{"name":"Kokum Sherbet Concentrate 750ml","sku":"BEV-003","hsn":"2106","qty":1,"price":180}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 180);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 32.4);
      assert.strictEqual(res.total, 212.4);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-003 (Kokum Sherbet Concentrate 750ml) with coupon FLAT50', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"FLAT50","items":[{"name":"Kokum Sherbet Concentrate 750ml","sku":"BEV-003","hsn":"2106","qty":1,"price":180}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 180);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 32.4);
      assert.strictEqual(res.total, 212.4);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
    test('Correct rate: Product BEV-003 (Kokum Sherbet Concentrate 750ml) with coupon WELCOME', () => {
      const order = {"id":9000,"customer":"Test Customer","coupon":"WELCOME","items":[{"name":"Kokum Sherbet Concentrate 750ml","sku":"BEV-003","hsn":"2106","qty":1,"price":180}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 180);
      assert.strictEqual(res.discount, 9);
      assert.strictEqual(res.tax, 30.78);
      assert.strictEqual(res.total, 201.78);
      assert.strictEqual(res.rows[0].gstPercent, 18);
    });
  });

  describe('Suite 3: Quantity Scaling Tests (12 Tests)', () => {
    test('Verified scaling: SKU GRN-001 scaled to quantity 1', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":1,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 640);
      assert.strictEqual(res.tax, 32);
      assert.strictEqual(res.total, 672);
    });
    test('Verified scaling: SKU DRY-001 scaled to quantity 1', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":1,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 450);
      assert.strictEqual(res.tax, 54);
      assert.strictEqual(res.total, 504);
    });
    test('Verified scaling: SKU BEV-001 scaled to quantity 1', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
    });
    test('Verified scaling: SKU GRN-001 scaled to quantity 2', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":2,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1280);
      assert.strictEqual(res.tax, 64);
      assert.strictEqual(res.total, 1344);
    });
    test('Verified scaling: SKU DRY-001 scaled to quantity 2', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":2,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 900);
      assert.strictEqual(res.tax, 108);
      assert.strictEqual(res.total, 1008);
    });
    test('Verified scaling: SKU BEV-001 scaled to quantity 2', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":2,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 280);
      assert.strictEqual(res.tax, 50.4);
      assert.strictEqual(res.total, 330.4);
    });
    test('Verified scaling: SKU GRN-001 scaled to quantity 5', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":5,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 3200);
      assert.strictEqual(res.tax, 160);
      assert.strictEqual(res.total, 3360);
    });
    test('Verified scaling: SKU DRY-001 scaled to quantity 5', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":5,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 2250);
      assert.strictEqual(res.tax, 270);
      assert.strictEqual(res.total, 2520);
    });
    test('Verified scaling: SKU BEV-001 scaled to quantity 5', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":5,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 700);
      assert.strictEqual(res.tax, 126);
      assert.strictEqual(res.total, 826);
    });
    test('Verified scaling: SKU GRN-001 scaled to quantity 10', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":10,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 6400);
      assert.strictEqual(res.tax, 320);
      assert.strictEqual(res.total, 6720);
    });
    test('Verified scaling: SKU DRY-001 scaled to quantity 10', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":10,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 4500);
      assert.strictEqual(res.tax, 540);
      assert.strictEqual(res.total, 5040);
    });
    test('Verified scaling: SKU BEV-001 scaled to quantity 10', () => {
      const order = {"id":9100,"customer":"Wholesale Test","coupon":"","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":10,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1400);
      assert.strictEqual(res.tax, 252);
      assert.strictEqual(res.total, 1652);
    });
  });

  describe('Suite 4: Cross-Slab Multi-Item Bundles (16 Tests)', () => {
    test('Verified: Mixed Bundle #1 (GRN-002 + OIL-002)', () => {
      const order = {"id":9201,"customer":"Bundle Test","coupon":"","items":[{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":1,"price":165},{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":2,"price":1120}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 2405);
      assert.strictEqual(res.tax, 120.25);
      assert.strictEqual(res.total, 2525.25);
    });
    test('Verified: Mixed Bundle #2 (GRN-003 + DRY-001)', () => {
      const order = {"id":9202,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":1,"price":48},{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":2,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 948);
      assert.strictEqual(res.tax, 99.36);
      assert.strictEqual(res.total, 952.56);
    });
    test('Verified: Mixed Bundle #3 (OIL-001 + DRY-002)', () => {
      const order = {"id":9203,"customer":"Bundle Test","coupon":"","items":[{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":1,"price":190},{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":2,"price":260}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 710);
      assert.strictEqual(res.tax, 71.9);
      assert.strictEqual(res.total, 781.9);
    });
    test('Verified: Mixed Bundle #4 (OIL-002 + BEV-001)', () => {
      const order = {"id":9204,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":1,"price":1120},{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":2,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1400);
      assert.strictEqual(res.tax, 95.76);
      assert.strictEqual(res.total, 1355.76);
    });
    test('Verified: Mixed Bundle #5 (DRY-001 + BEV-002)', () => {
      const order = {"id":9205,"customer":"Bundle Test","coupon":"","items":[{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":1,"price":450},{"name":"Filter Coffee Decoction Blend 500g","sku":"BEV-002","hsn":"0901","qty":2,"price":310}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1070);
      assert.strictEqual(res.tax, 165.6);
      assert.strictEqual(res.total, 1235.6);
    });
    test('Verified: Mixed Bundle #6 (DRY-002 + GRN-004)', () => {
      const order = {"id":9206,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":1,"price":260},{"name":"Organic Kolhapuri Jaggery 1kg","sku":"GRN-004","hsn":"1701","qty":2,"price":85}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 430);
      assert.strictEqual(res.tax, 39.7);
      assert.strictEqual(res.total, 469.7);
    });
    test('Verified: Mixed Bundle #7 (BEV-001 + SPC-001)', () => {
      const order = {"id":9207,"customer":"Bundle Test","coupon":"","items":[{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":1,"price":140},{"name":"Byadgi Kashmiri Chilli Powder 500g","sku":"SPC-001","hsn":"0904","qty":2,"price":220}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 580);
      assert.strictEqual(res.tax, 78);
      assert.strictEqual(res.total, 658);
    });
    test('Verified: Mixed Bundle #8 (BEV-002 + BEV-003)', () => {
      const order = {"id":9208,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Filter Coffee Decoction Blend 500g","sku":"BEV-002","hsn":"0901","qty":1,"price":310},{"name":"Kokum Sherbet Concentrate 750ml","sku":"BEV-003","hsn":"2106","qty":2,"price":180}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 670);
      assert.strictEqual(res.tax, 108.54);
      assert.strictEqual(res.total, 711.54);
    });
    test('Verified: Mixed Bundle #9 (GRN-004 + GRN-001)', () => {
      const order = {"id":9209,"customer":"Bundle Test","coupon":"","items":[{"name":"Organic Kolhapuri Jaggery 1kg","sku":"GRN-004","hsn":"1701","qty":1,"price":85},{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":2,"price":640}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1365);
      assert.strictEqual(res.tax, 68.25);
      assert.strictEqual(res.total, 1433.25);
    });
    test('Verified: Mixed Bundle #10 (SPC-001 + GRN-002)', () => {
      const order = {"id":9210,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Byadgi Kashmiri Chilli Powder 500g","sku":"SPC-001","hsn":"0904","qty":1,"price":220},{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":2,"price":165}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 550);
      assert.strictEqual(res.tax, 38.61);
      assert.strictEqual(res.total, 533.61);
    });
    test('Verified: Mixed Bundle #11 (BEV-003 + GRN-003)', () => {
      const order = {"id":9211,"customer":"Bundle Test","coupon":"","items":[{"name":"Kokum Sherbet Concentrate 750ml","sku":"BEV-003","hsn":"2106","qty":1,"price":180},{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":2,"price":48}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 276);
      assert.strictEqual(res.tax, 37.2);
      assert.strictEqual(res.total, 313.2);
    });
    test('Verified: Mixed Bundle #12 (GRN-001 + OIL-001)', () => {
      const order = {"id":9212,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Indrayani Basmati Rice 5kg","sku":"GRN-001","hsn":"1006","qty":1,"price":640},{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":2,"price":190}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1020);
      assert.strictEqual(res.tax, 45.9);
      assert.strictEqual(res.total, 963.9);
    });
    test('Verified: Mixed Bundle #13 (GRN-002 + OIL-002)', () => {
      const order = {"id":9213,"customer":"Bundle Test","coupon":"","items":[{"name":"Unpolished Toor Dal 1kg","sku":"GRN-002","hsn":"0713","qty":1,"price":165},{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":2,"price":1120}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 2405);
      assert.strictEqual(res.tax, 120.25);
      assert.strictEqual(res.total, 2525.25);
    });
    test('Verified: Mixed Bundle #14 (GRN-003 + DRY-001)', () => {
      const order = {"id":9214,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Kolhapuri Thick Poha 500g","sku":"GRN-003","hsn":"1104","qty":1,"price":48},{"name":"A2 Gir Cow Ghee 500ml","sku":"DRY-001","hsn":"0405","qty":2,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 948);
      assert.strictEqual(res.tax, 99.36);
      assert.strictEqual(res.total, 952.56);
    });
    test('Verified: Mixed Bundle #15 (OIL-001 + DRY-002)', () => {
      const order = {"id":9215,"customer":"Bundle Test","coupon":"","items":[{"name":"Cold-Pressed Sunflower Oil 1L","sku":"OIL-001","hsn":"1512","qty":1,"price":190},{"name":"Pasteurized Table Butter 500g","sku":"DRY-002","hsn":"0405","qty":2,"price":260}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 710);
      assert.strictEqual(res.tax, 71.9);
      assert.strictEqual(res.total, 781.9);
    });
    test('Verified: Mixed Bundle #16 (OIL-002 + BEV-001)', () => {
      const order = {"id":9216,"customer":"Bundle Test","coupon":"SAVE10","items":[{"name":"Cold-Pressed Groundnut Oil 5L","sku":"OIL-002","hsn":"1508","qty":1,"price":1120},{"name":"Assam CTC Masala Chai 250g","sku":"BEV-001","hsn":"0902","qty":2,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1400);
      assert.strictEqual(res.tax, 95.76);
      assert.strictEqual(res.total, 1355.76);
    });
  });

  describe('Suite 5: Coupon Cap & Threshold Behaviours (10 Tests)', () => {
    test('Order exceeding SAVE10 maxDiscount of 150 respects cap', () => {
      const order = {"id":9301,"customer":"A","coupon":"SAVE10","items":[{"name":"Ghee","sku":"DRY-001","hsn":"0405","qty":10,"price":450}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 4500);
      assert.strictEqual(res.discount, 150);
      assert.strictEqual(res.tax, 522);
      assert.strictEqual(res.total, 4872);
    });
    test('Order at exact 1500 subtotal with SAVE10', () => {
      const order = {"id":9302,"customer":"B","coupon":"SAVE10","items":[{"name":"Oil","sku":"OIL-002","hsn":"1508","qty":1,"price":1500}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 1500);
      assert.strictEqual(res.discount, 150);
      assert.strictEqual(res.tax, 67.5);
      assert.strictEqual(res.total, 1417.5);
    });
    test('Order below FLAT50 minOrder of 300 gives 0 discount', () => {
      const order = {"id":9303,"customer":"C","coupon":"FLAT50","items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
    });
    test('Order exactly at FLAT50 minOrder threshold', () => {
      const order = {"id":9304,"customer":"D","coupon":"FLAT50","items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":2,"price":150}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 300);
      assert.strictEqual(res.discount, 50);
      assert.strictEqual(res.tax, 45);
      assert.strictEqual(res.total, 295);
    });
    test('WELCOME 5% coupon with zero minimum order', () => {
      const order = {"id":9305,"customer":"E","coupon":"WELCOME","items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":1,"price":100}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 100);
      assert.strictEqual(res.discount, 5);
      assert.strictEqual(res.tax, 17.1);
      assert.strictEqual(res.total, 112.1);
    });
    test('Non-existent coupon code INVALID_CODE gives 0 discount', () => {
      const order = {"id":9306,"customer":"F","coupon":"INVALID_CODE","items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
    });
    test('Empty coupon string gives 0 discount', () => {
      const order = {"id":9307,"customer":"G","coupon":"","items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
    });
    test('Null coupon property gives 0 discount', () => {
      const order = {"id":9308,"customer":"H","coupon":null,"items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
    });
    test('Whitespace-only coupon property gives 0 discount', () => {
      const order = {"id":9309,"customer":"I","coupon":"   ","items":[{"name":"Chai","sku":"BEV-001","hsn":"0902","qty":1,"price":140}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 140);
      assert.strictEqual(res.discount, 0);
      assert.strictEqual(res.tax, 25.2);
      assert.strictEqual(res.total, 165.2);
    });
    test('Very large wholesale order with SAVE10 strictly capped at 150', () => {
      const order = {"id":9310,"customer":"J","coupon":"SAVE10","items":[{"name":"Oil","sku":"OIL-002","hsn":"1508","qty":50,"price":1000}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(res.subtotal, 50000);
      assert.strictEqual(res.discount, 150);
      assert.strictEqual(res.tax, 2492.5);
      assert.strictEqual(res.total, 52342.5);
    });
  });

  describe('Suite 6: CGST & SGST Split and Rounding Symmetry (10 Tests)', () => {
    test('Tax split precision for item price 17.33 x 1', () => {
      const order = {"id":9401,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-1","hsn":"0902","qty":1,"price":17.33}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 34.66 x 2', () => {
      const order = {"id":9402,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-2","hsn":"0902","qty":2,"price":34.66}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 51.99 x 3', () => {
      const order = {"id":9403,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-3","hsn":"0902","qty":3,"price":51.989999999999995}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 69.32 x 4', () => {
      const order = {"id":9404,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-4","hsn":"0902","qty":4,"price":69.32}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 86.65 x 5', () => {
      const order = {"id":9405,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-5","hsn":"0902","qty":5,"price":86.64999999999999}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 103.98 x 6', () => {
      const order = {"id":9406,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-6","hsn":"0902","qty":6,"price":103.97999999999999}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 121.31 x 7', () => {
      const order = {"id":9407,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-7","hsn":"0902","qty":7,"price":121.30999999999999}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 138.64 x 8', () => {
      const order = {"id":9408,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-8","hsn":"0902","qty":8,"price":138.64}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 155.97 x 9', () => {
      const order = {"id":9409,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-9","hsn":"0902","qty":9,"price":155.96999999999997}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
    test('Tax split precision for item price 173.30 x 10', () => {
      const order = {"id":9410,"customer":"Rounding Test","coupon":"","items":[{"name":"Odd Price Item","sku":"ODD-10","hsn":"0902","qty":10,"price":173.29999999999998}]};
      const res = invoice.computeInvoiceFigures(order);
      assert.strictEqual(Math.round((res.cgst + res.sgst) * 100) / 100, res.tax);
      assert.strictEqual(res.total, Math.round((res.subtotal + res.tax - res.discount) * 100) / 100);
    });
  });

});
