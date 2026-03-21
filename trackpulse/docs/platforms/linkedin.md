# LinkedIn — Insight Tag & Conversions API

## Browser Insight Tag

### Network Requests

Main tracking:
```
GET https://px.ads.linkedin.com/collect?pid={PARTNER_ID}&conversionId={ID}&fmt=js&url=...
GET https://px4.ads.linkedin.com/collect?...
```

Legacy:
```
GET https://dc.ads.linkedin.com/collect?...
```

Beacon endpoint (JSON POST):
```
POST https://www.linkedin.com/li/track
```

Cookie sync:
```
https://www.linkedin.com/px/li_sync
```

Firmographic enrichment:
```
https://sjs.bizographics.com/...
```

SDK script:
```
https://snap.licdn.com/li.lms-analytics/insight.min.js
```

### Key Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `pid` | Partner ID | `123456` |
| `conversionId` | Conversion ID | `7890123` |
| `url` | Page URL (encoded) | `https%3A//example.com/page` |
| `fmt` | Format | `js` |

### Globals & Cookie

| Identifier | Type | Purpose |
|------------|------|---------|
| `_linkedin_data_partner_id` | JS global | Partner ID |
| `_linkedin_event_id` | JS global | Event ID for dedup (set before conversion) |
| `li_fat_id` | First-party cookie + URL param | First-party ads tracking UUID |

**Important:** `li_fat_id` cookie has a **7-day expiry**, limiting match rates significantly.

## Conversions API (Server-Side)

### Endpoint

```
POST https://api.linkedin.com/rest/conversionEvents
```

### Payload Structure

```json
{
  "conversion": "urn:lla:llaPartnerConversion:{CONVERSION_ID}",
  "conversionHappenedAt": 1710700000000,
  "eventId": "unique-uuid",
  "user": {
    "userIds": [
      {
        "idType": "SHA256_EMAIL",
        "idValue": "<sha256>"
      },
      {
        "idType": "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID",
        "idValue": "li_fat_id_value"
      }
    ],
    "userInfo": {
      "firstName": "John",
      "lastName": "Doe",
      "companyName": "Acme",
      "title": "CTO",
      "countryCode": "US"
    }
  },
  "conversionValue": {
    "currencyCode": "USD",
    "amount": "49.99"
  }
}
```

## Deduplication

### Mechanism

- Field: `eventId` (CAPI) ↔ `_linkedin_event_id` (browser global)
- Window: `conversionHappenedAt` must be within past **90 days**
- **Priority: web event wins** — if same `eventId` arrives via both Insight Tag and CAPI, the CAPI event is discarded
- This is the opposite of Meta (where first event wins regardless of source)

### Requirements

- `eventId` must be set in browser via `window._linkedin_event_id = 'uuid'` before conversion fires
- Same `eventId` must be sent in CAPI payload
- Same conversion rule (conversion ID)

## Quality / Matching Parameters

| Field | idType (CAPI) | Browser | Hashing | Priority |
|-------|---------------|---------|---------|----------|
| Email | `SHA256_EMAIL` | N/A | SHA-256 (lowercase) | High |
| LI FAT ID | `LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID` | `li_fat_id` cookie | No hash | Critical — but 7-day expiry |
| Acxiom ID | `ACXIOM_ID` | N/A | No hash | Low |
| Oracle MOAT ID | `ORACLE_MOAT_ID` | N/A | No hash | Low |

**Minimum requirement:** At least one valid `userId` — either `SHA256_EMAIL` or `LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID`.

## Standard Events

LinkedIn uses conversion rules rather than standard event names. Event types are:

| Type | Category |
|------|----------|
| `conversion` | When `conversionId` is present in Insight Tag request |
| `pageview` | Default Insight Tag fire (no `conversionId`) |
| `cookie_sync` | `/px/li_sync` endpoint |
| `firmographic_enrichment` | `sjs.bizographics.com` call |

## Quality Checks for Traacky

### From Browser Insight Tag

| Check | What to look for | Severity |
|-------|-----------------|----------|
| Event ID present | `_linkedin_event_id` global set before conversion | Critical |
| LI FAT ID cookie | `li_fat_id` cookie exists | High |
| Partner ID | `pid` param present | Medium |
| Conversion ID | `conversionId` param for conversion events | Medium |

### Limitations

- LinkedIn's Insight Tag doesn't send user data (email, etc.) in the browser request — all PII goes through CAPI only
- `li_fat_id` 7-day expiry means most returning users won't have it
- No enhanced matching equivalent in the browser-side tag

## References

- [LinkedIn Conversions API Deduplication](https://learn.microsoft.com/en-us/linkedin/marketing/conversions/deduplication)
- [LinkedIn Conversions API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/conversions-api)
- [LinkedIn Conversions API Best Practices](https://www.linkedin.com/help/lms/answer/a5538676)
