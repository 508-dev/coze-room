# Observability

## Position

**We ship no third-party analytics or telemetry SDK.** Not in the client, not
in the Android build.

This is deliberate. We run the server, so every connection, session length,
room occupancy, queue action and disconnect already passes through
infrastructure we control. Deriving usage metrics from our own logs gives us
what we need, avoids F-Droid's `Tracking` anti-feature, and means the privacy
policy has no third-party data-sharing section to write.

## Environment names

`.env.example` carries `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` and
`OTEL_SERVICE_NAME` so a destination can be wired up later without an
`.env.example` change. They are empty and no SDK is installed.

If error reporting is ever added, it goes **server-side only**. A crash
reporter in a client that sits in someone's bedroom all night is exactly the
kind of thing this project should not ship.

## What to measure

The questions worth answering are about whether the core feeling works:

- Session length, and specifically how many sessions end in sleep rather than
  a deliberate exit.
- Whether people return the next night.
- Room occupancy over the night — does anyone arrive to a room that already has
  sleepers in it, and do they stay?
- Queue participation versus passive listening.

All of these are answerable from connection logs.
