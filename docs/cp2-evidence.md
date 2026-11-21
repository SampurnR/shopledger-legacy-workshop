# CP2 — Architecture evidence

Diagram: `docs/architecture.svg` (the only architecture diagram).
Open it in a browser to see the static UI, Express entry point, every router and
every lib module, config.js and JSON persistence. The numbered blue arrows show
order placement; secondary paths show preview, invoices and reconciliation.
Boxes group components by layer; a group arrow does not imply every module calls
every other module. No external service, authentication or database is invented.

CP2 changed only this document and the diagram. No application code, dependency,
or tracked data file changed. Capture the complete SVG view for the form.
