# Front matter

Pages that open the book and appear on the website's About pages, written once here. The book prints each file after the contents, before Part I (`pdf/pipeline/book.mjs`), and the website shows each at its own address, such as `/acknowledgments` (`site/src/lib/server/front-matter.ts`).

Each file is Markdown with YAML front matter giving `id`, `title` and the `sources` it cites. Cite with `[@key]` as anywhere else (`docs/citation-style.md`).

`credits.md` is not written by hand. The lead author downloads it from the workspace Contributors page before each edition; it lists the credits people confirmed for the book and prints after the Acknowledgments. It does not appear on the website, which lists contributors live at `/contributors` (`docs/contributor-profiles.md`).
