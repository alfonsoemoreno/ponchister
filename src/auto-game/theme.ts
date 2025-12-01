import { darken, lighten, rgbToCss } from "../lib/color";
import type { YearSpotlightStyle } from "./YearSpotlight";

export interface ChipTheme {
  background: string;
  color: string;
  borderColor?: string;
  borderStyle?: "solid" | "dashed";
}

export interface IconButtonTheme {
  background: string;
  hoverBackground: string;
  border: string;
  color: string;
  hoverColor: string;
  shadow: string;
  hoverShadow: string;
}

export interface PrimaryButtonTheme {
  background: string;
  hoverBackground: string;
  textColor: string;
  shadow: string;
  hoverShadow: string;
}

export interface SecondaryButtonTheme {
  border: string;
  textColor: string;
  hoverBorder: string;
  hoverBackground: string;
}

export interface StatusTextTheme {
  label: string;
  description: string;
}

export interface FallbackTheme {
  text: string;
  caption: string;
  icon: string;
  background: string;
}

export interface AlertTheme {
  background: string;
  color: string;
  border: string;
}

export interface AdaptiveTheme {
  overlayTint: string;
  text: {
    primary: string;
    secondary: string;
    body: string;
    caption: string;
    muted: string;
  };
  textShadow: string;
  alert: AlertTheme;
  chips: {
    primary: ChipTheme;
    secondary: ChipTheme;
    tertiary: ChipTheme;
  };
  spinner: string;
  iconButton: IconButtonTheme;
  primaryButton: PrimaryButtonTheme;
  secondaryButton: SecondaryButtonTheme;
  status: StatusTextTheme;
  fallback: FallbackTheme;
  warningText: string;
  progressOverlay: string;
  spotlight: YearSpotlightStyle;
}

const adjustBaseTone = (colorValue: number): number =>
  Math.max(0, Math.min(255, colorValue));

const withSafeBase = (paletteColor: { r: number; g: number; b: number }) => ({
  r: adjustBaseTone(paletteColor.r),
  g: adjustBaseTone(paletteColor.g),
  b: adjustBaseTone(paletteColor.b),
});

export const DEFAULT_THEME: AdaptiveTheme = {
  overlayTint: "rgba(4, 12, 26, 0.48)",
  text: {
    primary: "#ffffff",
    secondary: "rgba(204,231,255,0.92)",
    body: "rgba(224,239,255,0.82)",
    caption: "rgba(204,231,255,0.72)",
    muted: "rgba(224,239,255,0.78)",
  },
  textShadow: "0 30px 60px rgba(0,0,0,0.55)",
  alert: {
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.94)",
    border: "rgba(255,255,255,0.18)",
  },
  chips: {
    primary: {
      background: "rgba(255,255,255,0.16)",
      color: "#ffffff",
      borderColor: undefined,
    },
    secondary: {
      background: "rgba(13,148,255,0.2)",
      color: "rgba(212,239,255,0.95)",
      borderColor: "rgba(148,197,255,0.35)",
      borderStyle: "solid",
    },
    tertiary: {
      background: "rgba(255,255,255,0.12)",
      color: "rgba(230,243,255,0.92)",
      borderColor: "rgba(230,243,255,0.35)",
      borderStyle: "dashed",
    },
  },
  spinner: "#d7f9ff",
  iconButton: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(99,213,245,0.35) 100%)",
    hoverBackground:
      "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(99,213,245,0.48) 100%)",
    border: "3px solid rgba(255,255,255,0.35)",
    color: "#ffffff",
    hoverColor: "#ffffff",
    shadow: "0 26px 56px -28px rgba(12,38,96,0.8)",
    hoverShadow: "0 30px 64px -30px rgba(12,38,96,0.82)",
  },
  primaryButton: {
    background:
      "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #22d3ee 100%)",
    hoverBackground:
      "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #06b6d4 100%)",
    textColor: "#ffffff",
    shadow: "0 22px 48px -18px rgba(50,132,255,0.6)",
    hoverShadow: "0 26px 56px -20px rgba(37,99,235,0.7)",
  },
  secondaryButton: {
    border: "rgba(255,255,255,0.4)",
    textColor: "rgba(255,255,255,0.92)",
    hoverBorder: "rgba(255,255,255,0.7)",
    hoverBackground: "rgba(255,255,255,0.12)",
  },
  status: {
    label: "rgba(224,239,255,0.78)",
    description: "rgba(224,239,255,0.8)",
  },
  fallback: {
    text: "rgba(224,239,255,0.85)",
    caption: "rgba(224,239,255,0.8)",
    icon: "rgba(224,239,255,0.85)",
    background: "transparent",
  },
  warningText: "rgba(255,210,210,0.92)",
  progressOverlay: "rgba(4,10,24,0.45)",
  spotlight: {
    background:
      "radial-gradient(circle at 50% 52%, rgba(10,24,66,0.15) 0%, rgba(10,24,66,0.92) 68%, rgba(3,8,24,0.96) 100%)",
    halo: "radial-gradient(circle at 50% 50%, rgba(86,199,255,0.28) 0%, rgba(25,109,255,0.12) 45%, rgba(0,0,0,0) 70%)",
    borderColor: "rgba(173,215,255,0.22)",
    borderGlow: "0 0 42px rgba(32,139,255,0.25)",
    frameShadow:
      "0 40px 96px -32px rgba(4,12,42,0.76), inset 0 0 42px rgba(45,132,255,0.18)",
    labelColor: "rgba(255,255,255,0.86)",
    valueColor: "#ffffff",
    valueShadow: "0 48px 94px rgba(0,0,0,0.78)",
  },
};

