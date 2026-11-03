# Media ingest

Turns one rights-cleared source into the three files Dormouse needs:

- `<id>.mp4`: 480p H.264 video and AAC audio, `yuv420p`, with `faststart` for
  progressive HTTP Range playback;
- `<id>.gif`: a short, infinitely looping preview for the pixel-art TV, scaled
  with nearest neighbour and quantized to the Atropoeia palette without
  dithering;
- `<id>.m4a`: audio-only AAC at 64 kbps, mono, 48 kHz, for drift-off mode. AAC
  in MP4 works in Chrome on Android and the supported desktop browsers.

Silent sources receive a silent AAC track so all three renditions still exist
and have a consistent playback contract. The GIF is a 12-second excerpt, not
an expensive full-film conversion. Source and output media stay outside git.

## Prerequisites

Install Bun, `ffmpeg`, and `ffprobe`. No npm packages or Cloudflare SDK are
needed. The uploader uses Bun's built-in S3 client.

The default media root is `~/dormouse-media/`:

```text
~/dormouse-media/
  sources/             mirrored originals
  renditions/          generated MP4, GIF, M4A, and ingest reports
```

Override it with `--media-root PATH` on either command.

## Add a title

1. Clear the exact source file, including its soundtrack, following
   [`catalogue/README.md`](../../catalogue/README.md) and `COPYRIGHT.md`. If the
   evidence is weak, choose another title.
2. Add its entry to `catalogue/manifest.json`. Use a direct media URL for
   `sourceUrl`; rights-evidence pages belong in `rightsEvidence`.
3. Mirror the source. For example, from the repository root:

   ```bash
   mkdir -p "$HOME/dormouse-media/sources"
   curl --fail --location --continue-at - \
     --output "$HOME/dormouse-media/sources/example.mp4" \
     'https://example.org/exact-cleared-source.mp4'
   ```

   The output path must equal `sourceFile` under the media root. Do not put it
   in the repository.
4. Measure the source and set `durationSeconds`:

   ```bash
   ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 \
     "$HOME/dormouse-media/sources/example.mp4"
   ```

5. Run ingest and human-review the rights evidence before serving the title.

## Run ingest

One title:

```bash
bun run tools/media/ingest.ts example
```

Every title in the manifest:

```bash
bun run tools/media/ingest.ts --all
```

An alternate source path can be supplied for one id with
`--source /path/to/source.mp4`. GIF defaults are 64 pixels wide, 8 fps, and 12
seconds. Change them with `--gif-width 48`, `--gif-fps 8`, and
`--gif-duration 12`; choose the excerpt with `--gif-start 30` or the manifest's
`previewStartSeconds`.

Each pass writes `renditions/<id>.ingest.json` with source and output durations,
output byte counts, and preview settings. Filenames depend only on the
catalogue id. Encoding is deterministic in naming and settings; codec builds
can still produce different bytes.

## Upload to R2

**The uploader never creates or configures a bucket.** Provision and configure
R2 in Cloudflare first:

1. Create the `dormouse-media` bucket and attach the custom domain
   **`dormouse-media.508.dev`**. This is deliberately a single-level `508.dev`
   subdomain: the zone's Universal SSL certificate covers `*.508.dev`, not
   deeper names. Do not use the rate-limited, uncached `r2.dev` URL.
2. Set this bucket CORS policy so the app can decode previews and route media
   elements through Web Audio:

   ```json
   [
     {
       "AllowedOrigins": ["https://dormouse.508.dev"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["Range"],
       "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

3. Create an R2 API token with **Object Read & Write**, scoped only to the
   `dormouse-media` bucket. Put its credentials and the account id in the local
   `.env` (or the environment); never commit them:

   ```text
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=dormouse-media
   R2_PUBLIC_BASE_URL=https://dormouse-media.508.dev
   ```

   The command requires all five values and fails before constructing a client
   when any are missing. It also rejects an `r2.dev` public base URL.
4. Upload one title or the whole catalogue:

   ```bash
   bun run tools/media/upload.ts example
   bun run tools/media/upload.ts --all
   ```

   The command uploads the three renditions plus the ingest report to bucket
   keys named `<id>.mp4`, `<id>.gif`, `<id>.m4a`, and `<id>.ingest.json`, then
   prints their custom-domain URLs. Every object gets
   `Cache-Control: public, max-age=3600`. The one-hour lifetime is intentional:
   keys use stable catalogue ids rather than content hashes, so `immutable`
   would strand replaced renditions behind caches. Re-upload an object to apply
   this metadata to an upload made by an older tool.
5. In Coolify, set the **build-time** variable
   `VITE_MEDIA_BASE_URL=https://dormouse-media.508.dev` and redeploy. A runtime
   variable alone cannot change the already-built client.
6. Verify CORS and byte-range delivery after the upload (replace `example` with
   an uploaded catalogue id):

   ```bash
   curl --fail-with-body --silent --show-error \
     --dump-header - --output /dev/null \
     -H 'Origin: https://dormouse.508.dev' \
     -H 'Range: bytes=0-1023' \
     https://dormouse-media.508.dev/example.mp4
   ```

   Expect **206 Partial Content**, `Access-Control-Allow-Origin:
   https://dormouse.508.dev`, `Accept-Ranges: bytes`, and a `Content-Range`
   header. A failed CORS or media request leaves Dormouse's TV in its resting /
   unavailable state rather than exposing a broken player.

## Checks

```bash
bun run --cwd tools/media test
bun run --cwd tools/media typecheck
```

For an encoded title, inspect the actual streams and durations:

```bash
ffprobe -v error -show_entries \
  format=duration:stream=codec_name,codec_type,width,height,channels,sample_rate \
  -of json "$HOME/dormouse-media/renditions/example.mp4"
ffprobe -v error -show_entries \
  format=duration:stream=codec_name,codec_type,channels,sample_rate,bit_rate \
  -of json "$HOME/dormouse-media/renditions/example.m4a"
```
