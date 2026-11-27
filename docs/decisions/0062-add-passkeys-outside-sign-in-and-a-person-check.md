# 0062. Add passkeys, Google and Microsoft sign-in, and Cloudflare Turnstile on public forms

- **Status:** Accepted
- **Date:** 2026-11-26
- **Extends:** decision record [0024](0024-own-sign-in.md) (the site's own sign-in) and [0055](0055-limit-scripts-and-framing-with-security-headers.md) (the Content Security Policy)

## Context

Passkeys and Google and Microsoft sign-in waited for the project's own domain, because a passkey and a provider's redirect address are both tied to one domain. The site moved to `triballawproject.org` on Nov. 25, 2026. On Nov. 26, 2026 Trevor Goldsmith asked to set these up, "including turnstile", Cloudflare's check that a form was sent by a person. He chose the mockup that keeps email and password first on the sign-in form, with the other ways under "or" (design/sign-in-providers, mockup B), and later the same day deferred Google and Microsoft while keeping what was built for them.

## Decision

- **Passkeys** (WebAuthn, through `@simplewebauthn/server` and `@simplewebauthn/browser`). The relying party is the site's host name. Passkeys are discoverable and must verify the person, so a passkey sign-in counts as both steps of sign-in, which NIST SP 800-63B-4 treats as a multi-factor, phishing-resistant authenticator. Only public keys are kept. Adding one needs a sign-in from the last 10 minutes, as two-step sign-in does.
- **Google and Microsoft** (OpenID Connect code flow with PKCE, through `oauth4webapi`). The provider only vouches for who the person is; the session is the site's own and access is still decided by the `people` table. Accounts are matched by the provider's stable identifier, and joined by email address the first time only when the provider confirms the person owns it. Each provider stays off until its client identifier and secret are set. Two-step sign-in still asks for the app's code after them.
- **Turnstile** on sign-in, Create an account, Forgot your password, the request form and Report a problem, in managed mode and shown only when Cloudflare is unsure. The Worker checks every token with Siteverify, including which form it came from and the host name, and fails closed. Typing an emailed code is not checked.
- **Secrets.** `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET` and `MICROSOFT_CLIENT_SECRET` are Worker secrets set in the dashboard. The project prefers Secrets Store bindings, but a deploy with a Secrets Store binding fails until the Workers Builds token has Secrets Store Edit (pull request #302), so these move with the site's other keys once that lands. Site keys and client identifiers are public and kept in `wrangler.jsonc`.

## Consequences

- With Turnstile on, the guarded forms need scripts, unlike the rest of the site. Without the widget's token the form is refused with a message.
- The Content Security Policy allows scripts from `https://challenges.cloudflare.com`.
- The `sessions` table was made again to allow the new sign-in methods (`passkey`, `google`, `microsoft`); its rows were kept.
- Google and Microsoft's logos appear on their buttons, as both providers' button guidelines require, served as files from `static/sign-in/` rather than as Lucide icons.
- A Microsoft client secret lasts at most 24 months and must be replaced before it runs out.

## Sources

- National Institute of Standards and Technology, *Digital Identity Guidelines: Authentication and Authenticator Management*, NIST SP 800-63B-4 (2025), sections 2.2, 3.1.7 and 3.2.5.
- W3C, *Web Authentication: An API for accessing Public Key Credentials, Level 3*, https://www.w3.org/TR/webauthn-3/.
- OpenID Foundation, *OpenID Connect Core 1.0*, section 3.1, https://openid.net/specs/openid-connect-core-1_0.html.
- Cloudflare, "Validate the token," Turnstile documentation, https://developers.cloudflare.com/turnstile/get-started/server-side-validation/.
- Microsoft, "Optional claims reference" (`xms_edov`), Microsoft identity platform documentation, https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference.
