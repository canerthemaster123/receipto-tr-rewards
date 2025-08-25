# Receipt Tracker App

A comprehensive receipt tracking application built with React, TypeScript, Vite, and Supabase.

## Features

- **Receipt Management**: Upload, OCR processing, and approval workflow
- **Points System**: Earn points for approved receipts
- **Gamification**: Badges, streaks, challenges, and leaderboards
- **Admin Panel**: Manage receipts, users, and gamification features
- **B2B Analytics**: Advanced analytics dashboard for business insights
- **Multi-language Support**: Turkish and English localization
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: Radix UI, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **OCR**: Google Vision API
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account and project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Copy the example env file
   cp .env.example .env.local
   
   # Fill in your Supabase credentials
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## B2B Analytics Setup

### How to Seed Demo Data & Run Rollups

The B2B Analytics feature includes a comprehensive system for analyzing receipt data across geographic regions and merchant chains.

#### Development Environment Setup

1. **Enable Dev Seeding** (Development/Staging only):
   ```bash
   # Add to your environment variables
   VITE_ALLOW_DEV_SEED=true
   ```

2. **Access Admin Analytics**:
   - Navigate to `/admin/analytics` (requires admin role)
   - You'll see controls for seeding demo data and running rollups

#### Seeding Demo Data

When `VITE_ALLOW_DEV_SEED=true`, you can use the "Seed Demo Data (Dev)" button to:

- **Merchant Mappings**: Creates mappings for major Turkish retailers (Migros, BİM, A101, ŞOK, CarrefourSA)
- **Store Locations**: Adds stores in İstanbul (Beşiktaş/Levent) and İzmir (Karşıyaka/Bostanlı)
- **Receipt Data**: Generates ~240 receipts across the last 2 weeks with realistic spending patterns
- **Geographic Distribution**: Spreads data across multiple cities and districts

#### Running Rollups

The "Run Rollups Now" button triggers weekly data aggregation:

- **User×Merchant Analysis**: Tracks customer behavior per merchant chain
- **Geographic Analysis**: Analyzes spending patterns by location
- **Anomaly Detection**: Identifies statistical outliers and trends
- **Alert Generation**: Creates alerts for significant changes

#### Analytics Features

**KPIs Available:**
- Weekly Active Buyers (WAB)
- Average Order Value (AOV)
- Leakage Rate (new user percentage)
- Winback Rate (returning user percentage)
- Net Flow (user acquisition balance)

**Geographic Insights:**
- Top performing districts by chain
- Regional spending pattern changes
- Location-based user behavior analysis

**Alert System:**
- Statistical anomaly detection (z-score ≥ 3.0)
- Severity levels (critical, high, medium)
- Automatic geographic and metric-based alerting

#### Production Considerations

- Remove `VITE_ALLOW_DEV_SEED=true` in production
- Set up automated rollup scheduling using cron jobs
- Configure appropriate RLS policies for analytics tables
- Ensure proper API rate limiting for admin functions

#### Troubleshooting

If analytics show no data:
1. Check if you have admin privileges
2. Use "Seed Demo Data" (if in dev environment)
3. Run "Run Rollups Now" to process existing data
4. Verify merchant mappings and store data exist

## Database Schema

The application uses several key tables:

- `receipts`: Core receipt data with OCR results
- `users_profile`: User information and points
- `merchant_map`: Merchant name normalization
- `store_dim`: Store location data
- `period_geo_merchant_week`: Weekly geographic analytics
- `period_user_merchant_week`: User behavior analytics
- `alerts`: Anomaly detection results

## Project info

**URL**: https://lovable.dev/projects/90fb07b9-7b58-43af-8664-049e890948e4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/90fb07b9-7b58-43af-8664-049e890948e4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/90fb07b9-7b58-43af-8664-049e890948e4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)