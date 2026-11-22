# Contributor forms

Drafts, version 0.2.0. Not legal advice. Not in use until the lead author approves them.

These forms go with material that comes to the project from a person, such as an interview, a story or a family letter. Published sources don't need them. [contributions.md](../contributions.md) explains how the forms fit together. Model forms for nations to adopt are a separate set, kept in `content/forms/`.

| Form | Id | Use it when |
| --- | --- | --- |
| [Contributor statement](contributor-statement.md) | `contributor-statement` | Always |
| [Interview consent](interview-consent-and-release.md) | `interview-consent`, `interview-release` | Someone is interviewed |
| [Nation approval](cultural-authority-permission.md) | `cultural-authority-permission` | The material holds a community's knowledge |
| [Owner's permission](rights-holder-permission.md) | `rights-holder-permission` | Someone else made or owns the item |
| [Consent for minors](young-contributor-consent.md) | `guardian-consent`, `young-person-assent` | The contributor is not yet an adult |
| [Change or withdrawal](change-or-withdrawal-request.md) | `change-or-withdrawal-request` | Someone wants to change or take back what they gave |
| [Interviewer agreement](interviewer-agreement.md) | `interviewer-agreement` | Someone other than the lead author collects material |

## Rules for every form

- Each form shows its id and version at the top. The filing records which version was signed, so we can always show the exact words.
- A change to what a person agrees to is a new version.
- Any form can be read aloud and agreed to on a recording.
- The signer always gets a copy.
- Only answers marked required are required.
- If two forms disagree, the stricter one wins, and we ask.
- We fill in the placeholders, such as `{{filing.identifier}}`, before handing a form out.

## On the website

The website's Forms page shows every form here, to fill in online or print, and takes signed forms ([contributions.md](../contributions.md#on-the-website)). A new form needs only its Markdown file and a row in the table above. The site reads the file this way:

- The first line is `# Title`. A line such as ``Form `id`, version 1.0.0.`` gives the ids and version.
- `☐` is a tick box. Four or more underscores (`______`) is a line to write on, or a box when it stands alone in a paragraph. An empty table cell is a line.
- A line whose label names a date asks for a date. One that names a signature is a signature line. A form sent online needs at least one signature line filled in.
- A placeholder such as `{{interview.purpose}}` is a line labeled with its name. `{{project.lead_author}}` and `{{project.contact}}` are filled in by the site.
- A paragraph starting `**Project use.**`, and `{{filing.identifier}}`, are for us. They print but are not asked online.

Model forms for nations go in `content/forms/`, one file each, written the same way. They can be filled in and printed, but nothing is sent.
