# Sweet Red Peach — Order Operations Dashboard

Internal order management tool for Sweet Red Peach bakery.

---

## Getting started (local)

You need **Node.js** installed. If you don't have it, download it at https://nodejs.org (get the LTS version).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

Then open http://localhost:5173 in your browser.

---

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com and sign in with GitHub
3. Click **Add New Project** → select your repo
4. Leave all settings as default → click **Deploy**
5. Done — you'll get a live URL like `srp-order-ops.vercel.app`

Every time you push to GitHub, Vercel auto-deploys.

---

## File structure

```
src/
├── App.jsx                  # Root — all state lives here
├── main.jsx                 # React entry point
├── index.css                # Global styles + CSS variables
├── App.module.css
├── data/
│   └── orders.js            # Sample seed data
├── utils/
│   └── helpers.js           # Date formatting, constants, helpers
└── components/
    ├── Header.jsx            # Top nav + search
    ├── CalStrip.jsx          # Day tabs + browse calendar
    ├── Board.jsx             # Kanban columns
    ├── OrderCard.jsx         # Individual order card
    ├── Drawer.jsx            # Side panel (order details + SMS)
    ├── OrderModal.jsx        # New + Edit order form
    ├── ItemsEditor.jsx       # Item rows with pricing
    ├── ImageUpload.jsx       # Photo attachment
    ├── CalendarPopup.jsx     # Reusable mini calendar
    └── Toast.jsx             # Notification toast
```

---

## Production roadmap

| Phase | What | Tools |
|-------|------|-------|
| 1 | Live hosting | Vercel (free) |
| 2 | Real database (orders persist) | Supabase (free tier) |
| 3 | Real SMS notifications | Twilio (~$1/mo) |
| 4 | Staff login / auth | Supabase Auth |

Monthly cost at SRP scale: **under $5/month**
