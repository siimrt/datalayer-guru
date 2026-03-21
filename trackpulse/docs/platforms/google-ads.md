# Google Ads — Conversion Tag & Enhanced Conversions

## Browser Conversion Tag

### Network Requests

Standard conversion:
```
GET https://googleads.g.doubleclick.net/pagead/conversion/{AW_ID}/?label={LABEL}&value={VALUE}&currency_code={CURRENCY}&oid={ORDER_ID}
GET https://googleadservices.com/pagead/conversion/{AW_ID}/?...
```

View-through conversion:
```
GET https://googleads.g.doubleclick.net/pagead/viewthroughconversion/{AW_ID}/?...
```

Enhanced conversions user data:
```
POST https://google.com/pagead/form-data/
```

### Key Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `{AW_ID}` in path | Conversion account ID | `123456789` → `AW-123456789` |
| `label` / `gtm_label` | Conversion label | `AbCdEfGhIjKlMnOp` |
| `value` | Conversion value | `49.99` |
| `currency_code` | Currency | `USD` |
| `oid` | Order ID / Transaction ID (dedup key) | `order-456` |
| `aw_remarketing_only` | If `1`, this is remarketing not conversion | `0` or `1` |

### Enhanced Conversions Data

When enhanced conversions are enabled, user data is sent in a separate request or embedded in the conversion request:

| Param | Description | Format |
|-------|-------------|--------|
| `em` | Email | SHA-256, prefixed `tv.1~em.{hash}` |
| `ph` | Phone | SHA-256 |
| `fn` | First name | SHA-256 |
| `ln` | Last name | SHA-256 |
| `sa` | Street address | SHA-256 |
| `ct` | City | SHA-256 |
| `rg` | Region/state | SHA-256 |
| `pc` | Postal code | SHA-256 |
| `co` | Country | SHA-256 |

### Cookie & Click ID

| Identifier | Type | Format | Purpose |
|------------|------|--------|---------|
| `gclid` | URL parameter | Alphanumeric | Google Click ID — appended to landing page from ad click |
| `_gcl_aw` | First-party cookie | `GCL.{ts}.{gclid}` | Stores gclid for cross-page attribution |
| `_gcl_dc` | First-party cookie | Similar to `_gcl_aw` | DoubleClick variant |
| `wbraid` | URL parameter | Alphanumeric | Web-to-app attribution (iOS) |
| `gbraid` | URL parameter | Alphanumeric | App-to-web attribution (iOS) |

## Server-Side (sGTM / Measurement Protocol)

Google Ads conversions are typically sent server-side via sGTM (Server-Side Google Tag Manager), not a direct API. The sGTM container receives the client-side gtag hit and forwards it to Google Ads.

### Offline Conversion Import (API)

```
POST https://googleads.googleapis.com/v{VERSION}/customers/{CUSTOMER_ID}/uploadConversionAdjustments
```

Payload includes `gclid` or `gbraid`/`wbraid`, `conversion_action`, `order_id`, `adjustment_type`, user identifiers.

## Deduplication

### Mechanism

- Field: `oid` (order_id / transaction_id)
- Must be identical between browser tag and server upload
- If two conversions for the same conversion action share the same `oid`, the duplicate is discarded
- Window: effectively **permanent** for the conversion action
- Max 64 characters (numbers, letters, dashes, spaces)

### Key Difference from Other Platforms

Google Ads uses `transaction_id`/`order_id` rather than a generic `event_id`. This means:
- Dedup only applies to commerce events that have an order ID
- Non-commerce conversions (lead, sign up) need a unique transaction ID generated at event time
- If no `oid` is sent, no deduplication occurs

## Quality / Enhanced Conversion Parameters

**Minimum requirement:** At least one of: (a) email, (b) full name + address.

| Field | Param | Hashing | Priority |
|-------|-------|---------|----------|
| Email | `em` | SHA-256 | High — most impactful |
| Phone | `ph` | SHA-256 | High |
| First name | `fn` | SHA-256 | Medium (needs address) |
| Last name | `ln` | SHA-256 | Medium (needs address) |
| Street | `sa` | SHA-256 | Low (with name) |
| City | `ct` | SHA-256 | Low |
| Region | `rg` | SHA-256 | Low |
| Postal code | `pc` | SHA-256 | Low |
| Country | `co` | SHA-256 | Low |

### GCLID Attribution

The `gclid` is the most important signal for Google Ads:
- Captured from landing page URL param
- Stored in `_gcl_aw` cookie
- Sent in conversion request for click attribution
- Without `gclid`, Google Ads relies on modeled conversions (less accurate)

## Standard Events

Google Ads doesn't have standard event names like Meta/TikTok. Events are identified by:

| Signal | Category |
|--------|----------|
| `conversion/{label}` | Standard conversion |
| `viewthroughconversion/{AW_ID}` | View-through conversion |
| `aw_remarketing_only=1` | Remarketing (not conversion) |

## Quality Checks for Traacky

### From Browser Tag

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Order ID present | `oid` param on conversion requests | Critical |
| Enhanced conversions | `em` param with `tv.1~em.` prefix, or `/form-data/` request | High |
| GCLID captured | `gclid` in page URL or `_gcl_aw` cookie | High |
| Value present | `value` + `currency_code` on conversion | High |
| Conversion label | `label` param present | Medium |
| Not remarketing-only | `aw_remarketing_only` is `0` or absent | Low |

### Cross-check Browser vs Server (sGTM)

| Check | Browser field | Server field |
|-------|--------------|-------------|
| Order ID match | `oid` | `transaction_id` / `order_id` |
| Value match | `value` | `conversion_value` |
| Currency match | `currency_code` | `currency_code` |
| GCLID forwarded | `_gcl_aw` cookie | `gclid` in server payload |

## References

- [Google Ads Transaction ID Deduplication](https://support.google.com/google-ads/answer/6386790)
- [Google Ads Enhanced Conversions for Web](https://support.google.com/google-ads/answer/13258081)
- [Enhanced Conversions API Setup](https://developers.google.com/google-ads/api/docs/conversions/enhanced-conversions/web-setup)
- [Google Click ID (GCLID)](https://support.google.com/google-ads/answer/9744275)
