import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

import type { SongStatistics, SongStatisticsGroup, StatEntry } from "./types";

interface SongStatisticsViewProps {
  loading: boolean;
  error: string | null;
  stats: SongStatisticsGroup | null;
}

function StatisticsList({
  title,
  items,
  emptyMessage,
  highlight,
}: {
  title: string;
  items: StatEntry[];
  emptyMessage: string;
  highlight?: "top" | "bottom";
}) {
  const getChipColor = (index: number) => {
    if (highlight === "top" && index === 0) return "primary";
    if (highlight === "bottom" && index === 0) return "warning";
    return "default";
  };

  return (
    <Paper
      elevation={2}
      sx={{ p: 2.5, borderRadius: 3, height: "100%", background: "#fff" }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#1f3c7a" }}>
          {title}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          <List dense disablePadding>
            {items.map((item, index) => (
              <ListItem
                key={item.label}
                disableGutters
                sx={{ py: 0.5, gap: 1, alignItems: "flex-start" }}
              >
                <Chip
                  color={getChipColor(index)}
                  label={item.count}
                  size="small"
                  sx={{ minWidth: 48, fontWeight: 600 }}
                />
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: "body2",
                    sx: { fontWeight: index === 0 ? 600 : 500 },
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Stack>
    </Paper>
  );
}

export default function SongStatisticsView({
  loading,
  error,
  stats,
}: SongStatisticsViewProps) {
  const [scope, setScope] = useState<"overall" | "spanish">("overall");

  const selectedStats = useMemo<SongStatistics | null>(() => {
    if (!stats) return null;
    return scope === "overall" ? stats.overall : stats.spanish;
  }, [stats, scope]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
        <Typography variant="body1" color="text.secondary">
          No se encontraron datos para mostrar estadísticas.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#1f3c7a" }}>
          Vista de estadísticas
        </Typography>
        <ToggleButtonGroup
          value={scope}
          exclusive
          onChange={(_event, value) => value && setScope(value)}
          size="small"
          color="primary"
          sx={{
            alignSelf: { xs: "flex-start", sm: "center" },
            backgroundColor: "#fff",
            borderRadius: 999,
          }}
        >
          <ToggleButton value="overall">Todas las canciones</ToggleButton>
          <ToggleButton value="spanish">Solo español</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Paper
        elevation={2}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          background: "linear-gradient(135deg, #1f3c7a, #3680e1)",
          color: "#fff",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {scope === "overall"
            ? "Resumen general"
            : "Resumen canciones en español"}
        </Typography>
        <Typography variant="body1">
          Total de canciones: <strong>{selectedStats?.totalSongs ?? 0}</strong>
        </Typography>
        <Typography variant="body1">
          Canciones sin año registrado:{" "}
          <strong>{selectedStats?.missingYearCount ?? 0}</strong>
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
          <Chip
            label={`Todas: ${stats.overall.totalSongs}`}
            size="small"
            sx={{ backgroundColor: "rgba(255,255,255,0.16)", color: "#fff" }}
          />
          <Chip
            label={`Español: ${stats.spanish.totalSongs}`}
            size="small"
            sx={{ backgroundColor: "rgba(255,255,255,0.16)", color: "#fff" }}
          />
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
          },
        }}
      >
        <StatisticsList
          title="Años más frecuentes"
          items={selectedStats?.yearsMostCommon ?? []}
          emptyMessage="No hay años registrados."
          highlight="top"
        />
        <StatisticsList
          title="Años con menos canciones"
          items={selectedStats?.yearsLeastCommon ?? []}
          emptyMessage="No hay años suficientes para comparar."
          highlight="bottom"
        />
        <StatisticsList
          title="Décadas con menos canciones"
          items={selectedStats?.decadesLeastCommon ?? []}
          emptyMessage="No hay décadas registradas."
          highlight="bottom"
        />
        <Box sx={{ gridColumn: { xs: "auto", lg: "span 2" } }}>
          <StatisticsList
            title="Artistas con más canciones"
            items={selectedStats?.artistsMostCommon ?? []}
            emptyMessage="No hay artistas registrados."
            highlight="top"
          />
        </Box>
      </Box>
    </Stack>
  );
}
