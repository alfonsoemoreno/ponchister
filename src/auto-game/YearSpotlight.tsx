import { Box, Typography } from "@mui/material";
import type { FC } from "react";

export interface YearSpotlightStyle {
  background: string;
  halo: string;
  borderColor: string;
  borderGlow: string;
  frameShadow: string;
  labelColor: string;
  valueColor: string;
  valueShadow: string;
}

const DEFAULT_STYLE: YearSpotlightStyle = {
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
};

interface YearSpotlightProps {
  visible: boolean;
  value: string | number | null;
  label?: string;
  styles?: YearSpotlightStyle;
}

export const YearSpotlight: FC<YearSpotlightProps> = ({
  visible,
  value,
  label,
  styles,
}) => {
  if (!visible || value === null || value === "") {
    return null;
  }

  const palette = styles ?? DEFAULT_STYLE;
  const effectiveLabel = label ?? "Año";
  const displayValue = typeof value === "number" ? value.toString() : value;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4,
        pointerEvents: "none",
      }}
    >
      <Box
        className="year-spotlight"
        sx={{
          position: "relative",
          width: { xs: "88vw", sm: "74vw", md: "58vw" },
          height: { xs: "88vh", sm: "74vh", md: "58vh" },
          maxWidth: 900,
          maxHeight: 640,
          minWidth: 240,
          minHeight: 240,
          borderRadius: { xs: 6, md: 10 },
          background: palette.background,
          boxShadow: palette.frameShadow,
          color: palette.valueColor,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2.2,
          overflow: "hidden",
          viewTransitionName: "auto-game-spotlight",
          animation:
            "year-spotlight-fallback 4200ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards",
          willChange: "transform, opacity",
          "&::before": {
            content: "''",
            position: "absolute",
            inset: { xs: -28, md: -38 },
            borderRadius: "inherit",
            background: palette.halo,
            filter: "blur(18px)",
            opacity: 0,
          },
          "&::after": {
            content: "''",
            position: "absolute",
            inset: { xs: -8, md: -12 },
            borderRadius: "inherit",
            border: `1px solid ${palette.borderColor}`,
            boxShadow: palette.borderGlow,
            opacity: 0.6,
          },
        }}
      >
        <Typography
          variant="subtitle1"
          className="year-spotlight__label"
          sx={{
            letterSpacing: { xs: 10, sm: 16 },
            textTransform: "uppercase",
            opacity: 0.86,
            fontWeight: 600,
            fontSize: { xs: "1.05rem", sm: "1.35rem" },
            color: palette.labelColor,
            animation:
              "year-spotlight-label-fallback 4200ms cubic-bezier(0.3, 0.8, 0.42, 1) forwards",
          }}
        >
          {effectiveLabel}
        </Typography>
        <Typography
          variant="h1"
          className="year-spotlight__value"
          sx={{
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-0.03em",
            color: palette.valueColor,
            textShadow: palette.valueShadow,
            fontSize: {
              xs: "clamp(3.8rem, 18vw, 9rem)",
              sm: "clamp(5rem, 16vw, 10.5rem)",
              md: "clamp(6rem, 14vw, 11.5rem)",
            },
            animation:
              "year-spotlight-value-fallback 4200ms cubic-bezier(0.18, 0.82, 0.34, 1) forwards",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textTransform: typeof value === "string" ? "none" : undefined,
          }}
        >
          {displayValue}
        </Typography>
      </Box>
    </Box>
  );
};

export default YearSpotlight;
