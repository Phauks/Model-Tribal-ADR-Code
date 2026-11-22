/**
 * A cookie that tells the site's pages, which are built ahead of time and
 * cannot ask the Worker who is signed in, to show "Workspace" in the masthead
 * instead of "Sign in". It holds no name, role or token: only "1". The
 * session itself stays in its own HTTP-only cookie (src/lib/server/sign-in.ts), and every
 * workspace page still checks it (src/hooks.server.ts). If the hint outlives
 * the session, the "Workspace" link leads to the sign-in page, which is where
 * "Sign in" would have led.
 */
export const signedInHintCookie = 'signed-in-hint';

/** The longest a session lasts (site/COLLABORATION.md): 12 hours. */
export const signedInHintLifetimeSeconds = 12 * 60 * 60;
