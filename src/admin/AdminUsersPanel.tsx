import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { AdminRole, AdminUser } from "./types";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "./services/userService";

interface UserFormState {
  email: string;
  password: string;
  role: AdminRole;
  active: boolean;
}

const INITIAL_FORM: UserFormState = {
  email: "",
  password: "",
  role: "editor",
  active: true,
};

interface AdminUsersPanelProps {
  isSuperAdmin: boolean;
}

export default function AdminUsersPanel({ isSuperAdmin }: AdminUsersPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditing(user);
    setForm({
      email: user.email,
      password: "",
      role: user.role,
      active: user.active,
    });
    setDialogError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  const handleFormChange =
    (field: keyof UserFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        field === "active" ? event.target.checked : event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSave = async () => {
    const email = form.email.trim();
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDialogError("Ingresa un email válido.");
      return;
    }
    if ((!editing || form.password) && form.password.trim().length < 8) {
      setDialogError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setSaving(true);
    setDialogError(null);
    try {
      if (editing) {
        await updateAdminUser(editing.id, {
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        });
      } else {
        await createAdminUser({
          email,
          password: form.password,
          role: form.role,
          active: form.active,
        });
      }
      setDialogOpen(false);
      setNotice(editing ? "Usuario actualizado." : "Usuario creado.");
      await loadUsers();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await deleteAdminUser(deleteTarget.id);
      setDeleteTarget(null);
      setNotice("Usuario eliminado.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <Alert severity="info">
        Solo los superadmins pueden administrar usuarios.
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h6" fontWeight={700}>Usuarios administradores</Typography>
            <Chip label={`${users.length} ${users.length === 1 ? "usuario" : "usuarios"}`} size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Accesos con permisos para administrar el catálogo.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Tooltip title="Actualizar lista" disableInteractive>
            <span>
              <IconButton
                onClick={loadUsers}
                disabled={loading}
                color="inherit"
                aria-label="Actualizar lista de usuarios"
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            disabled={loading}
          >
            Nuevo usuario
          </Button>
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 1.5,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {isMobile ? (
          <Stack spacing={2}>
            {users.length === 0 ? (
              <Box sx={{ py: 5, display: "flex", justifyContent: "center", alignItems: "center", gap: 1.5 }}>
                {loading ? <CircularProgress size={20} /> : null}
                <Typography variant="body2" color="text.secondary">
                  {loading ? "Cargando usuarios…" : "Todavía no hay usuarios administradores."}
                </Typography>
              </Box>
            ) : (
              users.map((user) => (
                <Paper
                  key={user.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 1.25,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                  >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                      <Avatar
                        src={user.avatar_url ?? undefined}
                        sx={{ width: 42, height: 42, bgcolor: "primary.main" }}
                      >
                        {(user.display_name || user.email || "U").charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                          {user.email}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.display_name || "Sin nombre visible"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Chip label={user.role === "superadmin" ? "Superadmin" : "Editor"} size="small" color={user.role === "superadmin" ? "primary" : "default"} variant={user.role === "superadmin" ? "filled" : "outlined"} />
                      <Chip label={user.active ? "Activo" : "Inactivo"} size="small" color={user.active ? "success" : "default"} variant={user.active ? "filled" : "outlined"} />
                    </Stack>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleOpenEdit(user)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        onClick={() => setDeleteTarget(user)}
                      >
                        Eliminar
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        ) : (
          <Box sx={{ overflowX: "auto", maxHeight: "min(68vh, 760px)" }}>
            <Table size="medium" stickyHeader sx={{ minWidth: 720, "& th": { fontWeight: 700, fontSize: 12, color: "text.secondary", backgroundColor: "background.paper" }, "& tbody td": { py: 1.4 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Activo</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {loading ? "Cargando usuarios…" : "Todavía no hay usuarios administradores."}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Avatar
                            src={user.avatar_url ?? undefined}
                            sx={{ width: 30, height: 30, bgcolor: "primary.main", fontSize: 13 }}
                          >
                            {(user.display_name || user.email || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{user.email}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{user.display_name || "-"}</TableCell>
                      <TableCell>
                        <Chip label={user.role === "superadmin" ? "Superadmin" : "Editor"} size="small" color={user.role === "superadmin" ? "primary" : "default"} variant={user.role === "superadmin" ? "filled" : "outlined"} />
                      </TableCell>
                      <TableCell>
                        <Chip label={user.active ? "Activo" : "Inactivo"} size="small" color={user.active ? "success" : "default"} variant={user.active ? "filled" : "outlined"} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Tooltip title="Editar">
                            <span>
                              <IconButton
                                onClick={() => handleOpenEdit(user)}
                                color="inherit"
                              >
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <span>
                              <IconButton
                                onClick={() => setDeleteTarget(user)}
                                color="inherit"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          component: "form",
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void handleSave();
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editing ? "Editar usuario" : "Crear usuario"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {dialogError ? <Alert severity="error">{dialogError}</Alert> : null}
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={handleFormChange("email")}
              disabled={Boolean(editing)}
              required={!editing}
              autoComplete="email"
              fullWidth
              size="small"
            />
            <TextField
              label={editing ? "Nueva contraseña (opcional)" : "Contraseña"}
              type="password"
              value={form.password}
              onChange={handleFormChange("password")}
              required={!editing}
              autoComplete="new-password"
              inputProps={{ minLength: 8 }}
              helperText={editing ? "Déjala vacía para conservar la contraseña actual. Mínimo 8 caracteres si la cambias." : "Mínimo 8 caracteres."}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Rol"
              value={form.role}
              onChange={handleFormChange("role")}
              size="small"
            >
              <MenuItem value="superadmin">Superadmin</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
            </TextField>
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={form.active}
                onChange={handleFormChange("active")}
                disabled={saving}
              />
              <Typography variant="body2">
                {form.active ? "Activo" : "Inactivo"}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDialog} disabled={saving} variant="outlined">
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => (deleteLoading ? undefined : setDeleteTarget(null))}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Eliminar usuario</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            ¿Seguro que deseas eliminar el acceso de{" "}
            <strong>{deleteTarget?.email}</strong>? Esta acción no se puede
            deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleteLoading}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
