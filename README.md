# Job Application Tracker

A Chrome extension to track job applications across any career site, with Google Sheets sync.

## Features

- **Track Applications** — Add, edit, and delete job applications with fields for company, role, date, status, location, URL, and notes
- **Status Tracking** — 6 statuses: Applied, Interviewing, Offer Received, Rejected, Withdrawn, No Response
- **Search & Filter** — Filter by status and search by company or role
- **Page Scanning** — Auto-detect job details from Greenhouse, Lever, LinkedIn, AngelList, and We Work Remotely postings
- **CSV Import/Export** — Import from CSV with smart column detection, or export your applications
- **Google Sheets Sync** — Sync all applications to a personal Google Sheet via Apps Script webhook
- **Setup Wizard** — Guided 4-step setup for Google Sheets integration

## Tech Stack

- React 18 + TypeScript
- Vite
- Chrome Extension Manifest V3
- Chrome Storage API

## Getting Started

### Prerequisites

- Node.js
- npm

### Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

### Build

```bash
npm run build
```

Output goes to the `build/` directory.

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `build/` directory

## Google Sheets Setup

1. Create a new Google Sheet
2. Open **Extensions → Apps Script**
3. Paste the provided Apps Script code (available in the extension's setup wizard)
4. Deploy as a web app
5. Copy the deployment URL into the extension's settings

## Project Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Root component
├── App.css               # Styles
├── types.ts              # TypeScript interfaces
├── components/
│   ├── Header.tsx        # Navigation and actions
│   ├── AppForm.tsx       # Add/edit form
│   ├── AppList.tsx       # Application list
│   ├── AppCard.tsx       # Application card
│   ├── Filters.tsx       # Status filters + search
│   ├── Stats.tsx         # Summary statistics
│   ├── StatusSelect.tsx  # Status dropdown
│   ├── Badge.tsx         # Status badge
│   ├── SetupWizard.tsx   # Google Sheets setup
│   └── Feedback.tsx      # Toast notifications
├── hooks/
│   ├── useJobApps.ts     # Application CRUD + persistence
│   └── useWebhook.ts     # Google Sheets sync
└── utils/
    ├── constants.ts      # Status map, helpers
    ├── storage.ts        # Storage abstraction (extension/web)
    └── types.ts          # Shared types
public/
├── manifest.json         # Chrome extension manifest
├── background.js         # Service worker
├── content.js            # Content script (job detection)
└── icons/                # Extension icons
```
