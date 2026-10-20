import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Node 24 runs these TypeScript tests directly.
import { maskGameMediaSession } from "../src/lib/gameMediaSession.ts";

test("clears every answer field, including artwork, after playback changes", (t) => {
  const session = {
    metadata: { title: "When I See You Smile", artist: "Bad English", album: "1989", artwork: [{ src: "cover.jpg" }] },
    playbackState: "none",
  };
  t.mock.getter(globalThis, "navigator", () => ({ mediaSession: session }));
  class Metadata {
    constructor(values: object) { Object.assign(this, values); }
  }
  const originalMetadata = Object.getOwnPropertyDescriptor(globalThis, "MediaMetadata");
  Object.defineProperty(globalThis, "MediaMetadata", { configurable: true, value: Metadata });
  t.after(() => {
    if (originalMetadata) {
      Object.defineProperty(globalThis, "MediaMetadata", originalMetadata);
    } else {
      Reflect.deleteProperty(globalThis, "MediaMetadata");
    }
  });

  for (const state of ["playing", "paused"] as const) {
    maskGameMediaSession(state);
    assert.deepEqual({ ...session.metadata }, {
      title: "Ponchister", artist: "", album: "", artwork: [],
    });
    assert.equal(session.playbackState, state);
    // Simulate stale metadata before the next player event.
    session.metadata.title = "Another answer";
  }

  maskGameMediaSession();
  assert.equal(session.metadata.title, "Ponchister");
  assert.equal(session.playbackState, "paused");
});

test("works without browser media session support", (t) => {
  t.mock.getter(globalThis, "navigator", () => ({}));
  assert.doesNotThrow(() => maskGameMediaSession("playing"));
});
