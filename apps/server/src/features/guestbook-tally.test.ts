import { describe, expect, it } from "vitest";
import { GuestbookTally, HOUR_MS, nightKey } from "./guestbook-tally";

const local = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

describe("nightKey", () => {
  it("keys to the local calendar date of the moment", () => {
    expect(nightKey(local(2026, 11, 2, 0, 0))).toBe("2026-11-02");
    expect(nightKey(local(2026, 11, 2, 23, 59))).toBe("2026-11-02");
    expect(nightKey(local(2026, 11, 3, 0, 1))).toBe("2026-11-03");
  });

  it("treats one local midnight as the boundary between nights", () => {
    const beforeMidnight = local(2026, 11, 2, 23, 59);
    const afterMidnight = local(2026, 11, 3, 0, 0);
    expect(nightKey(beforeMidnight)).not.toBe(nightKey(afterMidnight));
  });
});

describe("GuestbookTally", () => {
  it("counts distinct sleepers once per night even across repeated sleeps", () => {
    const tally = new GuestbookTally();
    tally.asleep("a", local(2026, 11, 2, 22, 0));
    tally.awake("a", local(2026, 11, 2, 23, 0));
    tally.asleep("a", local(2026, 11, 2, 23, 30));
    tally.awake("a", local(2026, 11, 3, 1, 0));

    // Two episodes from the same id still count as one sleeper on 11-02.
    expect(tally.tally("2026-11-02", local(2026, 11, 3, 2, 0)).sleepers).toBe(1);
  });

  it("attributes a sleep spanning midnight wholly to the night it began", () => {
    const tally = new GuestbookTally();
    // Asleep 23:00 on 11-02, wakes 01:00 on 11-03: two hours, all on 11-02.
    tally.asleep("a", local(2026, 11, 2, 23, 0));
    tally.awake("a", local(2026, 11, 3, 1, 0));

    expect(tally.tally("2026-11-02", local(2026, 11, 3, 1, 0))).toEqual({
      sleepers: 1,
      sleeperHours: 2,
    });
    expect(tally.tally("2026-11-03", local(2026, 11, 3, 1, 0))).toEqual({
      sleepers: 0,
      sleeperHours: 0,
    });
  });

  it("sums sleeper-hours across distinct occupants", () => {
    const tally = new GuestbookTally();
    tally.asleep("a", local(2026, 11, 2, 22, 0));
    tally.awake("a", local(2026, 11, 2, 23, 0)); // 1h
    tally.asleep("b", local(2026, 11, 2, 22, 30));
    tally.awake("b", local(2026, 11, 2, 23, 30)); // 1h

    expect(tally.tally("2026-11-02", local(2026, 11, 3, 0, 0))).toEqual({
      sleepers: 2,
      sleeperHours: 2,
    });
  });

  it("includes the partial hours of a still-open episode", () => {
    const tally = new GuestbookTally();
    tally.asleep("a", local(2026, 11, 2, 23, 0));
    // 90 minutes later, still asleep: 1.5 hours so far.
    expect(tally.tally("2026-11-02", local(2026, 11, 3, 0, 30))).toEqual({
      sleepers: 1,
      sleeperHours: 1.5,
    });
  });

  it("closes an episode on leave while asleep", () => {
    const tally = new GuestbookTally();
    tally.asleep("a", local(2026, 11, 2, 23, 0));
    tally.leave("a", local(2026, 11, 3, 0, 30));
    expect(tally.tally("2026-11-02", local(2026, 11, 3, 1, 0)).sleeperHours).toBe(1.5);
  });

  it("folds a seeded baseline into the tally without ids", () => {
    const tally = new GuestbookTally();
    tally.seed("2026-11-02", { sleepers: 12, sleeperHours: 30 });
    tally.asleep("a", local(2026, 11, 2, 23, 0));
    tally.awake("a", local(2026, 11, 3, 0, 0)); // +1h

    expect(tally.tally("2026-11-02", local(2026, 11, 3, 0, 0))).toEqual({
      sleepers: 13,
      sleeperHours: 31,
    });
  });

  it("reports the nights carrying data, oldest first", () => {
    const tally = new GuestbookTally();
    tally.asleep("a", local(2026, 11, 2, 23, 0));
    tally.awake("a", local(2026, 11, 3, 1, 0));
    expect(tally.nightsWithData()).toEqual(["2026-11-02"]);
  });

  it("never counts a negative episode duration", () => {
    const tally = new GuestbookTally();
    tally.asleep("a", local(2026, 11, 2, 23, 0));
    // A wake timestamp before the start (clock skew) adds nothing.
    tally.awake("a", local(2026, 11, 2, 22, 0));
    expect(tally.tally("2026-11-02", local(2026, 11, 3, 0, 0)).sleeperHours).toBe(0);
  });

  it("exposes the hour constant used to convert milliseconds", () => {
    expect(HOUR_MS).toBe(3_600_000);
  });
});
