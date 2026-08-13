
# Websocket

## University email verification

UnivCert has been replaced with Resend and server-side verification challenges.

1. Copy `.env.example` to `.env`.
2. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
3. Verify the sender domain in the Resend dashboard. The `from` address must use that verified domain.
4. Add each university's exact email domains to `DEFAULT_UNIVERSITY_DOMAINS` in `src/Group.js`, or override the map with the `UNIVERSITY_DOMAINS` JSON environment variable.
5. Start the server with `npm start`.

Verification codes are generated with `crypto.randomInt`, stored as HMAC values, expire after five minutes, allow five attempts, and can be resent once per minute per email and socket IP. The current storage is process-local; use Redis before running multiple server instances.

