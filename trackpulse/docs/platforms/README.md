# Platform Documentation — Deduplication & Quality Reference

This directory contains per-platform documentation for tracking pixel and server-side API analysis. These docs serve as the source of truth for implementing quality checks in Traacky's `network-quality-auditor`.

## Platform Files

| Platform | File | Browser Pixel | Server-Side API |
|----------|------|---------------|-----------------|
| Meta (Facebook) | [meta.md](meta.md) | `facebook.com/tr/` | Conversions API (CAPI) |
| TikTok | [tiktok.md](tiktok.md) | `analytics.tiktok.com` | Events API |
| Pinterest | [pinterest.md](pinterest.md) | `ct.pinterest.com` | Conversions API |
| Snapchat | [snapchat.md](snapchat.md) | `tr.snapchat.com` | Conversions API |
| LinkedIn | [linkedin.md](linkedin.md) | `px.ads.linkedin.com` | Conversions API |
| Google Ads | [google-ads.md](google-ads.md) | `doubleclick.net/pagead/conversion` | Enhanced Conversions / sGTM |
| GA4 | [ga4.md](ga4.md) | `/g/collect` | Measurement Protocol |

## Cross-Platform Deduplication Summary

| Platform | Dedup Field (Browser) | Dedup Field (Server) | Window | Notes |
|----------|----------------------|---------------------|--------|-------|
| **Meta** | `eid` in `/tr/` | `event_id` | 48h | First event wins |
| **TikTok** | `event_id` in JSON | `event_id` | 48h | First event wins |
| **Pinterest** | `event_id` param | `event_id` | 24h | Shorter window |
| **Snapchat** | `client_dedup_id` / `transaction_id` | `event_id` | 48h / 30d | Different fields for purchase vs other |
| **LinkedIn** | `_linkedin_event_id` global | `eventId` | 90d | **Web event wins** (opposite of others) |
| **Google Ads** | `oid` param | `transaction_id` | permanent | Only for commerce events |
| **GA4** | N/A | N/A | N/A | **No built-in browser/server dedup** — uses `transaction_id` for purchase only |

## Cross-Platform Click IDs

Click IDs are critical for attribution. They're appended to landing page URLs from ad clicks and stored in first-party cookies.

| Platform | URL Param | Cookie | Cookie Expiry |
|----------|-----------|--------|---------------|
| **Meta** | `fbclid` | `_fbc` (click), `_fbp` (browser) | 90d / 2y |
| **TikTok** | `ttclid` | `_ttp` | 13 months |
| **Pinterest** | `epik` | `_epik` | 7d |
| **Snapchat** | `ScCid` | `sc_cookie1` | varies |
| **LinkedIn** | `li_fat_id` | `li_fat_id` | **7d** (very short) |
| **Google Ads** | `gclid` | `_gcl_aw` | 90d |
| **GA4** | N/A | `_ga` | 2y |

## Quality Check Priority (for all platforms)

### Critical (must flag)

1. **Missing dedup ID** — No `event_id`/`eid`/`oid` on conversion events
2. **Missing value/currency** — `purchase`/`checkout` without `value` + `currency`
3. **Duplicate purchase** — Same `transaction_id` fired multiple times

### High (should flag)

4. **Missing click ID cookie** — Platform cookie (`_fbc`, `_ttp`, `_epik`, etc.) absent when traffic comes from that platform's ads
5. **No advanced matching / user data** — No `ud[em]` (Meta), no email hash in any platform
6. **Missing items on commerce events** — `add_to_cart`, `purchase` without product data

### Medium (nice to flag)

7. **Value mismatch cross-platform** — GA4 purchase = $100, Meta purchase = $99.99
8. **Currency mismatch** — Different currencies across platforms for same event
9. **Missing pixel ID** — Request fires but no pixel/measurement ID detected

### Low (informational)

10. **Event name casing** — `Purchase` vs `purchase` (case-sensitive on most platforms)
11. **Timing gap** — Server-side event arrives >5 min after browser event
12. **Rapid-fire duplicates** — Same event within <500ms (client-side only)

## Server-Side Detection

Traacky detects server-side (sGTM) requests by comparing the request hostname's root domain with the page hostname. If they match but subdomains differ, the request likely goes through an sGTM container.

Example: page is `www.example.com`, request goes to `sgtm.example.com` → server-side.

When both client-side and server-side requests are detected for the same platform, deduplication checks become relevant.
