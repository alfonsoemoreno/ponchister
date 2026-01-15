import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Fade,
  Snackbar,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import AdminDashboard from "./AdminDashboard";
import AdminAccessDialog from "./AdminAccessDialog";
import { loginAdmin, logoutAdmin } from "./services/adminAuth";
import { useAdminSession } from "./hooks/useAdminSession";
import ponchocardsTheme from "../theme";

interface AdminAppProps {
  onExit: () => void;
}

function AdminAppContent({ onExit }: AdminAppProps) {
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
      }}
    >
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
            fontWeight: 700,
            borderColor: alpha("#ffffff", 0.35),
            color: "#fff",
            "&:hover": {
              borderColor: alpha("#ffffff", 0.6),
              backgroundColor: alpha("#ffffff", 0.08),
            },
          }}
        >
          Volver
        </Button>
      </Box>

      {authLoading ? (
        <Fade in timeout={250} appear>
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.35)",
              zIndex: 1200,
            }}
          >
            <CircularProgress color="inherit" sx={{ color: "#fff" }} />
          </Box>
        </Fade>
      ) : null}

      {user ? (
        <AdminDashboard
          onExit={onExit}
          onSignOut={handleSignOut}
          userEmail={user.email}
          userRole={user.role}
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
  return (
    <ThemeProvider theme={ponchocardsTheme}>
      <AdminAppContent onExit={onExit} />
    </ThemeProvider>
  );
}
