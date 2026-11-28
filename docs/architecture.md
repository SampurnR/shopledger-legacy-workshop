# ShopLedger architecture

```mermaid
flowchart LR
    UI["Browser UI · public/"]
    Server["Express app · server.js"]
    Config["Settings · config.js"]
    Routes["API · routes/"]
    Domain["Order, inventory, pricing, GST, ledger, and report logic · lib/"]
    Invoice["Printable invoice · lib/invoice.js"]
    Store["JSON persistence · lib/store.js"]
    DB[("data/db.json")]

    UI -->|"Loads static assets and calls the API"| Server
    Server --> Config
    Server -->|"/api"| Routes
    Server -->|"/orders/:id/invoice"| Invoice
    Server -->|"Reads invoice order data"| Store
    Routes --> Domain
    Routes --> Store
    Domain --> Config
    Store -->|"Reads and writes"| DB
```

The order API checks sellable stock before deducting order quantities from physical stock. Cancellation restores those quantities and preserves wholesale reservations. The order routes persist successful changes through the JSON store.
