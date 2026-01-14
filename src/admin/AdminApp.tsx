import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Fade,
  Snackbar,
  Tooltip,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { alpha, useTheme } from "@mui/material/styles";
import PDFCardGenerator from "../PDFCardGenerator";
import AdminDashboard from "./AdminDashboard";
import AdminAccessDialog from "./AdminAccessDialog";
import { loginAdmin, logoutAdmin } from "./services/adminAuth";
import { useAdminSession } from "./hooks/useAdminSession";
import ponchocardsTheme from "../theme";

type ViewMode = "generator" | "admin";

interface AdminAppProps {
  onExit: () => void;
}

function AdminAppContent({ onExit }: AdminAppProps) {
  const [view, setView] = useState<ViewMode>("generator");
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { user, loading: authLoading, refresh } = useAdminSession();
  const theme = useTheme();

  useEffect(() => {
    if (!user) {
      setView("generator");
      setLoginOpen(false);
    }
  }, [user]);

  const handleOpenAdmin = () => {
    if (user) {
      setView("admin");
    } else {
      setLoginError(null);
      setLoginOpen(true);
    }
  };

  const handleCloseAdmin = () => {
    setView("generator");
  };

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
      setView("admin");
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

  const accessLabel = useMemo(() => {
    if (authLoading) return "Validando...";
    if (user) return "Administración";
    return "Acceso admin";
  }, [authLoading, user]);

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
        <Tooltip
          title="Acceso restringido"
          arrow
          disableHoverListener={Boolean(user)}
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenAdmin}
              disabled={authLoading}
              sx={{
                minWidth: { xs: 148, sm: 184 },
                fontWeight: 700,
                backgroundImage:
                  view === "admin"
                    ? theme.customGradients.lagoon
                    : theme.customGradients.plasma,
                borderColor: alpha("#ffffff", 0.25),
                boxShadow:
                  "0 25px 50px -24px rgba(36,73,187,0.65), inset 0 1px 0 rgba(255,255,255,0.25)",
                backdropFilter: "blur(14px)",
                "&:hover": {
                  backgroundImage: theme.customGradients.sunset,
                  boxShadow:
                    "0 30px 60px -24px rgba(36,73,187,0.75), inset 0 1px 0 rgba(255,255,255,0.35)",
                },
              }}
            >
              {accessLabel}
            </Button>
          </span>
        </Tooltip>
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

      {view === "admin" && user ? (
        <AdminDashboard
          onExit={handleCloseAdmin}
          onSignOut={handleSignOut}
          userEmail={user.email}
          userRole={user.role}
        />
      ) : (
        <PDFCardGenerator />
      )}

      <AdminAccessDialog
        open={loginOpen}
        loading={loginLoading}
        onClose={() => setLoginOpen(false)}
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
