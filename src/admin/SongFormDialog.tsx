import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { SongInput, Song } from "./types";

interface SongFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialValue?: Song | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: SongInput) => Promise<void> | void;
}

type FormState = {
  artist: string;
  title: string;
  year: string;
  youtube_url: string;
  isspanish: boolean;
};

const EMPTY_STATE: FormState = {
  artist: "",
  title: "",
  year: "",
  youtube_url: "",
  isspanish: false,
};

export default function SongFormDialog({
  open,
  mode,
  initialValue,
  loading = false,
  onClose,
  onSubmit,
}: SongFormDialogProps) {
  const [values, setValues] = useState<FormState>(EMPTY_STATE);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (initialValue && mode === "edit") {
      setValues({
        artist: initialValue.artist,
        title: initialValue.title,
        year: initialValue.year ? String(initialValue.year) : "",
        youtube_url: initialValue.youtube_url,
        isspanish: initialValue.isspanish,
      });
      setErrors({});
      return;
    }

    if (mode === "create") {
      setValues(EMPTY_STATE);
      setErrors({});
    }
  }, [initialValue, mode]);

  const handleChange =
    (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleToggleSpanish = (
    _event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => {
    setValues((prev) => ({ ...prev, isspanish: checked }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!values.artist.trim()) {
      nextErrors.artist = "El artista es obligatorio";
    }
    if (!values.title.trim()) {
      nextErrors.title = "La canción es obligatoria";
    }
    if (!values.youtube_url.trim()) {
      nextErrors.youtube_url = "El enlace de YouTube es obligatorio";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const parsedYear = values.year.trim();
    const yearValue =
      parsedYear === "" ? null : Number.parseInt(parsedYear, 10);

    const payload: SongInput = {
      artist: values.artist.trim(),
      title: values.title.trim(),
      youtube_url: values.youtube_url.trim(),
      year: Number.isNaN(yearValue) ? null : yearValue,
      isspanish: values.isspanish,
    };

    await onSubmit(payload);

    // Limpiar el formulario después de un envío exitoso en modo crear
    if (mode === "create") {
      setValues(EMPTY_STATE);
      setErrors({});
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      PaperProps={{
        component: "form",
        onSubmit: handleSubmit,
        sx: {
          m: 0,
          borderRadius: 0,
        },
      }}
    >
      <DialogTitle>
        {mode === "create" ? "Agregar canción" : "Editar canción"}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 3 },
        }}
      >
        <Stack spacing={2} sx={{ mt: 0 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Artista"
              value={values.artist}
              onChange={handleChange("artist")}
              error={Boolean(errors.artist)}
              helperText={errors.artist}
              fullWidth
              disabled={loading}
              autoFocus
            />
            <TextField
              label="Canción"
              value={values.title}
              onChange={handleChange("title")}
              error={Boolean(errors.title)}
              helperText={errors.title}
              fullWidth
              disabled={loading}
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Año"
              value={values.year}
              onChange={handleChange("year")}
              type="number"
              inputProps={{ inputMode: "numeric" }}
              fullWidth
              disabled={loading}
            />
            <TextField
              label="Enlace de YouTube"
              value={values.youtube_url}
              onChange={handleChange("youtube_url")}
              error={Boolean(errors.youtube_url)}
              helperText={errors.youtube_url}
              fullWidth
              disabled={loading}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={values.isspanish}
                onChange={handleToggleSpanish}
                color="primary"
                disabled={loading}
              />
            }
            label="La canción es en español"
          />
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 1, sm: 0 },
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 3 },
        }}
      >
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        >
          {mode === "create" ? "Guardar" : "Actualizar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
