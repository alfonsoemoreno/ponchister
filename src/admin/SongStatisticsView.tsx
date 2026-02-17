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
    return (item: { value: number | null }) => {
      const safeValue = item.value ?? 0;
      const percent =
        languageTotal > 0 ? (safeValue / languageTotal) * 100 : 0;
      const percentLabel = Number.isFinite(percent)
        ? percent.toFixed(1).replace(/\.0$/, "")
        : "0";
      return `${safeValue} (${percentLabel}%)`;
    };
  }, [languageTotal]);

  const metricCards = useMemo(() => {
    if (!selectedStats || !stats) return [];

    const cards: Array<{ label: string; value: number | string; helper?: string }> = [
      {
        label: "Total canciones",
        value: selectedStats.totalSongs,
        helper:
          scope === "overall"
            ? "Catalogo completo"
            : "Solo canciones en español",
      },
    ];

    if (selectedStats.missingYearCount > 0) {
      cards.push({
        label: "Sin año registrado",
        value: selectedStats.missingYearCount,
        helper: "Registros incompletos",
      });
    }

    if (scope === "overall" && stats.overall.totalSongs > 0) {
      cards.push({
        label: "Comparativo idioma",
        value: `${stats.spanish.totalSongs}/${stats.overall.totalSongs}`,
        helper: "Español vs total",
      });
    }

    return cards;
  }, [scope, selectedStats, stats]);

  const visibleCharts = useMemo(() => {
    const charts: Array<{ key: string; title: string; node: ReactNode }> = [];

    if (yearSeries.length > 0) {
      charts.push({
        key: "year-series",
        title: "Canciones por año",
        node: (
          <BarChart
            height={260}
            series={[
              {
                data: yearSeries.map((item) => item.value),
                color: "#2563eb",
              },
            ]}
            xAxis={[
              {
                data: yearSeries.map((item) => item.label),
                scaleType: "band",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 32 }}
          />
        ),
      });
    }

    if (scope === "overall" && languageSeries.some((item) => item.value > 0)) {
      charts.push({
        key: "language-distribution",
        title: "Distribución por idioma",
        node: (
          <PieChart
            height={260}
            colors={["#0ea5e9", "#94a3b8"]}
            series={[
              {
                data: languageSeries,
                valueFormatter: formatLanguageValue,
                innerRadius: 52,
                outerRadius: 96,
                paddingAngle: 2,
              },
            ]}
            margin={{ left: 0, right: 0, top: 10, bottom: 10 }}
          />
        ),
      });
    }

    if (decadeSeries.length > 1) {
      charts.push({
        key: "decade-series",
        title: "Décadas con menor presencia",
        node: (
          <LineChart
            height={260}
            series={[
              {
                data: decadeSeries.map((item) => item.value),
                color: "#f59e0b",
              },
            ]}
            xAxis={[
              {
                data: decadeSeries.map((item) => item.label),
                scaleType: "point",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 32 }}
          />
        ),
      });
    }

    return charts;
  }, [
    decadeSeries,
    formatLanguageValue,
    languageSeries,
    scope,
    yearSeries,
  ]);

  const visibleLists = useMemo(() => {
    if (!selectedStats) return [];

    const blocks: Array<{
      key: string;
      title: string;
      items: StatEntry[];
      highlight?: "top" | "bottom";
      spanTwo?: boolean;
    }> = [];

    if (selectedStats.yearsMostCommon.length > 0) {
      blocks.push({
        key: "years-most",
        title: "Años más frecuentes",
        items: selectedStats.yearsMostCommon,
        highlight: "top",
      });
    }

    if (selectedStats.yearsLeastCommon.length > 1) {
      blocks.push({
        key: "years-least",
        title: "Años con menor presencia",
        items: selectedStats.yearsLeastCommon,
        highlight: "bottom",
      });
    }

    if (selectedStats.decadesLeastCommon.length > 1) {
      blocks.push({
        key: "decades-least",
        title: "Décadas con menor presencia",
        items: selectedStats.decadesLeastCommon,
        highlight: "bottom",
      });
    }

    if (selectedStats.artistsMostCommon.length > 0) {
      blocks.push({
        key: "artists-most",
        title: "Artistas con más canciones",
        items: selectedStats.artistsMostCommon,
        highlight: "top",
        spanTwo: true,
      });
    }

    return blocks;
  }, [selectedStats]);

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

      {metricCards.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: `repeat(${Math.min(metricCards.length, 3)}, minmax(0, 1fr))`,
            },
            alignItems: "start",
          }}
        >
          {metricCards.map((card) => (
            <MetricCard
              key={card.label}
              label={card.label}
              value={card.value}
              helper={card.helper}
            />
          ))}
        </Box>
      ) : null}

      {visibleCharts.length > 0 ? (
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
          {visibleCharts.map((chart) => (
            <ChartCard key={chart.key} title={chart.title} isEmpty={false}>
              {chart.node}
            </ChartCard>
          ))}
        </Box>
      ) : null}

      {visibleLists.length > 0 ? (
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
          {visibleLists.map((block) => (
            <Box
              key={block.key}
              sx={{ gridColumn: block.spanTwo ? { xs: "auto", lg: "span 2" } : "auto" }}
            >
              <StatisticsList
                title={block.title}
                items={block.items}
                emptyMessage="Sin datos suficientes para mostrar."
                highlight={block.highlight}
              />
            </Box>
          ))}
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 0,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No hay suficiente información útil para mostrar más estadísticas.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
