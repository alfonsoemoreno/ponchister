import { Box, Typography } from "@mui/material";
import type { FC } from "react";

interface YearSpotlightProps {
  visible: boolean;
  year: number | null;
}

export const YearSpotlight: FC<YearSpotlightProps> = ({ visible, year }) => {
  if (!visible || year === null) {
    return null;
  }

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
          background:
            "radial-gradient(circle at 50% 52%, rgba(255,255,255,0.25) 0%, rgba(10,24,66,0.92) 68%, rgba(3,8,24,0.96) 100%)",
          boxShadow:
            "0 40px 96px -32px rgba(4,12,42,0.76), inset 0 0 42px rgba(45,132,255,0.18)",
          color: "#ffffff",
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
            background:
              "radial-gradient(circle at 50% 50%, rgba(86,199,255,0.28) 0%, rgba(25,109,255,0.12) 45%, rgba(0,0,0,0) 70%)",
            filter: "blur(18px)",
            opacity: 0,
          },
          "&::after": {
            content: "''",
            position: "absolute",
            inset: { xs: -8, md: -12 },
            borderRadius: "inherit",
            border: "1px solid rgba(173,215,255,0.22)",
            boxShadow: "0 0 42px rgba(32,139,255,0.25)",
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
            animation:
              "year-spotlight-label-fallback 4200ms cubic-bezier(0.3, 0.8, 0.42, 1) forwards",
          }}
        >
          Año
        </Typography>
        <Typography
          variant="h1"
          className="year-spotlight__value"
          sx={{
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-0.03em",
            textShadow: "0 48px 94px rgba(0,0,0,0.78)",
            fontSize: {
              xs: "clamp(3.8rem, 18vw, 9rem)",
              sm: "clamp(5rem, 16vw, 10.5rem)",
              md: "clamp(6rem, 14vw, 11.5rem)",
            },
            animation:
              "year-spotlight-value-fallback 4200ms cubic-bezier(0.18, 0.82, 0.34, 1) forwards",
          }}
        >
          {year}
        </Typography>
      </Box>
    </Box>
  );
};

export default YearSpotlight;
