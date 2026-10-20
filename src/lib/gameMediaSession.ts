/** Keep answers out of the page's lock-screen and Bluetooth metadata. */
export function maskGameMediaSession(playbackState?: MediaSessionPlaybackState) {
  if (typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined") {
    return;
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: "Ponchister",
    artist: "",
    album: "",
    artwork: [],
  });
  if (playbackState !== undefined) {
    navigator.mediaSession.playbackState = playbackState;
  }
}
