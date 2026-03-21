# Meta (Facebook) — Pixel & Conversions API

## Browser Pixel (fbevents.js)

### Network Request

```
GET/POST https://www.facebook.com/tr/?id={PIXEL_ID}&ev={EVENT_NAME}&...
```

### Key Parameters in `/tr/` Request

| Param | Description | Example |
|-------|-------------|---------|
| `id` | Pixel ID | `1467838850099621` |
| `ev` | Event name | `PageView`, `Purchase`, `Lead` |
| `eid` | Event ID (dedup key) | `abc-123-uuid` |
| `dl` | Document location (page URL) | `https://example.com/page` |
| `rl` | Referrer URL | `https://google.com` |
| `ts` | Timestamp (ms) | `1556212685854` |
| `cd[value]` | Custom data: value | `49.99` |
| `cd[currency]` | Custom data: currency | `USD` |
| `cd[content_ids]` | Custom data: product IDs | `["prod-123"]` |
| `cd[content_type]` | Custom data: content type | `product` |
| `cd[contents]` | Custom data: items JSON | `[{"id":"prod-123","quantity":1}]` |
| `cd[order_id]` | Custom data: order ID | `order-456` |
| `cd[num_items]` | Custom data: item count | `1` |
| `ud[em]` | User data: email (SHA-256) | `309a0a5c3e...` |
| `ud[ph]` | User data: phone (SHA-256) | `254aa248acb...` |
| `ud[fn]` | User data: first name (SHA-256) | `a8cfcd748...` |
| `ud[ln]` | User data: last name (SHA-256) | `2a4e0e7a1...` |
| `ud[external_id]` | User data: external ID (SHA-256) | `abc123hashed` |
| `udff[em]` | Auto advanced matching: email | (hashed) |
| `udff[ph]` | Auto advanced matching: phone | (hashed) |

### Cookies

| Cookie | Format | Purpose |
|--------|--------|---------|
| `_fbp` | `fb.{subdomain}.{creation_ts}.{random}` | Browser ID — persists across sessions |
| `_fbc` | `fb.{subdomain}.{creation_ts}.{fbclid}` | Click ID — created when URL contains `fbclid=` |

### Config Request

```
GET https://connect.facebook.net/signals/config/{PIXEL_ID}?v=2.9.170&r=stable
```

## Conversions API (CAPI)

### Endpoint

```
POST https://graph.facebook.com/v{VERSION}/{PIXEL_ID}/events?access_token={TOKEN}
```

### Payload Structure

```json
{
  "data": [
    {
      "event_name": "Purchase",
      "event_time": 1710700000,
      "event_id": "abc-123-unique",
      "event_source_url": "https://example.com/checkout/thank-you",
      "action_source": "website",
      "user_data": {
        "em": ["<sha256>"],
        "ph": ["<sha256>"],
        "fn": ["<sha256>"],
        "ln": ["<sha256>"],
        "external_id": ["<sha256>"],
        "client_ip_address": "123.45.67.89",
        "client_user_agent": "Mozilla/5.0...",
        "fbp": "fb.1.1558571054389.1098115397",
        "fbc": "fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz"
      },
      "custom_data": {
        "value": 49.99,
        "currency": "USD",
        "content_ids": ["product-123"],
        "content_type": "product",
        "contents": [{"id": "product-123", "quantity": 1}],
        "order_id": "order-456",
        "num_items": 1
      }
    }
  ]
}
```

## Deduplication

### Mechanism

Meta deduplicates events received from **both** the browser pixel and CAPI within a **48-hour window**.

### Primary Method (recommended): `event_id` + `event_name`

- Browser pixel: `eid` parameter in `/tr/` request (set via 4th arg to `fbq('track')`)
- CAPI: `event_id` field in JSON payload
- Both must match exactly (same string) for the same event occurrence
- The `event_id` should be unique per event (e.g., UUID or `{orderID}_{eventName}`)

