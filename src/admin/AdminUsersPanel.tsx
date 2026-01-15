import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateAdminUser(editing.id, {
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        });
      } else {
        await createAdminUser({
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        });
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
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
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={600}>
            Usuarios administradores
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona superadmins y editores que pueden modificar el catálogo.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Actualizar lista">
            <span>
              <IconButton
                onClick={loadUsers}
                disabled={loading}
                color="inherit"
              >
                <RefreshIcon />
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

      <Divider />

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 0,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {isMobile ? (
          <Stack spacing={2}>
            {users.length === 0 ? (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {loading ? "Cargando..." : "No hay usuarios aún."}
                </Typography>
              </Paper>
            ) : (
              users.map((user) => (
                <Paper
                  key={user.id}
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 0,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {user.email}
                      </Typography>
                    </Box>
                    <Stack direction="row" justifyContent="space-between">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Rol
                        </Typography>
                        <Typography variant="body2">
                          {user.role === "superadmin" ? "Superadmin" : "Editor"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Activo
                        </Typography>
                        <Switch checked={user.active} disabled />
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        onClick={() => handleOpenEdit(user)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
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
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Activo</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      {loading ? "Cargando..." : "No hay usuarios aún."}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.role === "superadmin" ? "Superadmin" : "Editor"}
                      </TableCell>
                      <TableCell>
                        <Switch checked={user.active} disabled />
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editing ? "Editar usuario" : "Crear usuario"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Email"
              value={form.email}
              onChange={handleFormChange("email")}
              disabled={Boolean(editing)}
              fullWidth
              size="small"
            />
            <TextField
              label={editing ? "Nueva contraseña (opcional)" : "Contraseña"}
              type="password"
              value={form.password}
              onChange={handleFormChange("password")}
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
              />
              <Typography variant="body2">
                {form.active ? "Activo" : "Inactivo"}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || (!editing && !form.password)}
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
