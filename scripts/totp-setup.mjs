// Generuje sekrety potrzebne do logowania 2FA.
// Uruchom:  node scripts/totp-setup.mjs
//
// Wypisze:
//   - TOTP_SECRET    (sparuj z Google Authenticator: "Enter a setup key"),
//   - SESSION_SECRET (klucz do podpisu ciasteczek sesji),
//   - otpauth:// URI  (do ewentualnego wygenerowania kodu QR lokalnie).
//
// AUTH_PASSWORD wymyślasz sam — najlepiej długie, losowe (np. `openssl rand -base64 24`).

import crypto from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

const totpSecret = base32Encode(crypto.randomBytes(20)); // 160-bit
const sessionSecret = crypto.randomBytes(32).toString("base64url");

const account = "kamil";
const issuer = "Startup Radar";
const uri =
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
  `?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}` +
  `&algorithm=SHA1&digits=6&period=30`;

console.log(`
=== Sekrety logowania 2FA ===

1) TOTP_SECRET (do .env / Vercel ORAZ do Google Authenticator):

   ${totpSecret}

   W Google Authenticator: "+" → "Enter a setup key":
     Account name: ${issuer} (${account})
     Your key:     ${totpSecret}
     Type of key:  Time based

2) SESSION_SECRET (tylko do .env / Vercel):

   ${sessionSecret}

3) AUTH_PASSWORD — wymyśl własne, długie i losowe, np.:

   openssl rand -base64 24

(Opcjonalnie) kod QR z tego URI możesz wygenerować lokalnie, np.:
   qrencode -t ANSIUTF8 "${uri}"

otpauth URI:
   ${uri}
`);
