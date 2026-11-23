# 0045. Keep display settings on the device and account settings on Account pages

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

By Nov. 23, 2026 the website had choices in several places. The Settings dialog under the cog held reading settings (text, colors, motion, citations, glossary) and the reader's saved data, all kept in the browser. The account menu held "Your profile", "Following" and "Password". The email choice for followed pages sat at the bottom of the Following page. Account deletion was a section of the profile page. More were coming from other threads: profile pictures and public contributor pages, two-step sign-in, nation teams, the project inbox and offline downloads.

Trevor Goldsmith noted that account settings differ from display and usage settings and asked how to separate and show them. Three layouts were mocked up in the project thread: the cog for display choices with separate Account pages, one Settings page holding both, or everything in the cog's dialog.

## Decision

Trevor chose the first layout ("Gear for screen, Account pages").

- **Settings** (the cog) holds how the site looks and works on the screen in front of you. Everyone has it, signed in or not. Choices are kept on the device, apply at once and work offline. Its sections are Text, Colors, Motion, Citations, Glossary, Editing (only for people with workspace access) and This device (renamed from Data, so it is not taken for "Your data").
- **Account** holds who you are to the project and what it keeps about you. It is only for signed-in people, kept with the account on the server, and changed with a Save button. Its pages are Overview (`/account`), Profile and credit (`/profile`), Your uploads (`/uploads`), Sign-in and security (`/account/security`), Email and notifications (`/account/email`) and Your data (`/account/data`), listed under "Your account" in the left sidebar on those pages. The account menu links to them as "Account settings"; the Password item moved to Sign-in and security.
- **The test for a new choice.** If other people see it, or the project keeps it or acts on it, it goes in Account. If it only changes what you see on this screen, it goes in Settings. So your own color while editing together would go in Account, and whether you see other people's cursors goes in Settings.
- **Tools for project work** keep their own settings beside the tool in the workspace (for example the inbox's signature and send time), so Account stays about the person.
- **Settings on every device.** A signed-in person can turn on "Use these settings on every device I sign in on" in This device. A copy of the settings and theme is then kept with the account (`account_settings`) and replaces another device's settings after sign-in. Starred pages, print choices and pages saved for offline stay on each device. The device's own copy is still what paints the page first, so nothing flickers and offline reading is unchanged.

## Consequences

- New pages: `/account`, `/account/security` (password, and where you are signed in, with sign-out for other devices), `/account/email` (the email choice moved from `/following`), `/account/data` (download my data, a link to delete the account) and `/account/settings` (the copy of settings, used only by the site's script). Migration `0019_account_settings.sql` adds `account_settings` and a `device` column on `sessions` holding only words such as "Firefox on Windows".
- Two settings join Settings: "Groups in long Sources lists" (Folded or Open) under Citations, and "Other people's cursors" (with names, without names, or hidden) under Editing.
- Two-step sign-in, nation teams and the inbox's settings are not built here. Their places are set: Sign-in and security, a Nation team page in the Your account group, and Workspace, Inbox.
- Your own cursor color is left for the essay editor's thread to add to Profile and credit; the editor still picks a color at random.

## Sources

- Trevor Goldsmith, project thread "Organize account and display settings", 2026-11-23 (message "There are differences between account settings and UI and usage settings. We should identify how to properly delineate and show these"; decision card answer "Gear for screen, Account pages").
