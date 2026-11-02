# Media catalogue

`manifest.json` is the provenance record for every video Dormouse serves. It
contains metadata only: **never commit source videos, renditions, or GIFs**.
Mirroring and encoding are documented in
[`tools/media/README.md`](../tools/media/README.md).

A catalogue entry is not cleared merely because a file is available from the
Internet Archive or another host. Check the exact file being mirrored,
including its soundtrack and restoration status. Keep the rights claim and its
specific evidence in the entry, and do not replace `pending human review` until
a person has checked it.

## Schema

The top-level object has `schemaVersion` (currently `1`) and an `items` array.
Each item has:

| Field | Meaning |
|---|---|
| `id` | Stable lower-case kebab-case id. It determines every rendition filename. |
| `title` | Display title. |
| `year` | Original release/publication year, not the year of a later encode. |
| `silent` | `true` only when the mirrored source has no meaningful audio programme. |
| `durationSeconds` | Source duration measured with `ffprobe`, rounded to milliseconds. |
| `sourceUrl` | Direct HTTPS URL of the exact source file that was mirrored. |
| `sourceFile` | Source path relative to the external media root, normally `sources/<id>.<ext>`. |
| `licence` | The claimed licence, for example `Public domain (US)` or `CC BY 4.0`. |
| `rightsEvidence` | The specific basis for that claim, with evidence URLs: publication date and US PD reasoning, a Commons licence template, a Blender licence page, or NASA's usage rules. |
| `attribution` | Required for CC BY material; include creator, source, licence URL, and a note that Dormouse transcodes it. Optional credit for public-domain material. |
| `checkedBy` | Model or person who performed the check, plus `pending human review` until a person approves it. |
| `checkedAt` | Check date in `YYYY-MM-DD` format. |
| `previewStartSeconds` | Optional start offset for a representative, calm GIF excerpt. Defaults to `0`. |

Durations and byte counts for the generated MP4, GIF, and M4A are recorded in
`renditions/<id>.ingest.json` in the external media directory. That report is
uploaded with the three media renditions but is not committed here.
