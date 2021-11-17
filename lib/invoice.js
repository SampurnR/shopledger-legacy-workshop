var config = require('../config');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

// added for the accountant, 2021-11 (Neha)
exports.computeInvoiceFigures = function (order) {
  var sub = 0;
  var tax = 0;
  var lineRows = [];

  (order.items || []).forEach(function (it) {
    var line = it.price * it.qty;
    var rate = it.gstRate ? (it.gstRate / 100) : config.tax.defaultRate;
    var lineTax = line * rate;
    sub += line;
    tax += lineTax;

    lineRows.push({
      name: it.name,
      sku: it.sku || '-',
      hsn: it.hsn || '-',
      qty: it.qty,
      price: it.price,
      gstPercent: Math.round(rate * 100),
      line: round2(line),
      lineTax: round2(lineTax)
    });
  });

  var disc = 0;
  var c = config.coupons[order.coupon];
  if (c) {
    if (c.type === 'percent') disc = (sub + tax) * c.value / 100;
    else disc = c.value;
  }

  var total = sub + tax - disc;

  return {
    subtotal: round2(sub),
    discount: round2(disc),
    tax: round2(tax),
    cgst: round2(tax / 2),
    sgst: round2(tax - round2(tax / 2)),
    total: round2(total),
    rows: lineRows
  };
};

exports.render = function (order) {
  var calc = exports.computeInvoiceFigures(order);
  var rowsHtml = '';

  calc.rows.forEach(function (r, idx) {
    rowsHtml += '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td><strong>' + esc(r.name) + '</strong><div style="font-size:11px;color:#64748b">SKU: ' + esc(r.sku) + '</div></td>' +
      '<td>' + esc(r.hsn) + '</td>' +
      '<td class="r">' + r.qty + '</td>' +
      '<td class="r">₹' + r.price.toFixed(2) + '</td>' +
      '<td class="r">' + r.gstPercent + '%</td>' +
      '<td class="r">₹' + r.lineTax.toFixed(2) + '</td>' +
      '<td class="r"><strong>₹' + r.line.toFixed(2) + '</strong></td>' +
      '</tr>';
  });

  var ledgerDiff = round2(calc.total - Number(order.total || 0));
  var mismatchBanner = '';
  if (Math.abs(ledgerDiff) >= 0.01) {
    mismatchBanner = '<div class="warn-box">' +
      '<strong>Accountant Reconciliation Notice:</strong> Invoice computed total (₹' + calc.total.toFixed(2) + ') ' +
      'differs from Order Ledger recorded total (₹' + Number(order.total).toFixed(2) + ') by ' +
      (ledgerDiff > 0 ? '+₹' : '-₹') + Math.abs(ledgerDiff).toFixed(2) + '.' +
      '</div>';
  }

  return '<!doctype html><html><head><meta charset="utf-8">' +
    '<title>Tax Invoice #' + order.id + ' - ' + esc(config.shop.name) + '</title>' +
    '<style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:32px 16px}' +
    '.sheet{max-width:780px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:32px;box-shadow:0 4px 12px rgba(15,23,42,0.06)}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:18px;margin-bottom:20px}' +
    '.shop-title{font-size:22px;font-weight:700;margin:0 0 4px 0;color:#0f172a}' +
    '.meta{font-size:13px;color:#475569;line-height:1.5}' +
    '.badge{display:inline-block;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;background:#e2e8f0;color:#1e293b}' +
    '.info-grid{display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 18px;margin-bottom:20px;font-size:13px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px}' +
    'th{background:#f1f5f9;color:#334155;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:0.03em;padding:10px 8px;border-bottom:2px solid #cbd5e1;text-align:left}' +
    'td{padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}' +
    '.r{text-align:right}' +
    '.totals-wrap{display:flex;justify-content:flex-end}' +
    '.totals-table{width:320px;font-size:13px}' +
    '.totals-table td{padding:6px 8px;border-bottom:1px solid #f1f5f9}' +
    '.totals-table tr.grand td{font-size:16px;font-weight:700;border-top:2px solid #0f172a;border-bottom:none;padding-top:10px}' +
    '.warn-box{margin-top:20px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;color:#991b1b;font-size:13px;border-radius:4px}' +
    '.actions{margin-top:24px;padding-top:16px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#64748b}' +
    '.btn-print{background:#0f172a;color:#fff;border:none;padding:8px 16px;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600}' +
    '@media print{body{background:#fff;padding:0}.sheet{border:none;box-shadow:none;padding:0}.btn-print{display:none}}' +
    '</style></head><body>' +
    '<div class="sheet">' +
    '<div class="hdr">' +
    '<div><h1 class="shop-title">' + esc(config.shop.name) + '</h1>' +
    '<div class="meta">' + esc(config.shop.address) + '<br>Phone: ' + esc(config.shop.phone) + '<br><strong>GSTIN: ' + esc(config.shop.gstin) + '</strong> &middot; State: ' + esc(config.shop.stateCode) + '</div></div>' +
    '<div style="text-align:right"><span class="badge">Tax Invoice</span>' +
    '<h2 style="margin:8px 0 2px 0;font-size:18px">INV-' + order.id + '</h2>' +
    '<div class="meta">Date: ' + esc(order.date) + '<br>Status: ' + esc((order.status || 'completed').toUpperCase()) + '</div></div>' +
    '</div>' +
    '<div class="info-grid">' +
    '<div><strong>Billed To:</strong><br>' + esc(order.customer || 'Walk-in Customer') + '</div>' +
    '<div><strong>Payment Mode:</strong><br>' + esc((order.paymentMode || 'cash').toUpperCase()) + '</div>' +
    '<div><strong>Promo Applied:</strong><br>' + (order.coupon ? esc(order.coupon) : 'None') + '</div>' +
    '</div>' +
    '<table><thead><tr><th>#</th><th>Item Description</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST %</th><th class="r">GST Amt</th><th class="r">Line Gross</th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table>' +
    '<div class="totals-wrap"><table class="totals-table">' +
    '<tr><td>Gross Subtotal</td><td class="r">₹' + calc.subtotal.toFixed(2) + '</td></tr>' +
    '<tr><td>CGST + SGST (Total GST)</td><td class="r">₹' + calc.tax.toFixed(2) + '</td></tr>' +
    (calc.discount ? '<tr><td>Coupon Discount (' + esc(order.coupon) + ')</td><td class="r" style="color:#16a34a">-₹' + calc.discount.toFixed(2) + '</td></tr>' : '') +
    '<tr class="grand"><td>Invoice Total</td><td class="r">₹' + calc.total.toFixed(2) + '</td></tr>' +
    '</table></div>' +
    mismatchBanner +
    '<div class="actions">' +
    '<span>Computer generated tax invoice &middot; Subject to Pune Jurisdiction</span>' +
    '<button class="btn-print" onclick="window.print()">Print Invoice</button>' +
    '</div>' +
    '</div></body></html>';
};
