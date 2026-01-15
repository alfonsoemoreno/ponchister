import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

interface AdminAccessDialogProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
  error?: string | null;
}

const INITIAL_STATE = {
  email: "",
  password: "",
};

export default function AdminAccessDialog({
  open,
  loading = false,
  onClose,
  onSubmit,
  error,
}: AdminAccessDialogProps) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange =
    (field: "email" | "password") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ email: form.email.trim(), password: form.password });
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ component: "form", onSubmit: handleSubmit }}
    >
      <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
        Acceso administrativo
      </DialogTitle>
      <DialogContent dividers sx={{ backgroundColor: "background.paper" }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Ingresa tus credenciales para gestionar el catálogo de canciones.
          </Typography>
          <TextField
            label="Correo"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange("email")}
            disabled={loading}
            required
            size="small"
          />
          <TextField
            label="Contraseña"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange("password")}
            disabled={loading}
            required
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Mostrar contraseña"
                    onClick={togglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography variant="caption" color="text.secondary">
            ¿No tienes acceso? Contacta al administrador del proyecto para crear
            una cuenta.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined">
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
