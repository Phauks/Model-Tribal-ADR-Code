# Pages about the site

The pages here, such as the About page (`about.md`, shown at `/about`) and the Sponsorship page (`sponsor.md`, shown at `/sponsor`), are edited on the website like the essays (`docs/editing.md`). Each says `part: about` in its front matter.

The text in git is where each page starts. A site build brings changed git text into the website copy as a draft, and readers see the newest version someone with full access has published. Until a page is first published, readers see the git text.

Each page keeps the address it has always had, so a new page about the site needs its own route in `site/src/routes/` and an entry in `aboutPageAddresses` in `site/src/lib/server/essays.ts`. Pages about the site cannot be started from the workspace.
