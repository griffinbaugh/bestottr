# Bestottr

Build a polished, interactive full-stack web app called StudioBid: a marketplace for buying and selling Roblox experiences/studios through verified listings, auctions, managed transaction rooms, and ownership-transfer workflows. This first version should prioritize a reliable, testable UI and end-to-end demo flow over real money movement. It must work well on iPad Safari and desktop.

Core product flow to support with realistic seeded/mock data:
1) Seller signs in and connects/verifies Roblox.
2) Seller selects an experience/studio and creates a listing.
3) Buyer browses/searches/filter listings.
4) Buyer opens a listing, reviews verified metrics, financials, seller info, auction status, bid history, and places a bid.
5) Auction can be won in the demo flow, then a private deal room opens.
6) Deal room shows purchase price, platform fee, buyer funding status, due diligence, asset checklist, legal agreement status, Roblox ownership-transfer checklist, and final completion state.
7) Seller completes transfer items; buyer confirms receipt; demo transaction completes.

Pages/features to build now:
- Premium marketplace landing/home page with featured listings and live auction cards
- Browse marketplace page with search, price range, revenue range, genre/category, auction/buy-now, verified-only, sort, and watchlist controls
- Detailed listing page with large game thumbnail, title, verified badges, current bid, reserve/buy-now area, countdown, bid history, monthly revenue, monthly profit, visits, CCU, favorites, age, monetization breakdown, seller profile, included assets, risks/notes, and Place Bid button
- Bid modal with validation and clear total commitment
- Seller listing wizard with steps: Roblox verification, experience selection, listing details, financials, sale format, included assets, review/publish
- Buyer dashboard: active bids, won auctions, watchlist, transactions
- Seller dashboard: active listings, offers/bids, sold listings, revenue summary, transaction status
- Deal room / acquisition room with clear stepper: Agreement -> Funding -> Due Diligence -> Roblox Transfer -> Final Verification -> Complete
- Transfer checklist covering experience ownership, community/group ownership if applicable, source code, private packages/modules, API keys rotation, branding, social accounts, contractor/IP assignments, and post-transfer republish/verification
- Admin/moderation dashboard with listing review, user verification, disputes, suspicious bids, and manual transaction review
- Responsive navigation and layouts for iPad landscape/portrait and desktop

Visual direction:
- Serious technology/acquisition marketplace, not a generic Roblox fan site
- Premium, modern fintech/SaaS feel inspired by Acquire.com, StockX, Linear, Stripe dashboards, and high-end marketplaces
- Neutral light/dark surfaces, strong typography, restrained accent color, Roblox thumbnails provide most of the color
- Crisp cards, subtle borders, clear hierarchy, polished empty/loading/error states
- Use realistic Roblox-style game thumbnails/placeholders and data, but do not copy trademarked website branding or Roblox UI
- Avoid childish styling, neon gamer UI, gradients everywhere, oversized rounded blobs, or cartoonish elements

Important UX requirements:
- Every major screen must be clickable and testable using demo data
- Include obvious demo actions to advance a transaction through each stage without requiring real Stripe or Roblox credentials
- Seed at least 8 marketplace listings with varied prices, genres, revenue, CCU, and auction states
- One seeded listing should have an active auction with bid history and be usable for the full demo purchase flow
- Make all primary buttons, navigation, filters, listing cards, watchlist actions, bidding flow, listing wizard steps, dashboards, and deal-room controls functional
- If a backend/database is not needed for the first pass, use reliable local state/mock persistence, but structure the product so a database and integrations can be added next
- Do not ask for credentials in this build

Home page hero copy can use positioning like: "Buy and sell Roblox businesses with confidence" with supporting copy around verified ownership, competitive bidding, secure transactions, and managed transfers.

Please build the first complete interactive version now. The top priority is that the preview visibly renders and the entire demo flow is navigable and testable on iPad Safari.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bestottr.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d48f02d5-f625-4c1a-9b13-d34363683297).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
