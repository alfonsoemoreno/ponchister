import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Fade,
  Snackbar,
} from "@mui/material";
import { ThemeProvider, useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import AdminDashboard from "./AdminDashboard";
import AdminAccessDialog from "./AdminAccessDialog";
import { loginAdmin, logoutAdmin } from "./services/adminAuth";
import { useAdminSession } from "./hooks/useAdminSession";
import { createAdminTheme } from "./adminTheme";

type AdminColorMode = "light" | "dark";
const ADMIN_THEME_STORAGE_KEY = "ponchister_admin_theme";

interface AdminAppProps {
  onExit: () => void;
}

interface AdminAppContentProps extends AdminAppProps {
  colorMode: AdminColorMode;
  onToggleColorMode: () => void;
}

function AdminAppContent({ onExit, colorMode, onToggleColorMode }: AdminAppContentProps) {
  const theme = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const { user, loading: authLoading, refresh } = useAdminSession();

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setLoginOpen(false);
    } else {
      setLoginError(null);
      setLoginOpen(true);
    }
  }, [authLoading, user]);

  const handleLogin = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await loginAdmin({ email, password });
      await refresh();
      setLoginOpen(false);
      setSnackbar("Sesión iniciada correctamente.");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutAdmin();
      await refresh();
      setSnackbar("Sesión cerrada.");
    } catch (err) {
      setSnackbar(
        err instanceof Error
          ? err.message
          : "No se pudo cerrar la sesión. Intenta nuevamente."
      );
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar(null);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        position: "relative",
        overflowY: "auto",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      {!user ? (
        <Box
          sx={{
            position: "fixed",
            top: { xs: 12, sm: 16 },
            right: { xs: 12, sm: 16 },
            zIndex: 2100,
            display: "flex",
            gap: 1.5,
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={onExit}
            sx={{
              minWidth: { xs: 120, sm: 150 },
              fontWeight: 600,
              borderColor: alpha(theme.palette.primary.main, 0.25),
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.background.paper, 0.75),
              "&:hover": {
                borderColor: alpha(theme.palette.primary.main, 0.45),
                backgroundColor: alpha(theme.palette.background.paper, 0.95),
              },
            }}
          >
            Volver
          </Button>
        </Box>
      ) : null}

      {authLoading ? (
        <Fade in timeout={250} appear>
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: alpha(theme.palette.background.default, 0.65),
              zIndex: 1200,
            }}
          >
            <CircularProgress color="primary" />
          </Box>
        </Fade>
      ) : null}

      {user ? (
        <AdminDashboard
          onExit={onExit}
          onSignOut={handleSignOut}
          currentUser={user}
          userEmail={user.email}
          userRole={user.role}
          onSessionRefresh={refresh}
          colorMode={colorMode}
          onToggleColorMode={onToggleColorMode}
        />
      ) : null}

      <AdminAccessDialog
        open={loginOpen}
        loading={loginLoading}
        onClose={() => {
          if (user) {
            setLoginOpen(false);
          } else {
            onExit();
          }
        }}
        onSubmit={handleLogin}
        error={loginError}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snackbar ? <Alert severity="info">{snackbar}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

export default function AdminApp({ onExit }: AdminAppProps) {
  const [colorMode, setColorMode] = useState<AdminColorMode>("light");
  const [colorModeReady, setColorModeReady] = useState(false);
  const theme = useMemo(() => createAdminTheme(colorMode), [colorMode]);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (savedMode === "light" || savedMode === "dark") setColorMode(savedMode);
    setColorModeReady(true);
  }, []);

  useEffect(() => {
    if (colorModeReady) {
      window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, colorMode);
    }
  }, [colorMode, colorModeReady]);

  return (
    <ThemeProvider theme={theme}>
      <AdminAppContent
        onExit={onExit}
        colorMode={colorMode}
        onToggleColorMode={() => setColorMode((current) => current === "light" ? "dark" : "light")}
      />
    </ThemeProvider>
  );
}
