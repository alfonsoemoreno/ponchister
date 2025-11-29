export function isSafariLike(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  const vendor = navigator.vendor ?? "";
  if (!ua || !vendor) {
    return false;
  }

  const hasSafari = /Safari/i.test(ua);
  if (!hasSafari) {
    return false;
  }

  const hasExcludedToken =
    /Chrome|CriOS|FxiOS|Edg|OPR|OPiOS|Vivaldi|YaBrowser|Brave|Android/i.test(
      ua
    );
  if (hasExcludedToken) {
    return false;
  }

  return /Apple/i.test(vendor);
}

export function shouldEnableViewTransitions(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const supportsApi = "startViewTransition" in document;
  if (!supportsApi) {
    return false;
  }

  return !isSafariLike();
}
