import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { SongInput, Song } from "./types";
import {
  getSongTagLabel,
  isSpanishTagSelected,
  normalizeSongTags,
  type SongTagDefinition,
  type SongTag,
} from "../lib/songTags";

interface SongFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialValue?: Song | null;
  availableSongTags: SongTagDefinition[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: SongInput) => Promise<boolean | void> | boolean | void;
}

type FormState = {
  artist: string;
  title: string;
  year: string;
  play_start_seconds: string;
  youtube_url: string;
  tags: SongTag[];
  mimica: boolean;
  tararear: boolean;
  karaoke: boolean;
  karaoke_pause_seconds: string;
  karaoke_lyric: string;
  trivia: boolean;
  trivia_question: string;
  trivia_answer: string;
};

const EMPTY_STATE: FormState = {
  artist: "",
  title: "",
  year: "",
  play_start_seconds: "0",
  youtube_url: "",
  tags: [],
  mimica: false,
  tararear: false,
  karaoke: false,
  karaoke_pause_seconds: "0",
  karaoke_lyric: "",
  trivia: false,
  trivia_question: "",
  trivia_answer: "",
};

export default function SongFormDialog({
  open,
  mode,
  initialValue,
  availableSongTags,
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
        play_start_seconds: String(initialValue.play_start_seconds ?? 0),
        youtube_url: initialValue.youtube_url,
        tags: normalizeSongTags(initialValue.tags, initialValue.isspanish),
        mimica: initialValue.mimica === true,
        tararear: initialValue.tararear === true,
        karaoke: initialValue.karaoke === true,
        karaoke_pause_seconds: String(initialValue.karaoke_pause_seconds ?? 0),
        karaoke_lyric: initialValue.karaoke_lyric ?? "",
        trivia: initialValue.trivia === true,
        trivia_question: initialValue.trivia_question ?? "",
        trivia_answer: initialValue.trivia_answer ?? "",
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

  const handleToggleTag = (tag: SongTag) => {
    setValues((prev) => {
      const nextTags = prev.tags.includes(tag)
        ? prev.tags.filter((item) => item !== tag)
        : normalizeSongTags([...prev.tags, tag]);
      return { ...prev, tags: nextTags };
    });
  };

  const handleMimicaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, mimica: event.target.checked }));
  };

  const handleTararearChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, tararear: event.target.checked }));
  };

  const handleKaraokeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setValues((prev) => ({
      ...prev,
      karaoke: checked,
      karaoke_pause_seconds: checked ? prev.karaoke_pause_seconds : "0",
      karaoke_lyric: checked ? prev.karaoke_lyric : "",
    }));
  };

  const handleTriviaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setValues((prev) => ({
      ...prev,
      trivia: checked,
      trivia_question: checked ? prev.trivia_question : "",
      trivia_answer: checked ? prev.trivia_answer : "",
    }));
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
    const parsedPlayStartSeconds = values.play_start_seconds.trim();
    const playStartSecondsValue =
      parsedPlayStartSeconds === ""
        ? 0
        : Number.parseInt(parsedPlayStartSeconds, 10);
    const parsedKaraokePauseSeconds = values.karaoke_pause_seconds.trim();
    const karaokePauseSecondsValue =
      parsedKaraokePauseSeconds === ""
        ? 0
        : Number.parseInt(parsedKaraokePauseSeconds, 10);

    if (values.karaoke) {
      if (Number.isNaN(karaokePauseSecondsValue) || karaokePauseSecondsValue < 0) {
        nextErrors.karaoke_pause_seconds = "Indica un segundo de pausa válido";
      }
      if (!values.karaoke_lyric.trim()) {
        nextErrors.karaoke_lyric = "Debes agregar la letra del karaoke";
      }
    }

    if (values.trivia) {
      if (!values.trivia_question.trim()) {
        nextErrors.trivia_question = "Debes agregar la pregunta de trivia";
      }
      if (!values.trivia_answer.trim()) {
        nextErrors.trivia_answer = "Debes agregar la respuesta de trivia";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const tags = normalizeSongTags(values.tags);
    const payload: SongInput = {
      artist: values.artist.trim(),
      title: values.title.trim(),
      youtube_url: values.youtube_url.trim(),
      year: Number.isNaN(yearValue) ? null : yearValue,
      play_start_seconds: Number.isNaN(playStartSecondsValue)
        ? 0
        : Math.max(0, playStartSecondsValue),
      tags,
      isspanish: isSpanishTagSelected(tags),
      mimica: values.mimica,
      tararear: values.tararear,
      karaoke: values.karaoke,
      karaoke_pause_seconds:
        values.karaoke && !Number.isNaN(karaokePauseSecondsValue)
          ? Math.max(0, karaokePauseSecondsValue)
          : 0,
      karaoke_lyric: values.karaoke ? values.karaoke_lyric.trim() : null,
      trivia: values.trivia,
      trivia_question: values.trivia ? values.trivia_question.trim() : null,
      trivia_answer: values.trivia ? values.trivia_answer.trim() : null,
    };

    const submitted = await onSubmit(payload);

    // Limpiar el formulario después de un envío exitoso en modo crear
    if (submitted !== false && mode === "create") {
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
              label="Inicio (segundos)"
              value={values.play_start_seconds}
              onChange={handleChange("play_start_seconds")}
              type="number"
              inputProps={{ inputMode: "numeric", min: 0, step: 1 }}
              helperText="Desde qué segundo debe arrancar en el juego."
              fullWidth
              disabled={loading}
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
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
          <Box>
            <Stack spacing={1.2} sx={{ mb: 1.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.mimica}
                    onChange={handleMimicaChange}
                    disabled={loading}
                  />
                }
                label="Modo mímica"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.tararear}
                    onChange={handleTararearChange}
                    disabled={loading}
                  />
                }
                label="Modo tararear"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.karaoke}
                    onChange={handleKaraokeChange}
                    disabled={loading}
                  />
                }
                label="Modo karaoke"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.trivia}
                    onChange={handleTriviaChange}
                    disabled={loading}
                  />
                }
                label="Modo trivia"
              />
            </Stack>
            <Typography variant="body2" sx={{ mb: 0.75, color: "text.secondary" }}>
              Mímica: QR y control remoto para revelar la canción en otro dispositivo.
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Tararear: igual que mímica, pero además la canción suena al 30% en el celular mientras se mantiene el botón apretado.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
              Karaoke: la canción se pausa en el segundo configurado para que continúen la letra antes de seguir reproduciendo.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
              Trivia: permite abrir una pregunta en grande y revelar su respuesta junto con la canción.
            </Typography>
          </Box>
          {values.karaoke ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Pausar en segundo"
                  value={values.karaoke_pause_seconds}
                  onChange={handleChange("karaoke_pause_seconds")}
                  type="number"
                  inputProps={{ inputMode: "numeric", min: 0, step: 1 }}
                  error={Boolean(errors.karaoke_pause_seconds)}
                  helperText={
                    errors.karaoke_pause_seconds ??
                    "Segundo exacto del video donde la pista debe detenerse."
                  }
                  fullWidth
                  disabled={loading}
                />
              </Stack>
              <TextField
                label="Letra del karaoke"
                value={values.karaoke_lyric}
                onChange={handleChange("karaoke_lyric")}
                error={Boolean(errors.karaoke_lyric)}
                helperText={
                  errors.karaoke_lyric ??
                  "Texto que aparecerá después de pausar para comprobar la continuación."
                }
                multiline
                minRows={3}
                fullWidth
                disabled={loading}
              />
            </Stack>
          ) : null}
          {values.trivia ? (
            <Stack spacing={2}>
              <TextField
                label="Pregunta trivia"
                value={values.trivia_question}
                onChange={handleChange("trivia_question")}
                error={Boolean(errors.trivia_question)}
                helperText={
                  errors.trivia_question ??
                  "Pregunta que se podrá abrir en un modal grande durante el juego."
                }
                multiline
                minRows={2}
                fullWidth
                disabled={loading}
              />
              <TextField
                label="Respuesta trivia"
                value={values.trivia_answer}
                onChange={handleChange("trivia_answer")}
                error={Boolean(errors.trivia_answer)}
                helperText={
                  errors.trivia_answer ??
                  "Respuesta que aparecerá al descubrir la canción."
                }
                multiline
                minRows={2}
                fullWidth
                disabled={loading}
              />
            </Stack>
          ) : null}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 600 }}
            >
              Etiquetas de la canción
            </Typography>
            <Typography
              variant="body2"
              sx={{ mb: 1.5, color: "text.secondary" }}
            >
              Puedes seleccionar una o más opciones.
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {availableSongTags.map((option) => {
                const selected = values.tags.includes(option.slug);
                return (
                  <Chip
                    key={option.slug}
                    label={getSongTagLabel(option.slug, availableSongTags)}
                    clickable
                    color={selected ? "primary" : "default"}
                    variant={selected ? "filled" : "outlined"}
                    onClick={() => handleToggleTag(option.slug)}
                    disabled={loading}
                  />
                );
              })}
            </Stack>
          </Box>
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
