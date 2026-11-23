// The nations a contact can be linked to, by id and name, from the content
// records listed at build time.
import { reviewSubjects } from "virtual:review-subjects";

export const nations = reviewSubjects
  .filter((subject) => subject.kind === "nation")
  .map((subject) => ({ identifier: subject.identifier, title: subject.title }))
  .sort((a, b) => a.title.localeCompare(b.title, "en-US"));

export const nationTitles = new Map(
  nations.map((nation) => [nation.identifier, nation.title]),
);
