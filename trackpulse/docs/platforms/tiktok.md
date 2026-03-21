# TikTok — Pixel & Events API

## Browser Pixel

### Network Requests

```
POST https://analytics.tiktok.com/api/v2/pixel
POST https://analytics.tiktok.com/i18n/pixel/events.js?...
GET  https://analytics.tiktok.com/i18n/pixel/static/main.*.js
```

Monitoring/heartbeat:
```
https://mon.tiktok.com/...
```

### Key Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `event` | Event name | `CompletePayment`, `AddToCart` |
| `event_id` | Event ID (dedup key) | `uuid-string` |
| `pixel_code` | Pixel ID | `CXXXXXXXXXXXXXX` |
| `properties.value` | Transaction value | `49.99` |
| `properties.currency` | Currency | `USD` |
| `properties.contents` | Items array | `[{"content_id":"sku1","quantity":1}]` |

### Request Formats

TikTok pixel sends data in multiple formats depending on SDK version:

1. **JSON POST body** (primary):
   ```json
   { "pixel_code": "...", "event": "...", "event_id": "...", "properties": {...} }
   ```

2. **Batch format**:
   ```json
   { "batch": [{ "event": "...", "properties": {...} }] }
   ```

3. **Data array**:
   ```json
   { "data": [{ "event": "..." }] }
   ```

4. **Events array**:
   ```json
   { "events": [{ "type": "..." }] }
   ```

### Cookie & Click ID

| Identifier | Type | Format | Purpose |
|------------|------|--------|---------|
| `_ttp` | First-party cookie | Opaque string | Browser ID — set by pixel SDK |
| `ttclid` | URL parameter | Alphanumeric | Click ID — appended to landing page from ad click |

## Events API (Server-Side)

### Endpoint

```
POST https://business-api.tiktok.com/open_api/v1.3/event/track/
```

### Payload Structure

```json
{
  "pixel_code": "PIXEL_ID",
  "event": "CompletePayment",
  "event_id": "unique-uuid",
  "event_time": 1672531200,
  "user": {
    "email": "<sha256>",
    "phone": "<sha256>",
    "external_id": "<sha256>",
    "ttp": "_ttp_cookie_value",
    "ttclid": "click_id_value",
    "ip": "1.2.3.4",
    "user_agent": "Mozilla/..."
  },
  "properties": {
    "contents": [{"content_id": "sku1", "quantity": 1, "price": 49.99}],
    "currency": "USD",
    "value": 49.99
  },
  "page": {
    "url": "https://...",
    "referrer": "https://..."
  }
}
```

## Deduplication

### Mechanism

- Field: `event_id` — must be identical in browser pixel and Events API
- Window: **48 hours** from first event received
- Events from Pixel + Events API arriving after 5 min but within 48h are merged/deduplicated
- Priority: first event received wins

### Requirements

- `event_id` must be a non-empty string, unique per event occurrence
- `event` (event name) must match between pixel and Events API
- Same pixel code

## Quality / Matching Parameters

| Field | Location | Hashing | Priority |
|-------|----------|---------|----------|
| `email` | `user.email` | SHA-256 required | High |
| `phone` | `user.phone` | SHA-256 required | High |
| `external_id` | `user.external_id` | SHA-256 required | Medium |
| `ttp` | `user.ttp` | No hash | High — from `_ttp` cookie |
| `ttclid` | `user.ttclid` | No hash | Critical — click attribution |
| `ip` | `user.ip` | No hash | Required for CAPI |
| `user_agent` | `user.user_agent` | No hash | Required for CAPI |

## Standard Events

| Event Name | Category |
|------------|----------|
| `ViewContent` | Product view |
| `AddToCart` | Cart |
| `InitiateCheckout` | Checkout |
| `CompletePayment` | Purchase |
| `PlaceAnOrder` | Order |
| `AddToWishlist` | Wishlist |
| `Search` | Search |
| `Contact` | Lead gen |
| `SubmitForm` | Lead gen |
| `Subscribe` | Lead gen |
| `CompleteRegistration` | Lead gen |
| `ClickButton` | Engagement |
| `Download` | Engagement |

## Quality Checks for Traacky

### From Browser Pixel

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Event ID present | `event_id` in JSON body | Critical |
| TTP cookie | `_ttp` cookie exists on page | High |
| TTClid captured | `ttclid` in URL params or user data | High (if from ad click) |
| Value on purchase | `properties.value` + `properties.currency` | High |
| Contents on commerce | `properties.contents` array with `content_id` | Medium |
| Pixel code present | `pixel_code` in request | Medium |

### Cross-check Browser vs Events API (sGTM)

| Check | Browser field | Events API field |
|-------|--------------|-----------------|
| Event ID match | `event_id` | `event_id` |
| Event name match | `event` | `event` |
| Value match | `properties.value` | `properties.value` |
| Currency match | `properties.currency` | `properties.currency` |

## References

- [TikTok Events API Overview](https://ads.tiktok.com/help/article/events-api)
- [TikTok Event Deduplication](https://ads.tiktok.com/help/article/event-deduplication)
- [TikTok Standard Events & Parameters](https://ads.tiktok.com/help/article/standard-events-parameters)
- [TikTok Matching Events Setup](https://ads.tiktok.com/help/article/how-to-set-up-matching-events-with-events-api)
