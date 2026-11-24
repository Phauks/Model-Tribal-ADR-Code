import { biographies, biographyPage } from "#lib/server/biographies.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
  people: biographies().map((person) => {
    const page = biographyPage(person.key)!;
    return {
      key: person.key,
      name: person.name,
      lead: person.lead,
      nations: page.nations,
      cases: page.cases.length,
    };
  }),
});
