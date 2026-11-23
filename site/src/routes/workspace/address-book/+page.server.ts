import { fail } from "@sveltejs/kit";
import {
  cleanTag,
  contactKinds,
  methodLabels,
  sourceKinds,
  stalenessOf,
  today,
  type ContactKind,
  type MethodLabel,
  type SourceKind,
} from "#lib/address-book.ts";
import {
  addContact,
  addContactMethod,
  listContacts,
  refreshFromDirectories,
} from "#lib/server/address-book.ts";
import { formText, requirePermission, storage } from "#lib/server/workspace.ts";
import { nations, nationTitles } from "./nations.ts";
import type { Actions, PageServerLoad } from "./$types";

const views = ["all", "stale", "no-email", "people", "organizations"] as const;
type View = (typeof views)[number];

export const load: PageServerLoad = async (event) => {
  requirePermission(event, "manage-address-book");
  const { database } = storage(event);
  const requested = event.url.searchParams.get("show") as View | null;
  const show: View = requested && views.includes(requested) ? requested : "all";
  const tag = cleanTag(event.url.searchParams.get("tag") ?? "");
  const day = today();
  const contacts = await listContacts(database);
  const names = new Map(
    contacts.map((contact) => [contact.identifier, contact.name]),
  );
  const tags = [...new Set(contacts.flatMap((contact) => contact.tags))].sort();

  const rows = contacts.map((contact) => {
    const inUse = contact.methods.filter(
      (method) => method.status === "current",
    );
    const emails = inUse.filter((method) => method.method === "email");
    const email =
      emails.find((method) => method.preferred) ?? emails[0] ?? null;
    const reasons = inUse.flatMap((method) =>
      stalenessOf(method, day).reasons.map(
        (reason) => `${method.value}: ${reason}`,
      ),
    );
    const oldest = inUse.map((method) => method.verifiedOn).sort()[0] ?? null;
    return {
      identifier: contact.identifier,
      kind: contact.kind,
      name: contact.name,
      role: contact.role,
      organizationName: contact.organizationIdentifier
        ? (names.get(contact.organizationIdentifier) ?? null)
        : null,
      nationIdentifier: contact.nationIdentifier,
      nationTitle: contact.nationIdentifier
        ? (nationTitles.get(contact.nationIdentifier) ??
          contact.nationIdentifier)
        : null,
      tags: contact.tags,
      email: email?.value ?? null,
      emailLabel: email?.label ?? null,
      phones: inUse.filter((method) => method.method === "phone").length,
      oldestCheck: oldest,
      stale: reasons.length > 0,
      reasons,
    };
  });

  const shown = rows.filter((row) => {
    if (tag && !row.tags.includes(tag)) return false;
    if (show === "stale") return row.stale;
    if (show === "no-email") return row.email === null;
    if (show === "people") return row.kind === "person";
    if (show === "organizations") return row.kind === "organization";
    return true;
  });

  return {
    show,
    tag,
    tags,
    rows: shown,
    totals: {
      contacts: rows.length,
      withEmail: rows.filter((row) => row.email).length,
      stale: rows.filter((row) => row.stale).length,
    },
    nations,
    organizations: contacts
      .filter((contact) => contact.kind === "organization")
      .map((contact) => ({
        identifier: contact.identifier,
        name: contact.name,
      })),
    today: day,
  };
};

export const actions: Actions = {
  add: async (event) => {
    const person = requirePermission(event, "manage-address-book");
    const { database } = storage(event);
    const form = await event.request.formData();
    const kind = formText(form, "kind") as ContactKind | null;
    const name = formText(form, "name", 300);
    if (!kind || !contactKinds.includes(kind))
      return fail(400, { problem: "Choose person or organization." });
    if (!name) return fail(400, { problem: "Give a name." });
    const nationIdentifier = formText(form, "nationIdentifier");
    if (nationIdentifier && !nationTitles.has(nationIdentifier))
      return fail(400, { problem: "Choose a nation from the list." });
    const added = await addContact(
      database,
      {
        kind,
        name,
        organizationIdentifier: formText(form, "organizationIdentifier"),
        nationIdentifier,
        role: formText(form, "role", 300),
        notes: formText(form, "notes"),
        tags: (formText(form, "tags") ?? "").split(","),
      },
      person.identifier,
    );
    if (!added.ok) return fail(400, { problem: added.problem });

    // An email given with the new contact is added to it at once.
    const email = formText(form, "email", 320);
    if (email) {
      const label = (formText(form, "label") ?? "other") as MethodLabel;
      const sourceKind = (formText(form, "sourceKind") ??
        "told-us") as SourceKind;
      const result = await addContactMethod(
        database,
        added.identifier,
        {
          method: "email",
          value: email,
          label: methodLabels.includes(label) ? label : "other",
          sourceKind: sourceKinds.includes(sourceKind) ? sourceKind : "told-us",
          sourceLabel: formText(form, "sourceLabel", 300) ?? "Added by hand",
          sourceLink: formText(form, "sourceLink", 2000),
          verifiedOn: today(),
          preferred: true,
        },
        person.identifier,
      );
      if (!result.ok) {
        return fail(400, {
          problem: `${name} was added, but not the email: ${result.problem}`,
          added: added.identifier,
        });
      }
    }
    return { done: `${name} was added.`, added: added.identifier };
  },

  refresh: async (event) => {
    const person = requirePermission(event, "manage-address-book");
    const { database } = storage(event);
    try {
      const summary = await refreshFromDirectories(
        database,
        (link) => fetch(link),
        person.identifier,
        today(),
      );
      return {
        done:
          `Checked ${summary.checked} emails from the federal and Alaska directories: ${summary.verified} still listed, ` +
          `${summary.replaced} no longer listed (marked replaced), ${summary.added} new ones added, ` +
          `${summary.notListed} whose nation the directory no longer names.`,
      };
    } catch (problem) {
      return fail(502, {
        problem: `The refresh stopped: ${problem instanceof Error ? problem.message : String(problem)} When a directory could not be read, nothing was changed.`,
      });
    }
  },
};
