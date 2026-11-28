# Historical invoice GST

Orders created before per-line `gstRate` and `lineTax` were saved contain only an HSN code and an order-level GST amount. An HSN code alone does not prove which rate applied on the order date: `config.js` has no dated tax table. The original discount and rounding per line also were not saved.

For those orders, the invoice shows the saved GST total but labels the line rate and tax **Not recorded**. Reconciliation checks item gross amounts and the saved subtotal, discount, tax, and total for arithmetic consistency. It marks line GST unverified rather than treating today's tax rules as historical evidence. New orders save the applied rate and discounted line tax so their line GST can be checked independently.
