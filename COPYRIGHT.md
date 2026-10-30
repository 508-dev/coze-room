# Licensing

Dormouse is open core. The code is free software; the commercial surface is
art and audio content packs, not the program.

| Part | Licence | File |
|---|---|---|
| Client (`apps/client`, `packages/*`) | **GPL-3.0-only** | `LICENSE` |
| Server (`apps/server`) | **AGPL-3.0-only** | `LICENSE.server` |
| Bundled art and audio in this repository | see `packs/<pack>/LICENSE` | per pack |

Copyright (c) 2026 508.dev LLC and contributors.

The server is AGPL so that anyone running a modified Dormouse server for others
has to share those modifications. The client is GPL rather than AGPL because
network-use copyleft is meaningless for code that runs in the user's own
browser.

## Third-party content

Ambient audio is sourced from Freesound under **CC0** and **CC BY 4.0** only.
NonCommercial-licensed audio is never used, because it would be incompatible
with the paid content packs. Attribution for CC BY material is in
`packs/<pack>/CREDITS.md`.

Video in the catalogue is public domain or freely licensed, cleared per title.
See `catalogue/manifest.json` for the provenance record of every item: source,
claimed licence, the evidence for the claim, and who verified it.
