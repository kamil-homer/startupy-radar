import crypto from "node:crypto";

/**
 * Wspólna logika uwierzytelniania: porównanie odporne na ataki czasowe,
 * weryfikacja kodu TOTP (Google Authenticator) oraz podpisywanie/weryfikacja
 * tokenu sesji. Działa na runtime Node.js (proxy w Next 16 + route handlery).
 */

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // Różna długość = od razu false, ale i tak liczymy HMAC, by nie zdradzać
  // długości czasem działania — tu wystarczy szybki zwrot, długości haseł
  // i tak nie są tajne na poziomie pojedynczego bajtu.
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* ------------------------- TOTP (RFC 6238) ------------------------- */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

/**
 * Weryfikuje 6-cyfrowy kod TOTP. `window=1` toleruje ±30 s dryfu zegara.
 */
export function verifyTotp(token: string, base32Secret: string, window = 1): boolean {
  const t = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (timingSafeEqualStr(hotp(secret, counter + i), t)) return true;
  }
  return false;
}

/* --------------------- Token sesji (HMAC-SHA256) --------------------- */

/** Tworzy token `exp.signature` ważny do `expMs` (epoch ms). */
export function signSession(expMs: number, secret: string): string {
  const payload = String(expMs);
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** True, gdy token ma poprawny podpis i nie wygasł. */
export function verifySession(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!timingSafeEqualStr(sig, expected)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}

export const SESSION_COOKIE = "sr_session";
