import { createTheme } from "@mui/material/styles";

const adminTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#111827",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#64748b",
    },
    error: {
      main: "#ef4444",
    },
    success: {
      main: "#16a34a",
    },
    background: {
      default: "#f5f6f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#64748b",
    },
    divider: "#e2e8f0",
  },
  typography: {
    fontFamily: "'Sora','Poppins','Segoe UI',sans-serif",
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.015em",
    },
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    body1: {
      fontSize: "0.98rem",
      lineHeight: 1.7,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: 0,
    },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(148,163,184,0.3)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          paddingInline: "18px",
          paddingBlock: "8px",
        },
        containedPrimary: {
          boxShadow: "0 12px 24px rgba(15,23,42,0.16)",
        },
        outlined: {
          borderColor: "rgba(100,116,139,0.4)",
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 44,
        },
        indicator: {
          height: 3,
          borderRadius: 0,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#f8fafc",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: "1px solid rgba(148,163,184,0.3)",
          boxShadow: "0 28px 60px rgba(15,23,42,0.14)",
        },
      },
    },
  },
});

export default adminTheme;
