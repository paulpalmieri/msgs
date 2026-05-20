# MSGS

**Rediscover your Messenger & Instagram chats.**

MSGS turns your Facebook Messenger and Instagram DM exports into a searchable, visual archive — entirely in the browser. No server, no account, no data upload.

![Analytics dashboard with activity heatmaps, messaging stats, and user breakdowns](docs/screenshot.png)

---

## Why this exists

Messaging apps are designed for real-time conversations, not for looking back. Finding a specific message from three years ago is a nightmare. There's no way to see how a friendship evolved, what words or phrases defined a year, or which relationships faded. MSGS solves that.

> Drop in your export, get a full picture of your messaging history — search it, chart it, relive it.

---

## Features

### Analytics

Activity and patterns across all your conversations.

- **Calendar heatmap** — see which days and months you were most active, spot gaps and bursts at a glance
- **Hourly & weekly patterns** — find out if you're a late-night texter or a morning messenger
- **Reaction breakdown** — who reacts most, with what, and to whom
- **Per-user stats** — message counts, average length, who initiates, response times, streaks and longest gaps
- **Interaction heatmap** — who you talk to, and when

### Content

What you actually said.

- **Word clouds** — visual representation of your vocabulary, per conversation or globally
- **Top phrases** — recurring n-grams that surface inside jokes, habits, and catchphrases
- **Sentiment analysis** — positive/negative tone by person and over time
- **Unique vocabulary** — how large is your lexicon per person? Who introduces new words?
- **Word trends** — track a specific word or phrase over time; see when a topic peaked
- **Word search** — search across your entire indexed history instantly; something messaging apps can't do

### Wrapped

A Spotify Wrapped-style story for any year and any person in your history. Animated slides with your biggest numbers — most messages, top reactions, peak streaks, favorite words — shareable as a card.

---

## Privacy

Everything runs locally. There is no backend.

- Parsing, aggregation, and analytics all happen in your browser
- Sessions are optionally saved to `localStorage` so you don't have to re-upload every time
- Clear browser data at any time to wipe everything
- No accounts, no telemetry (except Vercel Analytics on the hosted demo — see the [Deploying](#deploying) section)

---

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Demo data loads by default so you can explore without your own files.

---

## Getting your data

### Facebook Messenger

1. Go to [Facebook → Settings → Your Facebook information → Download your information](https://www.facebook.com/dyi/)
2. Select **Messages**, format **JSON**, date range **All time**
3. Download and unzip — you'll get one or more `your_facebook_activity-N/` folders
4. Drag those folders into MSGS

### Instagram DMs

Same flow via [Instagram → Settings → Your activity → Download your information](https://www.instagram.com/download/request/) — select **Messages** and **JSON**.

---

## Deploying

The app is a static SPA with no build-time secrets. Deploy to Vercel in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/paulpalmieri/msgs&root-directory=frontend)

`frontend/vercel.json` is already configured for client-side routing.

> **Note:** `@vercel/analytics` is included for the hosted demo. If you self-host and don't want Vercel's page-view tracking, remove the `<Analytics />` component from `src/App.jsx` and uninstall `@vercel/analytics`.

---

## Architecture

For anyone who wants to dig in or contribute.

### How parsing works

All parsing lives in [`src/utils/parseMessenger.js`](frontend/src/utils/parseMessenger.js). It reads the raw Facebook/Instagram JSON export files directly in the browser (via the File System Access API), handles multiple `your_facebook_activity-N` folders, merges split conversations, and produces a normalized aggregate per conversation.

The parser tracks: message counts per user, response times, conversation sessions (a new session starts after a 2-hour gap), streaks and gaps, emoji extraction, URL/link counts, mention detection (`@user`), and content categorization. It infers timezone from activity patterns.

[`src/utils/aggregatesToProcessed.js`](frontend/src/utils/aggregatesToProcessed.js) takes those raw aggregates and shapes them into the display-ready data structures the UI consumes.

### Analytics modules

[`src/utils/analytics/`](frontend/src/utils/analytics/) breaks down the heavier analysis:

| File | Responsibility |
|---|---|
| `temporal.js` | Hourly/weekly/calendar bucketing |
| `users.js` | Per-user stats, response times, streaks |
| `creative.js` | Word clouds, top phrases, sentiment, vocabulary |
| `patterns.js` | Heatmaps, activity patterns |
| `helpers.js` | Shared utilities |

### Feature layout

```
src/features/
├── analytics/   # Overview dashboard — activity, reactions, evolution, user stats
├── content/     # Deep language analysis — words, phrases, sentiment, search
└── wrapped/     # Story engine — slides, animation, share cards
```

### Shared components

```
src/components/
├── CalendarHeatmap.jsx
├── InteractionHeatmap.jsx
├── EvolutionAnalysis.jsx
├── ReactionsAnalysis.jsx
├── UsersAnalysis.jsx
├── UserDossier.jsx
├── layout/      # Header, FilterBar, MenuDrawer
└── ui/          # DataTable, Sparkline, Typography, Controls
```

### Hooks

- `src/hooks/useDataLoader.js` — file ingestion, parsing orchestration, loading state
- `src/hooks/useFilters.js` — global filter state (date range, conversation, user)
- `src/features/content/hooks/useWordSearch.js` — indexed full-text search across all messages
- `src/features/wrapped/hooks/useStoryNavigation.js` — slide progression logic

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | None — 100% client-side |

---

## License

MIT
