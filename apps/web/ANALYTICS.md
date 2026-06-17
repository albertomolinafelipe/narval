# Analytics Tracking

This project uses [Umami Analytics](https://umami.is/) for privacy-focused tracking.

## What's Tracked

### Automatic Tracking

- **Page views**: Umami automatically tracks all page views

### User Sessions

- **Email as identifier**: When a user logs in, their session is identified by their email address
- This allows tracking user journeys across sessions while respecting privacy

### Authentication Events

- Login (success/failure)
- Registration (with account type)
- Logout

### Entity Views

- Viewing startup profiles
- Viewing investor profiles
- Includes contextual data like name, industry, stage, etc.

## How It Works

### Session Identification

Located in `apps/web/src/app/session-identifier.tsx`

This component runs on every page load and identifies authenticated users with Umami using their email address. You'll see the user's email in the Umami sessions tab.

### Tracking Functions

All tracking utilities are in `apps/web/src/lib/analytics.ts`:

- `identifySession(email)` - Identify user sessions by email
- `trackAuth(action, data)` - Track auth events
- `trackViewDetail(entityType, id, data)` - Track entity page views
- `trackEvent(name, data)` - Generic event tracking (for custom events)

## Adding New Tracking

To track a new event:

```typescript
import { trackEvent } from "@/lib/analytics";

// Track a custom event
trackEvent("my-event", {
  customData: "value",
  moreData: 123,
});
```

## Configuration

Umami is configured via environment variables:

- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` - Your website tracking ID
- `NEXT_PUBLIC_UMAMI_URL` - Umami server URL

See `.env.example` for setup instructions.
