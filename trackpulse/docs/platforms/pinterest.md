# Pinterest — Tag & Conversions API

## Browser Tag

### Network Requests

```
GET https://ct.pinterest.com/v3/?event={EVENT}&tid={TAG_ID}&...
```

SDK script:
```
https://s.pinimg.com/ct/core.js
```

Tracking:
```
https://trk.pinterest.com/...
```

### Key Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `event` | Event name | `pagevisit`, `checkout`, `addtocart` |
| `tid` | Tag/Pixel ID | `2612345678901` |
| `ed` | Event data (JSON-encoded) | `{"value":49.99,"currency":"USD"}` |
| `pd[em]` | Enhanced match: email (SHA-256) | `309a0a5c3e...` |
| `event_id` | Event ID (dedup key) | `uuid-string` |

### Cookie & Click ID

| Identifier | Type | Format | Purpose |
|------------|------|--------|---------|
| `_epik` | First-party cookie | Opaque string | Pinterest click ID |
| `epik` | URL parameter | Alphanumeric | Click ID — appended to landing page from ad click |

## Conversions API (Server-Side)

### Endpoint

```
POST https://api.pinterest.com/v5/ad_accounts/{AD_ACCOUNT_ID}/events
```

### Payload Structure

```json
{
  "data": [
    {
      "event_name": "checkout",
      "event_id": "unique-uuid",
      "event_time": 1710700000,
      "event_source_url": "https://example.com/thank-you",
      "action_source": "web",
      "user_data": {
        "em": ["<sha256>"],
        "ph": ["<sha256>"],
        "click_id": "epik_value",
        "client_ip_address": "123.45.67.89",
        "client_user_agent": "Mozilla/...",
        "external_id": ["<sha256>"],
        "partner_id": "ss-partnername"
      },
      "custom_data": {
        "value": "49.99",
        "currency": "USD",
        "content_ids": ["product-123"],
        "contents": [{"id": "product-123", "quantity": 1, "item_price": "49.99"}],
        "num_items": 1,
        "order_id": "order-456"
      }
    }
  ]
}
```

## Deduplication

### Mechanism

- Field: `event_id` — must match between browser Tag and Conversions API
- Window: **24 hours** from first event
- Requires: non-empty `event_id` + `event_name`
- `action_source` must not be `offline`

### Requirements

- `event_id` unique per event occurrence
- `event_name` must match (case-sensitive)
- Same ad account

## Quality / Matching Parameters

| Field | Key | Hashing | Priority |
|-------|-----|---------|----------|
| Email | `em` | SHA-256 | High |
| Phone | `ph` | SHA-256 | High |
| Click ID | `click_id` | Auto-hashed by API | Critical — from `_epik` cookie |
| Client IP | `client_ip_address` | No hash | Required for CAPI |
| Client UA | `client_user_agent` | No hash | Required for CAPI |
| External ID | `external_id` | SHA-256 | Medium |
| Partner ID | `partner_id` | No hash | For sGTM (`ss-partnername`) |

**Minimum requirement:** At least one of: `em`, `hashed_maids`, or `client_ip_address` + `client_user_agent`.

## Standard Events

| Event Name | Category |
|------------|----------|
| `pagevisit` | Page view |
| `viewcategory` | Category view |
| `search` | Search |
| `addtocart` | Cart |
| `checkout` | Purchase |
| `signup` | Lead gen |
| `lead` | Lead gen |
| `watchvideo` | Engagement |
| `custom` | Custom event |

## Quality Checks for Traacky

### From Browser Tag

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Event ID present | `event_id` param in request | Critical |
| Enhanced match | `pd[em]` present | High |
| EPIK cookie | `_epik` cookie exists on page | High (if from ad click) |
| Value on checkout | `ed` contains `value` + `currency` | High |
| Content IDs | `ed` contains `content_ids` on commerce events | Medium |
| Tag ID present | `tid` param | Medium |

## References

- [Pinterest Conversions API](https://help.pinterest.com/en/business/article/the-pinterest-api-for-conversions)
- [Pinterest Conversions Best Practices](https://developers.pinterest.com/docs/conversions/best/)
- [Pinterest Tag Parameters & Cookies](https://help.pinterest.com/en/business/article/pinterest-tag-parameters-and-cookies)
- [Pinterest Enhanced Match](https://help.pinterest.com/en/business/article/enhanced-match)
