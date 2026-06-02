# AzadiPOS — Retail Point of Sale System

A complete, plug-and-play POS system for retail shops. One installer, zero prerequisites — just download, install, and start selling.

## Quick Start

### Download
Go to the [Actions tab](https://github.com/azadipos/azadipos/actions) and download the latest **Azadi POS Setup.exe** from the most recent successful build.

### Install & Run
1. **Run** `Azadi POS Setup.exe` on your Windows PC
2. **Choose mode** on the setup screen:
   - **Server Mode** — for the main computer (installs PostgreSQL automatically, creates the database)
   - **Terminal Mode** — for additional checkout counters (connects to the server over your local network)
3. **That's it.** The app launches and you're ready to go.

> **No prerequisites needed.** The installer handles everything — Node.js is bundled via Electron, PostgreSQL is downloaded and installed automatically in Server mode.

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   SERVER COMPUTER   │     │  TERMINAL COMPUTER  │
│                     │     │                     │
│  AzadiPOS (Server)  │◄───►│ AzadiPOS (Terminal)  │
│  + PostgreSQL DB    │ LAN │  (connects to server)│
└─────────────────────┘     └─────────────────────┘
```

- **Server**: Runs the POS app + PostgreSQL database. This is your main machine.
- **Terminal(s)**: Additional checkout counters that connect to the server's database over your local network. No database needed on these machines.

---

## Features

### POS (Point of Sale)
- Fast product search with barcode scanning
- Cart management with quantity editing
- Multiple payment methods (cash, card, mobile)
- Receipt printing
- Hold & recall transactions
- Customer loyalty & rewards
- Manager authorization for sensitive operations
- On-screen keyboard for touch displays
- Offline mode with auto-sync

### Admin Dashboard
- **Products** — full inventory management with categories
- **Customers** — customer database with loyalty tracking
- **Sales Reports** — daily, weekly, monthly analytics with charts
- **Employees** — staff management with role-based access
- **Settings** — company profile, tax, receipt customization
- **Cash Management** — opening/closing balances, drawer tracking
- **Suppliers** — purchase orders and supplier management
- **Price Optimization** — AI-assisted pricing suggestions
- And more: returns, exchanges, audit logs, data import/export

---

## For Developers

### Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 16
- **Desktop**: Electron 26
- **Build**: electron-builder (NSIS installer)

### Branches
- `main` — Web app source code
- `electron` — Desktop wrapper + installer config

### Building Locally
```bash
git checkout electron
npm install --legacy-peer-deps
npx prisma generate
npm run build
npx electron-builder --win --x64
```

The installer will be in `dist/`.

### GitHub Actions
Push to the `electron` branch triggers an automatic Windows build. Download the artifact from the Actions tab.

---

## License
Proprietary — All rights reserved.
