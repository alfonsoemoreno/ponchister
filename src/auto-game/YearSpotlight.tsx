import { Box, Typography } from "@mui/material";
import { keyframes } from "@mui/system";
import type { FC } from "react";

const yearSpotlightPulse = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.65);
    filter: blur(18px);
  }
  14% {
    opacity: 0.45;
    transform: scale(0.82);
    filter: blur(14px);
  }
  36% {
    opacity: 0.92;
    transform: scale(1.02);
    filter: blur(8px);
  }
  58% {
    opacity: 1;
    transform: scale(1.32);
    filter: blur(3px);
  }
  78% {
    opacity: 0.74;
    transform: scale(1.72);
    filter: blur(7px);
  }
  100% {
    opacity: 0;
    transform: scale(2.08);
    filter: blur(12px);
  }
`;

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
        sx={{
          width: { xs: "90vw", sm: "78vw", md: "62vw" },
          height: { xs: "90vh", sm: "78vh", md: "62vh" },
          maxWidth: 980,
          maxHeight: 720,
          minWidth: 260,
          minHeight: 260,
          borderRadius: { xs: 6, md: 8 },
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.22), rgba(5,18,52,0.9))",
          boxShadow: "0 52px 120px -34px rgba(2,8,34,0.88)",
          color: "#ffffff",
          textAlign: "center",
          animation: `${yearSpotlightPulse} 3.2s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
          willChange: "transform, opacity, filter",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            letterSpacing: { xs: 10, sm: 16 },
            textTransform: "uppercase",
            opacity: 0.86,
            fontWeight: 600,
            fontSize: { xs: "1.05rem", sm: "1.35rem" },
          }}
        >
          Año
        </Typography>
        <Typography
          variant="h1"
          sx={{
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-0.03em",
            textShadow: "0 48px 90px rgba(0,0,0,0.75)",
            fontSize: {
              xs: "clamp(3.8rem, 18vw, 9rem)",
              sm: "clamp(5rem, 16vw, 10.5rem)",
              md: "clamp(6rem, 14vw, 11.5rem)",
            },
          }}
        >
          {year}
        </Typography>
      </Box>
    </Box>
  );
};

export default YearSpotlight;
