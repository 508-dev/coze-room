import type { Component } from "svelte";
import type { RoomState } from "../state/room.svelte";
import AudioControls from "./AudioControls.svelte";
import GuestbookSummary from "./GuestbookSummary.svelte";
import MediaPanel from "./MediaPanel.svelte";
import PhrasePalette from "./PhrasePalette.svelte";

/** Optional feature UI inside the room chrome; no App.svelte changes needed. */
export const featurePanels: readonly Component<{ state: RoomState }>[] = [
  GuestbookSummary,
  MediaPanel,
  PhrasePalette,
  AudioControls,
];
