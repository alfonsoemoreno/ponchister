import { Box, type SxProps, type Theme } from "@mui/material";
import type { FC } from "react";

interface NeonLinesProps {
  active?: boolean;
  className?: string;
  sx?: SxProps<Theme>;
}

export const NeonLines: FC<NeonLinesProps> = ({
  active = true,
  className,
  sx,
}) => {
  if (!active) {
    return null;
  }

  const classNames = ["neon-lines", className].filter(Boolean).join(" ");

  return (
    <Box className={classNames} sx={sx}>
      <Box
        className="neon-line"
        sx={{
          top: "18%",
          background: "linear-gradient(90deg, #00fff7, #0ff, #fff)",
          boxShadow: "0 0 16px #00fff7",
          animation: "neon-move-right 2.5s linear infinite",
        }}
      />
      <Box
        className="neon-line"
        sx={{
          top: "32%",
          background: "linear-gradient(90deg, #ff00ea, #fff, #ff0)",
          boxShadow: "0 0 16px #ff00ea",
          animation: "neon-move-left 3.2s linear infinite",
        }}
      />
      <Box
        className="neon-line"
        sx={{
          top: "46%",
          background: "linear-gradient(90deg, #fff200, #fff, #00ff6a)",
          boxShadow: "0 0 16px #fff200",
          animation: "neon-move-right 2.1s linear infinite",
        }}
      />
      <Box
        className="neon-line"
        sx={{
          top: "60%",
          background: "linear-gradient(90deg, #00ff6a, #fff, #00fff7)",
          boxShadow: "0 0 16px #00ff6a",
          animation: "neon-move-left 2.8s linear infinite",
        }}
      />
      <Box
        className="neon-line"
        sx={{
          top: "74%",
          background: "linear-gradient(90deg, #ff0, #fff, #ff00ea)",
          boxShadow: "0 0 16px #ff0",
          animation: "neon-move-right 3.5s linear infinite",
        }}
      />
    </Box>
  );
};

export default NeonLines;