```javascript
// Browser side
fbq('track', 'Purchase', {value: 12, currency: 'USD'}, {eventID: 'abc-123'});
// → sends eid=abc-123 in /tr/ request

// Server side (CAPI)
{ "event_name": "Purchase", "event_id": "abc-123", ... }
```

### Fallback Method: `fbp` / `external_id` + `event_name`

If no `event_id` is present, Meta attempts dedup using `fbp` or `external_id` + `event_name`. Less reliable.

### Common Dedup Failures

1. **Missing `event_id`** — #1 cause (~80% of failures). No `eventID` in `fbq('track')` 4th arg
2. **Mismatched `event_id`** — Browser and server generate different IDs
3. **Mismatched `event_name`** — Case-sensitive: `Purchase` vs `purchase`
4. **48h window exceeded** — Server event arrives too late
5. **Same-source duplicates** — Meta only deduplicates across pixel+CAPI, not within same source

## Event Match Quality (EMQ)

Scored 0-10. Target: 6+. Below 3 is critical.

### Parameters by Priority

**High Priority:**

| Field | CAPI key | Browser key | Hashing | Notes |
|-------|----------|-------------|---------|-------|
| Email | `em` | `ud[em]` / `udff[em]` | SHA-256 | Highest-priority PII |
| Click ID | `fbc` | `_fbc` cookie | No hash | Contains `fbclid` |

**Medium Priority:**

| Field | CAPI key | Browser key | Hashing | Notes |
|-------|----------|-------------|---------|-------|
| Phone | `ph` | `ud[ph]` / `udff[ph]` | SHA-256 | With country code |
| External ID | `external_id` | `ud[external_id]` | SHA-256 | CRM user ID |
| Browser ID | `fbp` | `_fbp` cookie | No hash | Persistent browser ID |
| Country | `country` | `ud[country]` | SHA-256 | 2-letter lowercase |

**Low Priority:**

| Field | CAPI key | Browser key | Hashing |
|-------|----------|-------------|---------|
| First name | `fn` | `ud[fn]` | SHA-256 |
| Last name | `ln` | `ud[ln]` | SHA-256 |
| City | `ct` | `ud[ct]` | SHA-256 |
| Zip code | `zp` | `ud[zp]` | SHA-256 |

**Always Required for CAPI (not scored but mandatory):**
- `client_ip_address` — real client IP, not server IP
- `client_user_agent` — real client UA
- `event_source_url` — page URL
- `action_source` — must be `"website"` for web events

### Invalid Combos (rejected by Meta)

- `ct` + `country` + `st` + `zp` + `ge` + `client_user_agent` alone
- `db` + `client_user_agent` alone
- `fn` + `ge` alone / `ln` + `ge` alone

## Quality Checks for Traacky

### From Browser Pixel (`/tr/` request)

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Event ID present | `eid` param exists | Critical |
| Advanced matching | Any `ud[*]` or `udff[*]` params | High |
| Email hashed | `ud[em]` or `udff[em]` present | High |
| FBP cookie | `_fbp` cookie exists on page | Medium |
| FBC cookie | `_fbc` cookie exists (if `fbclid` in URL) | Medium |
| Value on purchase | `cd[value]` + `cd[currency]` present | High |
| Content IDs | `cd[content_ids]` or `cd[contents]` on commerce events | Medium |

### Cross-check Browser vs CAPI (sGTM)

| Check | Browser field | CAPI field |
|-------|--------------|------------|
| Event ID match | `eid` | `event_id` |
| Event name match | `ev` | `event_name` (case-sensitive!) |
| Value match | `cd[value]` | `custom_data.value` |
| Currency match | `cd[currency]` | `custom_data.currency` |

## References

- [Deduplication — Meta Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/)
- [CAPI Best Practices — Meta Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/best-practices/)
- [CAPI Parameters — Meta Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters)
- [Advanced Matching — Meta Developers](https://developers.facebook.com/docs/meta-pixel/advanced/advanced-matching/)
- [Event Match Quality — Meta Business Help](https://www.facebook.com/business/help/765081237991954)
