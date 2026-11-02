import type { Component } from "svelte";
import type { RoomState } from "../state/room.svelte";
import GuestbookSummary from "./GuestbookSummary.svelte";
import MediaPanel from "./MediaPanel.svelte";

/** Optional feature UI inside the room chrome; no App.svelte changes needed. */
export const featurePanels: readonly Component<{ state: RoomState }>[] = [
  GuestbookSummary,
  MediaPanel,
];
