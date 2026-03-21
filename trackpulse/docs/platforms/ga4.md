# GA4 — gtag.js & Measurement Protocol

## Browser (gtag.js)

### Network Requests

```
POST https://www.google-analytics.com/g/collect?...
POST https://analytics.google.com/g/collect?...
GET  https://region1.google-analytics.com/g/collect?...
```

Also matched by:
```
/g/collect?.*tid=G-
```

### Key Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `tid` | Measurement ID | `G-XXXXXXXXXX` |
| `en` | Event name | `page_view`, `purchase`, `add_to_cart` |
| `ep.*` | Event parameter (string) | `ep.page_title=Home` |
| `epn.*` | Event parameter (numeric) | `epn.value=49.99` |
| `tr` | Revenue / transaction revenue | `49.99` |
| `tt` | Transaction ID | `order-456` |
| `cu` | Currency | `USD` |
| `cid` | Client ID | `1234567890.1234567890` |
| `uid` | User ID (if set) | `user-abc-123` |
| `sid` | Session ID | `1234567890` |
| `dl` | Document location | `https://example.com/page` |
| `dr` | Document referrer | `https://google.com` |
| `dt` | Document title | `Home Page` |

### Product / Item Parameters

**Verbose format:**
| Param | Description |
|-------|-------------|
| `pr{N}id` | Product N ID |
| `pr{N}nm` | Product N name |
| `pr{N}pr` | Product N price |
| `pr{N}qt` | Product N quantity |
| `pr{N}br` | Product N brand |
| `pr{N}ca` | Product N category |
| `pr{N}va` | Product N variant |

**Compact tilde-delimited format:**
```
pr1=nmProduct%20Name~id123~pr49.99~brBrand~caCat
```

### Cookie

| Cookie | Format | Purpose |
|--------|--------|---------|
| `_ga` | `GA1.{domain-levels}.{client-id}` | Client ID — persistent browser ID |
| `_ga_{CONTAINER}` | `GS1.1.{session-data}` | Session-specific data |

## Measurement Protocol (Server-Side)

### Endpoint

```
POST https://www.google-analytics.com/mp/collect?measurement_id={MID}&api_secret={SECRET}
```

### Payload Structure

```json
{
  "client_id": "1234567890.1234567890",
  "user_id": "user-abc-123",
  "events": [
    {
      "name": "purchase",
      "params": {
        "transaction_id": "order-456",
        "value": 49.99,
        "currency": "USD",
        "items": [
          {
            "item_id": "product-123",
            "item_name": "Widget",
            "price": 49.99,
            "quantity": 1
          }
        ]
      }
    }
  ]
}
```

## Deduplication

### GA4 Does NOT Have Built-in Browser/Server Dedup

Unlike Meta, TikTok, etc., GA4 does **not** natively deduplicate between gtag.js and Measurement Protocol events. They are treated as separate hits.

### Strategies to Avoid Double-Counting

1. **Send only from server** — remove the gtag.js event and only fire via Measurement Protocol (sGTM)
2. **Use `transaction_id`** — GA4 deduplicates `purchase` events with the same `transaction_id` within a session
3. **Block client-side event** — use GTM logic to prevent the browser tag from firing when sGTM is handling it

### What Traacky Should Check

Since GA4 doesn't deduplicate automatically:
- Flag if the **same event name** fires from both client-side (`/g/collect`) and server-side (different subdomain → sGTM) without clear dedup strategy
- Check if `purchase` events have `transaction_id` (`tt` param)
- Check for duplicate `purchase` events with same `tt` value

## Key Parameters for Quality

### E-commerce Events

| Event | Required Params | Recommended Params |
|-------|-----------------|--------------------|
| `view_item` | `items[].item_id` | `currency`, `value` |
| `add_to_cart` | `items[].item_id`, `items[].quantity` | `currency`, `value` |
| `begin_checkout` | `items[].item_id` | `currency`, `value`, `coupon` |
| `purchase` | `transaction_id`, `value`, `currency`, `items[].item_id` | `tax`, `shipping`, `coupon` |

### Item Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `item_id` | Yes | Product SKU/ID |
| `item_name` | Yes | Product name |
| `price` | Recommended | Unit price |
| `quantity` | Recommended | Quantity |
| `item_brand` | Optional | Brand |
| `item_category` | Optional | Category |
| `item_variant` | Optional | Variant |
| `discount` | Optional | Discount amount |

## Quality Checks for Traacky

### From Browser (gtag.js `/g/collect`)

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Transaction ID on purchase | `tt` param present | Critical |
| Value on purchase | `tr` + `cu` params present | Critical |
| Items on commerce events | `pr1id` or `pr1` tilde-format present | High |
| Client ID format | `cid` matches `{digits}.{digits}` pattern | Medium |
| Measurement ID | `tid` starts with `G-` | Medium |
| Currency consistency | `cu` same across all events on page | Medium |

### Duplicate Detection

| Check | Description | Severity |
|-------|------------|----------|
| Same event name client+server | `en` fired from both `/g/collect` and sGTM domain | Warning |
| Duplicate transaction_id | Same `tt` in multiple `purchase` events | Critical |
| Rapid-fire same event | Same `en` within <500ms | Warning |

## References

- [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [GA4 E-commerce Events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
- [GA4 Recommended Events](https://support.google.com/analytics/answer/9267735)
- [GA4 Event Parameters](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference)
