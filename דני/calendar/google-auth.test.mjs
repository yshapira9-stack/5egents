import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signJwt } from "./google-auth.mjs";

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

test("signJwt produces a JWT verifiable with the matching public key", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const now = 1_800_000_000; // fixed timestamp for a deterministic test
  const token = signJwt({ clientEmail: "svc@example.iam.gserviceaccount.com", privateKey, now });
  const [headerB64, claimsB64, sigB64] = token.split(".");

  const header = JSON.parse(base64urlDecode(headerB64));
  assert.deepEqual(header, { alg: "RS256", typ: "JWT" });

  const claims = JSON.parse(base64urlDecode(claimsB64));
  assert.equal(claims.iss, "svc@example.iam.gserviceaccount.com");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/calendar");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.iat, now);
  assert.equal(claims.exp, now + 3600);

  const unsigned = `${headerB64}.${claimsB64}`;
  const verified = crypto
    .createVerify("RSA-SHA256")
    .update(unsigned)
    .verify(publicKey, sigB64, "base64url");
  assert.equal(verified, true);
});
