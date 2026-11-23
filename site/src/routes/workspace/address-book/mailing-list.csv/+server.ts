/**
 * The address book's mailing list as CSV, for the lead author: one email per
 * contact, its preferred one in use (mailingList in
 * src/lib/server/address-book.ts). It holds leaders' own addresses, so it is
 * never cached and never linked from a public page.
 */
import { csvText } from "#lib/address-book.ts";
import { listContacts, mailingList } from "#lib/server/address-book.ts";
import { requirePermission, storage } from "#lib/server/workspace.ts";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  requirePermission(event, "manage-address-book");
  const { database } = storage(event);
  const recipients = mailingList(await listContacts(database));
  const header = [
    "name",
    "role",
    "organization",
    "nation",
    "email",
    "kind",
    "last_checked",
  ];
  const lines = recipients.map((recipient) =>
    [
      recipient.name,
      recipient.role,
      recipient.organizationName,
      recipient.nationIdentifier,
      recipient.email,
      recipient.label,
      recipient.verifiedOn,
    ].map(csvText),
  );
  const body =
    [header, ...lines].map((line) => line.join(",")).join("\r\n") + "\r\n";
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mailing-list-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
};
