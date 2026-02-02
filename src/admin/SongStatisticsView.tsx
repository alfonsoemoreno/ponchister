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
import { BarChart, LineChart, PieChart } from "@mui/x-charts";
import { useMemo, useState, type ReactNode } from "react";

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
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 0,
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "none",
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
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

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 0,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {helper ? (
          <Typography variant="body2" color="text.secondary">
            {helper}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

function ChartCard({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 0,
        border: "1px solid",
        borderColor: "divider",
        minHeight: 320,
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {isEmpty ? (
          <Typography variant="body2" color="text.secondary">
            Sin datos para mostrar.
          </Typography>
        ) : (
          children
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

  const yearSeries = useMemo(
    () =>
      (selectedStats?.yearsMostCommon ?? []).slice(0, 6).map((item) => ({
        label: item.label,
        value: item.count,
      })),
    [selectedStats]
  );

  const decadeSeries = useMemo(
    () =>
      (selectedStats?.decadesLeastCommon ?? []).slice(0, 6).map((item) => ({
        label: item.label,
        value: item.count,
      })),
    [selectedStats]
  );

  const { languageSeries, languageTotal } = useMemo(() => {
    const total = stats?.overall.totalSongs ?? 0;
    const spanish = stats?.spanish.totalSongs ?? 0;
    const other = Math.max(total - spanish, 0);
    return {
      languageSeries: [
        {
          id: 0,
          label: "Español",
          value: spanish,
        },
        {
          id: 1,
          label: "Otros idiomas",
          value: other,
        },
      ],
      languageTotal: total,
    };
  }, [stats]);

  const formatLanguageValue = useMemo(() => {
    return (value: number | null) => {
      const safeValue = value ?? 0;
      const percent =
        languageTotal > 0 ? (safeValue / languageTotal) * 100 : 0;
      const percentLabel = Number.isFinite(percent)
        ? percent.toFixed(1).replace(/\.0$/, "")
        : "0";
      return `${safeValue} (${percentLabel}%)`;
    };
  }, [languageTotal]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 0 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 0 }}>
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
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
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
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 0,
          }}
        >
          <ToggleButton value="overall">Todas las canciones</ToggleButton>
          <ToggleButton value="spanish">Solo español</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(3, minmax(0, 1fr))",
          },
          alignItems: "start",
        }}
      >
        <MetricCard
          label="Total canciones"
          value={selectedStats?.totalSongs ?? 0}
          helper={
            scope === "overall"
              ? "Catalogo completo"
              : "Solo canciones en español"
          }
        />
        <MetricCard
          label="Sin año registrado"
          value={selectedStats?.missingYearCount ?? 0}
          helper="Registros incompletos"
        />
        <MetricCard
          label="Comparativo"
          value={`${stats.spanish.totalSongs}/${stats.overall.totalSongs}`}
          helper="Español vs total"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
          alignItems: "start",
        }}
      >
        <ChartCard title="Canciones por año" isEmpty={yearSeries.length === 0}>
          <BarChart
            height={240}
            series={[{ data: yearSeries.map((item) => item.value) }]}
            xAxis={[
              {
                data: yearSeries.map((item) => item.label),
                scaleType: "band",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 30 }}
          />
        </ChartCard>
        <ChartCard
          title="Distribución por idioma"
          isEmpty={languageSeries.every((item) => item.value === 0)}
        >
          <PieChart
            height={240}
            series={[
              {
                data: languageSeries,
                valueFormatter: formatLanguageValue,
                innerRadius: 50,
                outerRadius: 90,
                paddingAngle: 2,
              },
            ]}
            margin={{ left: 0, right: 0, top: 10, bottom: 10 }}
          />
        </ChartCard>
        <ChartCard
          title="Décadas con menos canciones"
          isEmpty={decadeSeries.length === 0}
        >
          <LineChart
            height={240}
            series={[{ data: decadeSeries.map((item) => item.value) }]}
            xAxis={[
              {
                data: decadeSeries.map((item) => item.label),
                scaleType: "point",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 30 }}
          />
        </ChartCard>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
          alignItems: "start",
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
