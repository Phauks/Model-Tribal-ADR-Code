import { error } from "@sveltejs/kit";
import { biographies, biographyPage } from "#lib/server/biographies.ts";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const entries: EntryGenerator = () =>
  biographies().map((person) => ({ person: person.key }));

export const load: PageServerLoad = ({ params }) => {
  const page = biographyPage(params.person);
  if (!page) error(404, "This site has no page for that person.");
  return page;
};
