# Icon pack comparison

- **Date:** Nov. 21, 2026
- **Question:** Which icon pack should the website (SvelteKit) and the book
  (Typst and EPUB) use? The theme setting was to become a sun-or-moon button.
- **Outcome:** Lucide, chosen by Trevor on Nov. 21, 2026. Recorded in
  [site/DESIGN.md](../../../site/DESIGN.md), section 6.

## Method

1. Downloaded each pack's published npm package and read its license file:
   `lucide-static` 1.77.0, `@tabler/icons` 3.52.0, `@phosphor-icons/core`
   2.1.1, `heroicons` 2.2.0, `@material-symbols/svg-400` 0.49.0, `iconoir`
   7.12.2 and `remixicon` 4.9.1.
2. Looked up the same 19 icons in each pack: sun, moon, map pin, phone,
   external link, flag (report a problem), search, menu, sign in, user,
   document, book, download, share, scales, handshake, people, gavel and
   calendar.
3. Read each pack's Svelte package metadata with `npm view` (version, release
   date, `peerDependencies`, `sideEffects`) and its README.
4. Measured the stem of Atkinson Hyperlegible Next from `pdf/fonts/` by
   rendering the letter n at 1,000 units per em: Regular 84 units, SemiBold
   123. Compared that with each pack's stroke from its SVG files.
5. Rendered three Lucide SVGs beside Atkinson Hyperlegible Next with Typst
   0.15.2 to confirm print reuse.

## Findings

| Pack | Of 19 icons | License | Svelte 5 package |
| --- | --- | --- | --- |
| Lucide | 19 | ISC; MIT for Feather-derived icons | Official, `@lucide/svelte` |
| Tabler | 18, plus a handshake with a heart | MIT | Official, `@tabler/icons-svelte-runes` |
| Phosphor | 19 | MIT | Community, `phosphor-svelte` |
| Heroicons | 17; no handshake or gavel | MIT | None; React and Vue only |
| Material Symbols | 19 | Apache 2.0 | None |
| Iconoir | 16; no scales, handshake or gavel | MIT | None |

Remix Icon was left out: its 2026 "Remix Icon License v1.0" is a custom
license that bars use as a logo and use to build another icon library.

Icons that read as Native imagery and must not be used: Lucide `feather`,
`tent`, `tent-tree`, `bow-arrow`; Tabler `feather`, `tent`, `campfire`;
Phosphor `tipi`, `feather`, `tent`, `campfire`.

The full comparison, with every icon drawn in each pack in light and dark, is
in a project artifact: https://claude.ai/artifact/KeK5fmLBaZbVaTy4u4FbWb

## Sources

- Lucide, *License*, https://lucide.dev/license (accessed Nov. 21, 2026).
- Lucide, *Lucide for Svelte*, https://lucide.dev/guide/svelte (accessed Nov. 21, 2026).
- Lucide, *Stroke width* (Svelte), https://lucide.dev/guide/svelte/basics/stroke-width (accessed Nov. 21, 2026).
- Lucide, *Icon design guide*, https://lucide.dev/guide/design/icon-design-guide (accessed Nov. 21, 2026).
- Tabler, *Tabler Icons for Svelte*, https://docs.tabler.io/icons/libraries/svelte (accessed Nov. 21, 2026).
- Phosphor Icons, `@phosphor-icons/core` README and LICENSE, https://github.com/phosphor-icons/core (package 2.1.1).
- Tailwind Labs, Heroicons README and LICENSE, https://github.com/tailwindlabs/heroicons (package 2.2.0).
- Google, *Material Symbols guide*, https://developers.google.com/fonts/docs/material_symbols (accessed Nov. 21, 2026).
- Iconoir, https://iconoir.com (accessed Nov. 21, 2026).
- Remix Design, *Remix Icon License v1.0*, in the `remixicon` 4.9.1 package.
- Typst, *image*, https://typst.app/docs/reference/visualize/image/ (accessed Nov. 21, 2026).
