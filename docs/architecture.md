# ShopLedger Architecture

The browser loads the static interface from `public/` and sends requests to the Express application. Route handlers call the business logic in `lib/`. The JSON file is accessed through `lib/store.js`.

## Component map

```mermaid
flowchart LR
  subgraph Browser
    UI[HTML and CSS]
    BrowserJS[public/js/app.js]
    UI --> BrowserJS
  end

  subgraph ExpressApp[Express application]
    Server[server.js]
    ProductsRoute[routes/products.js]
    OrdersRoute[routes/orders.js]
    CustomersRoute[routes/customers.js]
    ReportsRoute[routes/reports.js]
    Server -->|mounts under /api| ProductsRoute
    Server -->|mounts under /api| OrdersRoute
    Server -->|mounts under /api| CustomersRoute
    Server -->|mounts under /api| ReportsRoute
  end

  BrowserJS <-->|HTTP| Server
  Server -->|serves static files| UI

  subgraph Lib[Business logic in lib/]
    Store[store.js]
    Orders[orders.js]
    Inventory[inventory.js]
    Pricing[pricing.js]
    Tax[tax.js]
    Coupons[coupons.js]
    Ledger[ledger.js]
    Reports[reports.js]
    Invoice[invoice.js]
    Dates[dates.js]
  end

  ProductsRoute --> Store
  ProductsRoute --> Inventory
  ProductsRoute --> Tax
  ProductsRoute --> Coupons
  OrdersRoute --> Store
  OrdersRoute --> Inventory
  OrdersRoute --> Pricing
  OrdersRoute --> Coupons
  OrdersRoute --> Orders
  OrdersRoute --> Ledger
  CustomersRoute --> Store
  CustomersRoute --> Ledger
  ReportsRoute --> Store
  ReportsRoute --> Reports
  ReportsRoute --> Pricing
  ReportsRoute --> Coupons

  Orders --> Inventory
  Orders --> Ledger
  Orders --> Dates
  Ledger --> Dates
  Pricing --> Tax
  Pricing --> Coupons
  Reports --> Inventory
  Reports --> Ledger
  Reports --> Invoice

  subgraph Settings[Configuration and stored data]
    Config[config.js]
    JsonFile[(data/db.json)]
  end

  Server -->|port| Config
  ReportsRoute -->|shop and admin settings| Config
  Inventory --> Config
  Tax --> Config
  Coupons --> Config
  Invoice --> Config
  Store <-->|reads and writes JSON| JsonFile

  Server -->|invoice handler reads data| Store
  Server -->|invoice handler finds order| Orders
  Server -->|invoice handler renders HTML| Invoice
```

## Order placement flow

This shows the `POST /api/orders` path. The Khata charge is only used when the payment mode is `khata`.

```mermaid
flowchart TD
  Browser[public/js/app.js] -->|POST /api/orders| Handler[routes/orders.js]
  Handler --> Read[store.read from data/db.json]
  Read --> Resolve[Resolve product IDs and build order items]
  Resolve --> StockCheck[inventory.check]
  StockCheck -->|not available| StockError[Return HTTP 409]
  StockCheck -->|available| Subtotal[pricing.subtotal]
  Subtotal --> Coupon[coupons.normalizeCode and validate]
  Coupon -->|invalid| CouponError[Return HTTP 400]
  Coupon -->|valid or no coupon| Totals[pricing.computeTotals using coupons and tax]
  Totals --> Payment{Payment mode is khata?}
  Payment -->|no| Reserve[inventory.reserve deducts physical stock]
  Payment -->|yes| Khata[ledger.chargeOrderToKhata]
  Khata -->|rejected| KhataError[Return HTTP 409]
  Khata -->|accepted| Reserve
  Reserve --> Add[orders.add appends the order in memory]
  Add --> Audit[store.appendAudit]
  Audit --> Write[store.write to data/db.json]
  Write --> Response[Return HTTP 201 with order]
```

## Reading the diagrams

- Express serves the browser files, parses JSON request bodies, and mounts the four route modules under `/api`.
- The order route checks the requested products and available stock before pricing. Pricing applies coupon rules and resolves GST through `tax.js`.
- If the order uses Khata, the route charges the customer account before deducting stock. It then adds the order and audit entry and saves the updated JSON file.
- `store.js` reads and writes `data/db.json`, which contains the shop's products, orders, customers, settlements, audit log, and ID counters.
- The printable invoice endpoint is registered directly in `server.js`; it reads the data, finds the order, and renders invoice HTML.

## Source files inspected

- `server.js`, `config.js`, `package.json`
- `public/index.html`, `public/js/app.js`, `public/css/style.css`
- `routes/products.js`, `routes/orders.js`, `routes/customers.js`, `routes/reports.js`
- `lib/store.js`, `lib/orders.js`, `lib/inventory.js`, `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`, `lib/ledger.js`, `lib/reports.js`, `lib/invoice.js`, `lib/dates.js`
- `data/db.json`
