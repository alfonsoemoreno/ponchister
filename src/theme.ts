import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    gradient: {
      primary: string;
      accent: string;
      glass: string;
      midnight: string;
    };
  }

  interface PaletteOptions {
    gradient?: {
      primary: string;
      accent: string;
      glass: string;
      midnight: string;
    };
  }

  interface Theme {
    customGradients: {
      plasma: string;
      sunset: string;
      lagoon: string;
    };
  }

  interface ThemeOptions {
    customGradients?: {
      plasma: string;
      sunset: string;
      lagoon: string;
    };
  }
}

const primaryBlue = "#2449bb";
const electricAzure = "#63d5f5";
const midnight = "#0f172a";

const fontStack = [
  "Poppins",
  "Inter",
  "Segoe UI",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
].join(",");

const theme = createTheme({
  customGradients: {
    plasma:
      "linear-gradient(105deg, rgba(99,213,245,0.35) 0%, rgba(110,67,255,0.55) 35%, rgba(244,114,182,0.48) 70%, rgba(255,255,255,0.4) 100%)",
    sunset:
      "linear-gradient(120deg, rgba(255,143,178,0.4) 0%, rgba(255,198,103,0.45) 45%, rgba(255,231,186,0.38) 100%)",
    lagoon:
      "linear-gradient(120deg, rgba(79,214,220,0.35) 0%, rgba(42,135,255,0.5) 45%, rgba(164,214,255,0.4) 100%)",
  },
  palette: {
    mode: "light",
    primary: {
      main: primaryBlue,
      contrastText: "#f5fbff",
    },
    secondary: {
      main: electricAzure,
      contrastText: midnight,
    },
    error: {
      main: "#ff5d7d",
    },
    success: {
      main: "#4fdba7",
    },
    background: {
      default: midnight,
      paper: "rgba(248, 250, 255, 0.92)",
    },
    text: {
      primary: "rgba(15, 23, 42, 0.92)",
      secondary: "rgba(15, 23, 42, 0.64)",
    },
    gradient: {
      primary:
        "linear-gradient(145deg, rgba(15,23,42,1) 0%, rgba(36,73,187,0.95) 48%, rgba(79,139,255,0.9) 72%, rgba(99,213,245,0.9) 100%)",
      accent:
        "linear-gradient(135deg, rgba(110,67,255,0.92) 0%, rgba(178,106,250,0.88) 55%, rgba(255,188,213,0.9) 100%)",
      glass:
        "linear-gradient(155deg, rgba(255,255,255,0.9) 0%, rgba(242,246,255,0.92) 55%, rgba(229,240,255,0.88) 100%)",
      midnight:
        "radial-gradient(circle at 10% 10%, rgba(79,139,255,0.32) 0%, transparent 38%), radial-gradient(circle at 90% 15%, rgba(110,67,255,0.3) 0%, transparent 42%), radial-gradient(circle at 45% 80%, rgba(50,212,255,0.28) 0%, transparent 48%)",
    },
  },
  typography: {
    fontFamily: fontStack,
    fontWeightRegular: 400,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    h1: {
      fontWeight: 800,
      fontSize: "3.4rem",
      lineHeight: 1.08,
      letterSpacing: "-0.02em",
      textTransform: "none",
    },
    h2: {
      fontWeight: 700,
      fontSize: "2.7rem",
      lineHeight: 1.12,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontWeight: 700,
      fontSize: "2.15rem",
      letterSpacing: "-0.01em",
    },
    h4: {
      fontWeight: 700,
      fontSize: "1.85rem",
      letterSpacing: "-0.005em",
    },
    subtitle1: {
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.7,
    },
    body2: {
      fontSize: "0.94rem",
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
      letterSpacing: "0.02em",
    },
  },
  shape: {
    borderRadius: 5,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: midnight,
          backgroundImage:
            "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(21,37,74,1) 40%, rgba(31,60,122,1) 100%)",
          color: "rgba(248,250,255,0.96)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: ({ theme: th }) => ({
          borderRadius: th.shape.borderRadius,
          paddingInline: th.spacing(2.75),
          paddingBlock: th.spacing(1.2),
          transition: "all 260ms ease",
          boxShadow: "0 18px 35px -18px rgba(36,73,187,0.6)",
          borderWidth: 2,
        }),
        containedPrimary: {
          backgroundImage:
            "linear-gradient(135deg, #2449bb 0%, #3a72ff 60%, #63d5f5 100%)",
          color: "#ffffff",
          borderColor: "transparent",
          boxShadow: "0 22px 45px -20px rgba(49,113,227,0.6)",
          "&:hover": {
            backgroundImage:
              "linear-gradient(135deg, #2d57d6 0%, #3f7eff 60%, #55c9ef 100%)",
            boxShadow: "0 26px 50px -20px rgba(49,113,227,0.65)",
          },
        },
        outlined: {
          borderWidth: 2,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.24)",
          color: "#ffffff",
          "&:hover": {
            borderColor: "rgba(255,255,255,0.5)",
            backgroundColor: "rgba(255,255,255,0.14)",
          },
        },
        text: {
          color: primaryBlue,
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          backgroundImage:
            "linear-gradient(155deg, rgba(255,255,255,0.95) 0%, rgba(245,247,255,0.92) 50%, rgba(232,241,255,0.9) 100%)",
          border: "1px solid rgba(31,60,122,0.1)",
          boxShadow: "0 28px 45px -28px rgba(16,41,82,0.35)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          backdropFilter: "blur(14px)",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 5,
          backgroundImage:
            "linear-gradient(160deg, rgba(255,255,255,0.94) 0%, rgba(236,243,255,0.94) 55%, rgba(221,235,255,0.9) 100%)",
          border: "1px solid rgba(31,60,122,0.09)",
          boxShadow: "0 32px 80px rgba(12,30,66,0.4)",
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          backdropFilter: "blur(12px)",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "rgba(12,30,66,0.85)",
          backdropFilter: "blur(12px)",
          fontSize: "0.75rem",
          borderRadius: 5,
        },
        arrow: {
          color: "rgba(12,30,66,0.85)",
        },
      },
    },
  },
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
});

export default theme;
