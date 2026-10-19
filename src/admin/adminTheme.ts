import { createTheme, type PaletteMode } from "@mui/material/styles";

export function createAdminTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
  palette: {
    mode,
    primary: {
      main: "#f06449",
      light: "#ff9274",
      dark: "#c94a35",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#00a7b5",
      light: "#54cbd0",
      dark: "#007d8b",
    },
    error: {
      main: "#c83b54",
    },
    success: {
      main: "#16866d",
      light: "#e8f7f1",
      dark: "#10634f",
    },
    info: {
      main: "#5856b8",
      light: "#efefff",
      dark: "#41408e",
    },
    warning: {
      main: "#a96300",
      light: "#fff5df",
      dark: "#824d00",
    },
    background: {
      default: isDark ? "#12171e" : "#fffdfb",
      paper: isDark ? "#1b222b" : "#ffffff",
    },
    text: {
      primary: isDark ? "#f2f4f7" : "#25243a",
      secondary: isDark ? "#b0bac6" : "#6f7082",
    },
    divider: isDark ? "#35414d" : "#eee8e3",
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
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${isDark ? "#35414d" : "#eee8e3"}`,
          boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.18)" : "0 2px 8px rgba(43,35,91,0.035)",
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
          borderRadius: 8,
          minHeight: 40,
          paddingInline: "16px",
          paddingBlock: "8px",
          fontWeight: 600,
          transition: "background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
        },
        containedPrimary: {
          boxShadow: "0 2px 5px rgba(240,100,73,0.18)",
          "&:hover": {
            boxShadow: "0 4px 10px rgba(240,100,73,0.24)",
          },
        },
        outlined: {
          borderColor: "#cbd5e1",
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
          borderRadius: 999,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? "#222b35" : "#fff8f4",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: `1px solid ${isDark ? "#35414d" : "#eee8e3"}`,
          boxShadow: isDark ? "0 16px 40px rgba(0,0,0,0.42)" : "0 16px 40px rgba(43,35,91,0.12)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: isDark ? "#1b222b" : "#ffffff",
          transition: "box-shadow 140ms ease",
          "&.Mui-focused": {
          boxShadow: "0 0 0 3px rgba(240,100,73,0.14)",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 500,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: isDark ? "#ff9a80" : "#c94a35",
          fontWeight: 600,
          borderBottomColor: isDark ? "#35414d" : "#eee8e3",
        },
        body: {
          borderBottomColor: isDark ? "#2b3540" : "#f5f1ed",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
  },
  });
}

export default createAdminTheme("light");
