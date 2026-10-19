import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { shouldEnableViewTransitions } from "../lib/browser";

export type ViewTransitionCallback = () => void | Promise<void>;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => undefined;
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

type ViewTransitionLike = {
  finished: Promise<void>;
  updateCallbackDone?: Promise<void>;
};

type StartViewTransition = (
  this: Document,
  updateCallback: () => void | Promise<void>
) => ViewTransitionLike;

export function useViewTransition(): (
  callback: ViewTransitionCallback
) => Promise<void> {
  const supported = useMemo(shouldEnableViewTransitions, []);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const activeTransitionRef = useRef<Promise<void> | null>(null);

  return useCallback(
    async (callback: ViewTransitionCallback) => {
      if (!callback) {
        return;
      }

      if (reducedMotion || !supported) {
        await callback();
        return;
      }

      const startViewTransition = (
        document as Document & {
          startViewTransition?: StartViewTransition;
        }
      ).startViewTransition;

      if (typeof startViewTransition !== "function") {
        await callback();
        return;
      }

      // Apply rapid consecutive state changes without starting another native
      // transition. The browser skips the previous transition when a new one
      // starts, which otherwise surfaces as an AbortError in development.
      if (activeTransitionRef.current) {
        await callback();
        return;
      }

      let updateRan = false;
      let updateError: unknown;

      try {
        const transition = startViewTransition.call(document, async () => {
          updateRan = true;
          try {
            await callback();
          } catch (error) {
            updateError = error;
            throw error;
          }
        });

        const transitionPromises: Promise<unknown>[] = [];
        if (transition?.updateCallbackDone) {
          transitionPromises.push(
            transition.updateCallbackDone.catch((error) => {
              if (!isAbortError(error)) {
                updateError ??= error;
              }
            })
          );
        }
        if (transition?.finished) {
          transitionPromises.push(transition.finished.catch(() => undefined));
        }
        const activeTransition = Promise.all(transitionPromises).then(
          () => undefined
        );
        activeTransitionRef.current = activeTransition;
        await activeTransition;
        if (activeTransitionRef.current === activeTransition) {
          activeTransitionRef.current = null;
        }
      } catch (error) {
        updateError ??= error;
      }

      if (!updateRan) {
        await callback();
      } else if (updateError) {
        throw updateError;
      }
    },
    [reducedMotion, supported]
  );
}
