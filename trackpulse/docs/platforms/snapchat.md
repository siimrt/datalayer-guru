# Snapchat — Pixel & Conversions API

## Browser Pixel

### Network Requests

```
GET https://tr.snapchat.com/p?id={PIXEL_ID}&ev={EVENT_NAME}&...
```

Conversions API endpoint:
```
POST https://tr.snapchat.com/v3/{PIXEL_ID}/events
```

Cookie matching:
```
https://tr.snapchat.com/cm/i
```

Shadow/backup:
```
https://tr-shadow.snapchat.com/...
```

SDK script:
```
https://sc-static.net/scevent.min.js
```

### Key Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `id` | Pixel ID | `uuid-format` |
| `ev` | Event name | `PAGE_VIEW`, `PURCHASE`, `ADD_CART` |
| `client_dedup_id` | Dedup ID (non-purchase) | `uuid-string` |
| `transaction_id` | Dedup ID (purchase) | `order-456` |
| `price` | Transaction value | `49.99` |
| `currency` | Currency | `USD` |

### Click ID

| Identifier | Type | Format | Purpose |
|------------|------|--------|---------|
| `ScCid` | URL parameter | Alphanumeric | Snapchat Click ID — appended to landing page from ad click |
| `sc_cookie1` | Cookie | Opaque string | Snap cookie for matching |

## Conversions API (Server-Side)

### Endpoint

```
POST https://tr.snapchat.com/v2/conversion
```

### Payload Structure

```json
{
  "pixel_id": "PIXEL_ID",
  "event_type": "PURCHASE",
  "event_conversion_type": "WEB",
  "event_id": "unique-uuid",
  "timestamp": "1710700000000",
  "user_data": {
    "em": "<sha256>",
    "ph": "<sha256>",
    "fn": "<sha256>",
    "ln": "<sha256>",
    "external_id": "<sha256>",
    "sc_click_id": "ScCid_value",
    "sc_cookie1": "snap_cookie_value",
    "client_ip_address": "<sha256>",
    "client_user_agent": "Mozilla/...",
    "ge": "<sha256>",
    "ct": "<sha256>",
    "st": "<sha256>",
    "zp": "<sha256>",
    "country": "<sha256>"
  },
  "custom_data": {
    "price": 49.99,
    "currency": "USD",
    "transaction_id": "order-456",
    "item_ids": ["product-123"],
    "num_items": 1
  }
}
```

## Deduplication

### Mechanism

Two dedup strategies based on event type:

1. **Non-purchase events**: `client_dedup_id` (browser) ↔ `event_id` (CAPI)
   - Window: **48 hours**

2. **Purchase events**: `transaction_id`
   - Window: **30 days**
   - Both browser and CAPI must send the same `transaction_id`

### Requirements

- Dedup IDs must be unique per event occurrence
- `event_type` must match
- Same pixel ID

## Quality / Matching Parameters

| Field | Key | Hashing | Priority |
|-------|-----|---------|----------|
| Email | `em` | SHA-256 (lowercase) | High |
| Phone | `ph` | SHA-256 | High |
| Click ID | `sc_click_id` | No hash | Critical — from `ScCid` URL param |
| Snap Cookie | `sc_cookie1` | No hash | High |
| External ID | `external_id` | SHA-256 | Medium |
| Client IP | `client_ip_address` | SHA-256 | Required for CAPI |
| Client UA | `client_user_agent` | No hash | Required for CAPI |
| First name | `fn` | SHA-256 | Low |
| Last name | `ln` | SHA-256 | Low |

## Standard Events

| Event Name | Category |
|------------|----------|
| `PAGE_VIEW` | Page view |
| `VIEW_CONTENT` | Product view |
| `ADD_CART` | Cart |
| `START_CHECKOUT` | Checkout start |
| `PURCHASE` | Purchase |
| `SEARCH` | Search |
| `ADD_TO_WISHLIST` | Wishlist |
| `SIGN_UP` | Lead gen |
| `SUBSCRIBE` | Lead gen |
| `COMPLETE_TUTORIAL` | Engagement |
| `ADD_BILLING` | Billing |
| `SAVE` | Save |
| `LIST_VIEW` | List view |

## Quality Checks for Traacky

### From Browser Pixel

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Dedup ID present | `client_dedup_id` (non-purchase) or `transaction_id` (purchase) | Critical |
| ScCid captured | `ScCid` in URL or `sc_click_id` in params | High (if from ad click) |
| Value on purchase | `price` + `currency` present | High |
| Pixel ID present | `id` param | Medium |

## References

- [Snapchat Conversions API Parameters](https://developers.snap.com/api/marketing-api/Conversions-API/Parameters)
- [Snapchat Conversions API Best Practices](https://developers.snap.com/api/marketing-api/Conversions-API/BestPractices)
- [Snapchat Event Deduplication](https://businesshelp.snapchat.com/s/article/access-event-deduplication)
