import { useCallback, useMemo } from "react";
import { shouldEnableViewTransitions } from "../lib/browser";

export type ViewTransitionCallback = () => void | Promise<void>;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ViewTransitionLike = {
  finished: Promise<void>;
};

type StartViewTransition = (
  this: Document,
  updateCallback: () => void | Promise<void>
) => ViewTransitionLike;

export function useViewTransition(): (
  callback: ViewTransitionCallback
) => Promise<void> {
  const supported = useMemo(shouldEnableViewTransitions, []);
  const reducedMotion = useMemo(prefersReducedMotion, []);

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

      let updateRan = false;

      try {
        const transition = startViewTransition.call(document, async () => {
          updateRan = true;
          await callback();
        });

        if (
          transition &&
          typeof transition.finished === "object" &&
          typeof transition.finished.then === "function"
        ) {
          try {
            await transition.finished;
          } catch (error) {
            console.info(
              `[view-transition] status=aborted message="${
                error instanceof Error ? error.message : String(error)
              }"`
            );
          }
        }
      } catch (error) {
        console.info(
          `[view-transition] status=failed message="${
            error instanceof Error ? error.message : String(error)
          }"`
        );
      }

      if (!updateRan) {
        await callback();
      }
    },
    [reducedMotion, supported]
  );
}
