import { useEffect, useState } from "react";
import { getPerceptualBrightness, type RGBColor } from "../lib/color";

export interface ArtworkPalette {
  color: RGBColor;
  brightness: number;
}

export type ArtworkPaletteStatus = "idle" | "loading" | "ready" | "error";

export interface ArtworkPaletteState {
  palette: ArtworkPalette | null;
  status: ArtworkPaletteStatus;
}

const DEFAULT_STATE: ArtworkPaletteState = {
  palette: null,
  status: "idle",
};

const MAX_CANVAS_SIZE = 64;

const SAFE_SAMPLE_STEP = 2;

export function useArtworkPalette(url: string | null): ArtworkPaletteState {
  const [state, setState] = useState<ArtworkPaletteState>(DEFAULT_STATE);

  useEffect(() => {
    if (!url) {
      setState(DEFAULT_STATE);
      return undefined;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";

    const handleError = () => {
      if (cancelled) return;
      setState({ palette: null, status: "error" });
    };

    image.onload = () => {
      if (cancelled) return;

      try {
        const width = Math.min(
          image.naturalWidth || MAX_CANVAS_SIZE,
          MAX_CANVAS_SIZE
        );
        const height = Math.min(
          image.naturalHeight || MAX_CANVAS_SIZE,
          MAX_CANVAS_SIZE
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          handleError();
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        let imageData: ImageData;

        try {
          imageData = context.getImageData(0, 0, width, height);
        } catch {
          handleError();
          return;
        }

        const { data } = imageData;
        let redTotal = 0;
        let greenTotal = 0;
        let blueTotal = 0;
        let sampleCount = 0;

        const totalPixels = width * height;
        const stride = Math.max(
          1,
          Math.min(SAFE_SAMPLE_STEP, Math.floor(totalPixels / 2048))
        );

        for (let index = 0; index < data.length; index += 4 * stride) {
          redTotal += data[index];
          greenTotal += data[index + 1];
          blueTotal += data[index + 2];
          sampleCount += 1;
        }

        if (!sampleCount) {
          handleError();
          return;
        }

        const palette: ArtworkPalette = {
          color: {
            r: redTotal / sampleCount,
            g: greenTotal / sampleCount,
            b: blueTotal / sampleCount,
          },
          brightness: getPerceptualBrightness({
            r: redTotal / sampleCount,
            g: greenTotal / sampleCount,
            b: blueTotal / sampleCount,
          }),
        };

        if (!cancelled) {
          setState({ palette, status: "ready" });
        }
      } catch {
        handleError();
      }
    };

    image.onerror = handleError;

    setState({ palette: null, status: "loading" });
    image.src = url;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [url]);

  return state;
}