export const createAdaptiveTheme = (
  palette: {
    color: { r: number; g: number; b: number };
    brightness: number;
  } | null
): AdaptiveTheme => {
  if (!palette) {
    return DEFAULT_THEME;
  }

  const safeBase = withSafeBase(palette.color);
  const brightness = palette.brightness;
  const adjustedBase =
    brightness < 0.22
      ? lighten(safeBase, 0.32)
      : brightness > 0.82
        ? darken(safeBase, 0.22)
        : safeBase;

  if (brightness > 0.62) {
    const midTone = darken(adjustedBase, 0.25);
    const deepTone = darken(adjustedBase, 0.45);
    const hoverTone = darken(adjustedBase, 0.55);
    const lightTone = darken(adjustedBase, 0.15);
    const spotlightCore = darken(adjustedBase, 0.32);
    const spotlightOuter = darken(adjustedBase, 0.58);

    return {
      ...DEFAULT_THEME,
      overlayTint: "rgba(5, 12, 26, 0.64)",
      text: {
        primary: "#061223",
        secondary: "rgba(12,32,60,0.88)",
        body: "rgba(14,38,68,0.78)",
        caption: "rgba(12,32,60,0.65)",
        muted: "rgba(14,38,68,0.72)",
      },
      textShadow: "0 30px 60px rgba(0,0,0,0.35)",
      alert: {
        background: "rgba(255,255,255,0.78)",
        color: "#061223",
        border: "rgba(6,22,44,0.18)",
      },
      chips: {
        primary: {
          background: "rgba(8,22,46,0.12)",
          color: "#061223",
          borderColor: "rgba(6,22,44,0.16)",
          borderStyle: "solid",
        },
        secondary: {
          background: rgbToCss(lightTone, 0.22),
          color: rgbToCss(hoverTone),
          borderColor: rgbToCss(deepTone, 0.32),
          borderStyle: "solid",
        },
        tertiary: {
          background: "rgba(255,255,255,0.74)",
          color: "#061223",
          borderColor: "rgba(6,22,44,0.18)",
          borderStyle: "dashed",
        },
      },
      spinner: rgbToCss(deepTone),
      iconButton: {
        background: `linear-gradient(135deg, ${rgbToCss(
          lighten(adjustedBase, 0.48),
          0.82
        )} 0%, ${rgbToCss(lighten(adjustedBase, 0.32), 0.88)} 100%)`,
        hoverBackground: `linear-gradient(135deg, ${rgbToCss(
          lighten(adjustedBase, 0.42),
          0.92
        )} 0%, ${rgbToCss(lighten(adjustedBase, 0.22), 0.98)} 100%)`,
        border: "3px solid rgba(6,22,44,0.22)",
        color: rgbToCss(darken(adjustedBase, 0.78)),
        hoverColor: rgbToCss(darken(adjustedBase, 0.85)),
        shadow: "0 26px 56px -28px rgba(8,22,48,0.5)",
        hoverShadow: "0 30px 64px -26px rgba(6,18,38,0.58)",
      },
      primaryButton: {
        background: `linear-gradient(135deg, ${rgbToCss(
          lightTone
        )} 0%, ${rgbToCss(midTone)} 50%, ${rgbToCss(deepTone)} 100%)`,
        hoverBackground: `linear-gradient(135deg, ${rgbToCss(
          darken(adjustedBase, 0.18)
        )} 0%, ${rgbToCss(deepTone)} 50%, ${rgbToCss(hoverTone)} 100%)`,
        textColor: "#f8fbff",
        shadow: `0 22px 48px -18px ${rgbToCss(
          darken(adjustedBase, 0.62),
          0.6
        )}`,
        hoverShadow: `0 26px 56px -20px ${rgbToCss(
          darken(adjustedBase, 0.68),
          0.68
        )}`,
      },
      secondaryButton: {
        border: "rgba(6,22,44,0.35)",
        textColor: "rgba(6,22,44,0.92)",
        hoverBorder: "rgba(6,22,44,0.45)",
        hoverBackground: "rgba(6,22,44,0.12)",
      },
      status: {
        label: "rgba(14,38,68,0.78)",
        description: "rgba(14,38,68,0.72)",
      },
      fallback: {
        text: "rgba(14,38,68,0.78)",
        caption: "rgba(12,32,60,0.62)",
        icon: rgbToCss(deepTone),
        background: "transparent",
      },
      warningText: "rgba(172,58,58,0.88)",
      progressOverlay: rgbToCss(darken(adjustedBase, 0.6), 0.45),
      spotlight: {
        background: `radial-gradient(circle at 50% 52%, ${rgbToCss(
          spotlightCore,
          0.24
        )} 0%, ${rgbToCss(spotlightCore, 0.94)} 68%, ${rgbToCss(
          spotlightOuter,
          0.98
        )} 100%)`,
        halo: `radial-gradient(circle at 50% 50%, ${rgbToCss(
          lighten(adjustedBase, 0.52),
          0.26
        )} 0%, ${rgbToCss(
          lighten(adjustedBase, 0.32),
          0.14
        )} 45%, rgba(0,0,0,0) 70%)`,
        borderColor: rgbToCss(lighten(adjustedBase, 0.4), 0.45),
        borderGlow: `0 0 42px ${rgbToCss(lighten(adjustedBase, 0.38), 0.28)}`,
        frameShadow: `0 40px 96px -32px ${rgbToCss(
          darken(adjustedBase, 0.72),
          0.7
        )}, inset 0 0 42px ${rgbToCss(lighten(adjustedBase, 0.18), 0.26)}`,
        labelColor: rgbToCss(darken(adjustedBase, 0.68), 0.92),
        valueColor: rgbToCss(darken(adjustedBase, 0.78)),
        valueShadow: `0 48px 94px ${rgbToCss(darken(adjustedBase, 0.9), 0.42)}`,
      },
    };
  }

  const accentBase =
    brightness < 0.32 ? lighten(adjustedBase, 0.18) : adjustedBase;
  const accentLift = lighten(accentBase, 0.24);
  const accentDeep = darken(accentBase, 0.22);
  const accentHover = darken(accentBase, 0.32);
  const accentShadow = rgbToCss(darken(accentBase, 0.58), 0.58);
  const accentHoverShadow = rgbToCss(darken(accentBase, 0.64), 0.64);
  const spotlightCore = darken(accentBase, 0.25);
  const spotlightOuter = darken(accentBase, 0.55);

  return {
    ...DEFAULT_THEME,
    overlayTint:
      brightness < 0.28 ? "rgba(2, 8, 22, 0.55)" : DEFAULT_THEME.overlayTint,
    chips: {
      primary: {
        background: rgbToCss(lighten(accentBase, 0.55), 0.16),
        color: DEFAULT_THEME.text.primary,
        borderColor: rgbToCss(lighten(accentBase, 0.45), 0.22),
        borderStyle: "solid",
      },
      secondary: {
        background: rgbToCss(lighten(accentBase, 0.15), 0.22),
        color: rgbToCss(lighten(accentBase, 0.7)),
        borderColor: rgbToCss(lighten(accentBase, 0.08), 0.35),
        borderStyle: "solid",
      },
      tertiary: {
        background: rgbToCss(lighten(accentBase, 0.35), 0.18),
        color: rgbToCss(lighten(accentBase, 0.8)),
        borderColor: rgbToCss(lighten(accentBase, 0.25), 0.26),
        borderStyle: "dashed",
      },
    },
    spinner: rgbToCss(lighten(accentBase, 0.55)),
    iconButton: {
      background: `linear-gradient(135deg, ${rgbToCss(
        lighten(accentBase, 0.4),
        0.28
      )} 0%, ${rgbToCss(lighten(accentBase, 0.22), 0.4)} 100%)`,
      hoverBackground: `linear-gradient(135deg, ${rgbToCss(
        lighten(accentBase, 0.45),
        0.35
      )} 0%, ${rgbToCss(lighten(accentBase, 0.25), 0.48)} 100%)`,
      border: "3px solid rgba(255,255,255,0.28)",
      color: DEFAULT_THEME.iconButton.color,
      hoverColor: DEFAULT_THEME.iconButton.hoverColor,
      shadow: DEFAULT_THEME.iconButton.shadow,
      hoverShadow: DEFAULT_THEME.iconButton.hoverShadow,
    },
    primaryButton: {
      background: `linear-gradient(135deg, ${rgbToCss(
        accentLift
      )} 0%, ${rgbToCss(accentBase)} 50%, ${rgbToCss(accentDeep)} 100%)`,
      hoverBackground: `linear-gradient(135deg, ${rgbToCss(
        lighten(accentBase, 0.12)
      )} 0%, ${rgbToCss(accentDeep)} 50%, ${rgbToCss(accentHover)} 100%)`,
      textColor: DEFAULT_THEME.primaryButton.textColor,
      shadow: `0 22px 48px -18px ${accentShadow}`,
      hoverShadow: `0 26px 56px -20px ${accentHoverShadow}`,
    },
    secondaryButton: {
      border: rgbToCss(lighten(accentBase, 0.3), 0.35),
      textColor: DEFAULT_THEME.secondaryButton.textColor,
      hoverBorder: rgbToCss(lighten(accentBase, 0.45), 0.55),
      hoverBackground: rgbToCss(lighten(accentBase, 0.25), 0.15),
    },
    status: DEFAULT_THEME.status,
    fallback: {
      ...DEFAULT_THEME.fallback,
      icon: rgbToCss(lighten(accentBase, 0.55)),
    },
    warningText: DEFAULT_THEME.warningText,
    progressOverlay: DEFAULT_THEME.progressOverlay,
    spotlight: {
      background: `radial-gradient(circle at 50% 52%, ${rgbToCss(
        spotlightCore,
        0.22
      )} 0%, ${rgbToCss(spotlightCore, 0.94)} 68%, ${rgbToCss(
        spotlightOuter,
        0.98
      )} 100%)`,
      halo: `radial-gradient(circle at 50% 50%, ${rgbToCss(
        lighten(accentBase, 0.45),
        0.28
      )} 0%, ${rgbToCss(
        lighten(accentBase, 0.22),
        0.14
      )} 45%, rgba(0,0,0,0) 70%)`,
      borderColor: rgbToCss(lighten(accentBase, 0.58), 0.24),
      borderGlow: `0 0 42px ${rgbToCss(lighten(accentBase, 0.58), 0.23)}`,
      frameShadow: `0 40px 96px -32px ${rgbToCss(
        darken(accentBase, 0.65),
        0.76
      )}, inset 0 0 42px ${rgbToCss(lighten(accentBase, 0.22), 0.32)}`,
      labelColor: "rgba(255,255,255,0.86)",
      valueColor: "#ffffff",
      valueShadow: `0 48px 94px ${rgbToCss(darken(accentBase, 0.85), 0.7)}`,
    },
  };
};
