# Azzurro Review Insights

A local operations dashboard for monitoring Booking.com guest feedback across four Azzurro Hotels properties.

## Features

- Current-week average rating and comparison with the previous week
- Rating breakdown for all four properties
- Positive and negative 14-day trends
- Keyword-based negative-review topic insights
- Search, property, and sentiment filters
- Recent review feed and CSV export
- Incremental scrape endpoint with duplicate prevention
- Bundled sample dataset for immediate local use

## Quick start

```powershell
npm install
npm run build
npm start
```

Open `http://localhost:3001`.

For frontend development, run the API and Vite in separate terminals:

```powershell
npm run server
npm run dev
```

Vite is available at `http://localhost:5173` and proxies `/api` requests to the Node server.

## Refresh reviews

Use the **Refresh reviews** button in the dashboard or call:

```powershell
Invoke-RestMethod -Method POST http://localhost:3001/api/scrape
```

The scraper reads each public Booking.com property page, parses visible review cards, and adds reviews whose stable IDs are not already present in `data/reviews.json`. Duplicate reviews are prevented by a base64-derived key based on property, text, date, and rating.

## Architecture

- `src/` — React and TypeScript operations dashboard
- `server.js` — Express API, collection runner, deduplication, and metrics
- `data/reviews.json` — JSON review store and bundled sample data
- `dist/` — production frontend output

The frontend calls `/api/reviews`, `/api/metrics`, `/api/properties`, and `/api/scrape`.

## Collection methodology

There is no supported Booking.com API for this task. The application uses a conservative public-page scraper:

1. Request each property page with a timeout and identifiable user agent.
2. Parse known Booking.com review-card selectors and review metadata.
3. Normalize rating and date values.
4. Generate a stable review ID.
5. Merge only new IDs into JSON storage.
6. Continue to the remaining properties if one request fails.

## Insight methodology

Negative reviews are those rated 6.0 or below. Keyword rules classify review text into Cleanliness, Check-in, Staff, Noise, Facilities, Location, Room condition, and Value. A review may contribute to multiple topics. Topic percentages indicate the share of negative reviews in the selected dataset mentioning that topic; they are not mutually exclusive.

This approach is transparent and easy to audit, but keyword rules can miss negation, sarcasm, and context. It should be treated as an operational triage aid rather than definitive customer research.

## Data and reliability limitations

- Booking.com HTML may change without notice.
- The public page can serve bot checks, temporary failures, localized markup, or pagination restrictions.
- The scraper does not use credentials or cookies.
- The bundled file contains clearly labeled demo data. It is not represented as live Booking.com data.
- Live collection availability and extraction quality depend on Booking.com's public pages.
- Human review is recommended before operational decisions.

## Properties

- Olympic Hotel Paddington
- Potts Point
- Central Sydney
- Darling Harbour

No passwords, API keys, cookies, or personal credentials are required or committed.
