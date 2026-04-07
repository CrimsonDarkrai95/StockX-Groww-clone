frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.jsx        → POST /api/auth/login
│   │   └── register/page.jsx     → POST /api/auth/register
│   │
│   ├── (dashboard)/
│   │   ├── layout.jsx            → wraps all protected pages, checks JWT
│   │   ├── page.jsx              → home dashboard (market overview)
│   │   │
│   │   ├── stocks/
│   │   │   ├── page.jsx          → GET /api/stocks
│   │   │   └── [symbol]/page.jsx → GET /api/stocks/:symbol
│   │   │
│   │   ├── portfolio/
│   │   │   └── page.jsx          → GET /api/portfolio
│   │   │
│   │   ├── orders/
│   │   │   └── page.jsx          → GET /api/orders/history
│   │   │                            POST /api/orders (modal/drawer)
│   │   │
│   │   ├── wallet/
│   │   │   └── page.jsx          → GET /api/wallet/balance
│   │   │                            POST /api/wallet/deposit
│   │   │
│   │   └── watchlist/
│   │       └── page.jsx          → GET /api/watchlist
│   │                                POST /api/watchlist
│   │                                DELETE /api/watchlist/:id
│
├── components/
│   ├── ui/                       → shadcn/ui components (Button, Card, Table)
│   ├── StockCard.jsx             → reused in stocks list + watchlist
│   ├── PriceChart.jsx            → TradingView Lightweight Charts
│   ├── OrderModal.jsx            → buy/sell drawer on stock detail page
│   ├── HoldingsTable.jsx         → portfolio page
│   └── Navbar.jsx
│
├── lib/
│   ├── api.js                    → axios instance with base URL + JWT header
│   └── auth.js                   → JWT decode, token storage (localStorage)
│
└── store/
    ├── index.js                  → Redux Toolkit store
    ├── authSlice.js              → user state, token
    ├── stocksSlice.js            → stocks list, selected stock
    └── portfolioSlice.js         → holdings, P&L
