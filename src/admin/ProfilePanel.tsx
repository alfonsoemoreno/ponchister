import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AdminUser } from "./types";
import { fetchMyProfile, updateMyProfile } from "./services/userService";

interface ProfilePanelProps {
  currentUser: AdminUser | null;
  onProfileUpdated: (user: AdminUser) => void;
  onFeedback: (payload: {
    severity: "success" | "error";
    message: string;
  }) => void;
}

const MAX_AVATAR_SIZE = 700_000;

export default function ProfilePanel({
  currentUser,
  onProfileUpdated,
  onFeedback,
}: ProfilePanelProps) {
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchMyProfile();
        if (cancelled) return;
        setDisplayName(profile.display_name ?? "");
        setAvatarUrl(profile.avatar_url ?? null);
        onProfileUpdated(profile);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el perfil."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [onProfileUpdated]);

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const reader = new FileReader();
    const result = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer el avatar."));
      reader.readAsDataURL(file);
    });

    if (result.length > MAX_AVATAR_SIZE) {
      onFeedback({
        severity: "error",
        message: "El avatar es demasiado grande. Usa una imagen más liviana.",
      });
      return;
    }

    setAvatarUrl(result);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl,
      });
      onProfileUpdated(updated);
      onFeedback({
        severity: "success",
        message: "Perfil actualizado correctamente.",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo guardar el perfil.";
      setError(message);
      onFeedback({ severity: "error", message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 0,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Mi perfil
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completa tu nombre y avatar para identificar quién crea canciones y playlists.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="center">
            <Avatar
              src={avatarUrl ?? undefined}
              sx={{ width: 88, height: 88, bgcolor: "#0f172a" }}
            >
              {(displayName || currentUser?.email || "U").charAt(0).toUpperCase()}
            </Avatar>
            <Stack spacing={1.5} sx={{ width: "100%" }}>
              <TextField
                label="Nombre visible"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={loading || saving}
                fullWidth
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button component="label" variant="outlined" disabled={loading || saving}>
                  Subir avatar
                  <input hidden accept="image/*" type="file" onChange={handleAvatarChange} />
                </Button>
                <Button
                  variant="text"
                  color="inherit"
                  disabled={loading || saving || !avatarUrl}
                  onClick={() => setAvatarUrl(null)}
                >
                  Quitar avatar
                </Button>
              </Stack>
            </Stack>
          </Stack>

          <Stack spacing={1}>
            <TextField
              label="Email"
              value={currentUser?.email ?? ""}
              disabled
              fullWidth
            />
            <TextField
              label="Rol"
              value={currentUser?.role === "superadmin" ? "Superadmin" : "Editor"}
              disabled
              fullWidth
            />
          </Stack>

          <Box>
            <Button variant="contained" onClick={handleSave} disabled={loading || saving}>
              {saving ? "Guardando..." : "Guardar perfil"}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
