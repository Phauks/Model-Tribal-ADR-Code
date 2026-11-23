# Database migrations

Each `.sql` file here changes the tables of the D1 database `database`. Wrangler runs every file whose name is not yet in the database's `d1_migrations` table and then records that name there, so a name is how the live database knows a migration has run.

## Naming a new migration

Name a new migration for the time you write it, in UTC, and for what it does:

```text
20261123T0430_add_file_scans.sql
```

- `YYYYMMDDTHHMM`: year, month, day, the letter T, hour and minute, in UTC.
- An underscore, then at least two lowercase words joined by underscores that say what the migration does, such as `add_file_scans` or `drop_old_follow_settings`.

Let the helper make the file, from `site/`:

```sh
npm run database:new-migration -- "add file scans"
```

It picks the current UTC minute (the next free one if another migration already has it) and opens the file with two TODO lines to replace. Don't use `wrangler d1 migrations create`: it names a file one more than the largest number it finds, which no longer fits.

Numbered names (`0001_` to `0021_`) were used until Nov. 23, 2026, when several pull requests picked the same next number at once (Trevor, Nov. 23, 2026: "Can we denote migrations with a time code and info on the content?"). Those 21 files keep their names, because the live database recorded them under those names and would run a renamed file again. No new numbered file is allowed.

## The opening comment

Every migration opens with `-- ` comment lines that say, in full sentences, what it changes and where its design is written down (a document in `site/` or `docs/`, or a decision record). The first line alone must say what it does in at least five words.

## Order

Wrangler sorts by the number before the first underscore, then by the whole name (wrangler 4.166, `compareMigrationPaths`). The numbered files come first (1 to 21), then the timestamped ones by date (the number Wrangler reads is `20261123`) and, within a day, by hour and minute, since those have a fixed width. The test database in `tests/database.ts` sorts names as text, which gives the same order for both patterns.

A migration written earlier can merge after one written later. Wrangler still runs it, because it runs every name it has not recorded, but it runs it after the later one. So a migration must not depend on another pull request's migration that has not merged.

## Rules checked on every pull request

`scripts/check_migrations.py` (the "Migrations" check) fails when:

- a name fits neither pattern, or is a new numbered name;
- a timestamp is not a real UTC date and time, or is more than a day ahead;
- two migrations share a timestamp;
- the opening comment is missing, has fewer than five words on its first line, or still has a TODO;
- the pull request changes, renames or deletes a migration already on `main`. The live database has already run it and will not run it again, so write a new migration instead.

Run it yourself from the repository root: `python3 scripts/check_migrations.py --base origin/main`.

## Applying

Apply new migrations from `site/` with `npm run database:migrate:remote` (or `database:migrate:local` for the copy `npm run preview` uses); see [COLLABORATION.md](../COLLABORATION.md#database). When applying one by hand through a database console, run the file and then record its exact file name: `INSERT INTO d1_migrations (name) VALUES ('20261123T0430_add_file_scans.sql');`. Check `SELECT name FROM d1_migrations` first, since another person may have applied it already.
