/**
 * HMAC signature helpers for tamper-detection of cached plan/usage data.
 * Uses Web Crypto API (available in all MV3 extension contexts).
 *
 * NOTE: The key is derived from chrome.runtime.id — this is NOT cryptographically
 * secure against a determined attacker who reverse-engineers the extension code.
 * It prevents trivial bypass via chrome.storage.local.set({tp_plan:'pro'}).
 */

export async function computeSignature(payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(chrome.runtime.id),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function computePlanSignature(plan, email) {
  return computeSignature(`${chrome.runtime.id}:${email || ''}:${plan}`);
}

export async function verifyPlanSignature(plan, email, signature) {
  if (!signature) return false;
  const expected = await computePlanSignature(plan, email);
  return expected === signature;
}

export async function computeUsageSignature(usage) {
  const payload = `usage:${usage.period}:${usage.domains?.length || 0}:${usage.pdfReportsCount || 0}:${usage.funnelAuditsCount || 0}`;
  return computeSignature(payload);
}
