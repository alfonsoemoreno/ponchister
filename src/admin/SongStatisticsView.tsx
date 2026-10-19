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
import { BarChart, PieChart } from "@mui/x-charts";
import { useMemo, useState, type ReactNode } from "react";
import { useTheme } from "@mui/material/styles";

import type { SongStatistics, SongStatisticsGroup, StatEntry } from "./types";
import type { SongTagDefinition } from "../lib/songTags";
import { getSongTagLabel } from "../lib/songTags";

interface SongStatisticsViewProps {
  loading: boolean;
  error: string | null;
  stats: SongStatisticsGroup | null;
  availableSongTags: SongTagDefinition[];
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
        borderRadius: 1,
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
  const formattedValue = typeof value === "number"
    ? new Intl.NumberFormat("es-CL").format(value)
    : value;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {formattedValue}
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
  description,
  isEmpty,
  children,
}: {
  title: string;
  description?: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        minHeight: 320,
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
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
  availableSongTags,
}: SongStatisticsViewProps) {
  const theme = useTheme();
  const [scope, setScope] = useState<"overall" | "spanish">("overall");

  const selectedStats = useMemo<SongStatistics | null>(() => {
    if (!stats) return null;
    return scope === "overall" ? stats.overall : stats.spanish;
  }, [stats, scope]);

  const decadeSeries = useMemo(
    () => {
      const decades = selectedStats?.songsByDecade ?? [];
      const pre1900 = decades
        .filter((item) => Number.parseInt(item.label, 10) < 1900)
        .reduce((total, item) => total + item.count, 0);
      const modernDecades = decades
        .filter((item) => Number.parseInt(item.label, 10) >= 1900)
        .sort((a, b) => Number.parseInt(a.label, 10) - Number.parseInt(b.label, 10))
        .map((item) => ({ label: item.label, value: item.count }));

      return pre1900 > 0
        ? [{ label: "Antes de 1900", value: pre1900 }, ...modernDecades]
        : modernDecades;
    },
    [selectedStats]
  );

  const tagSeries = useMemo(
    () =>
      (selectedStats?.tagsMostCommon ?? []).slice(0, 8).map((item) => ({
        label: getSongTagLabel(item.label, availableSongTags),
        value: item.count,
      })),
    [availableSongTags, selectedStats]
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
    if (!selectedStats) return [];
    const total = selectedStats.totalSongs;
    const percentOfCatalog = (count: number) =>
      total > 0 ? `${((count / total) * 100).toFixed(1).replace(/\.0$/, "")}% del catálogo` : "0% del catálogo";

    const cards: Array<{ label: string; value: number | string; helper?: string }> = [
      {
        label: "Total canciones",
        value: total,
        helper:
          scope === "overall"
            ? "Catálogo público"
            : "Solo canciones en español",
      },
      {
        label: "Con año registrado",
        value: total - selectedStats.missingYearCount,
        helper: percentOfCatalog(total - selectedStats.missingYearCount),
      },
      {
        label: "Con mímica",
        value: selectedStats.mimicaCount,
        helper: percentOfCatalog(selectedStats.mimicaCount),
      },
      {
        label: "Con tarareo",
        value: selectedStats.tararearCount,
        helper: percentOfCatalog(selectedStats.tararearCount),
      },
      {
        label: "Con karaoke",
        value: selectedStats.karaokeCount,
        helper: percentOfCatalog(selectedStats.karaokeCount),
      },
      {
        label: "Con trivia",
        value: selectedStats.triviaCount,
        helper: percentOfCatalog(selectedStats.triviaCount),
      }
    ];

    return cards;
  }, [scope, selectedStats]);

  const visibleCharts = useMemo(() => {
    const charts: Array<{
      key: string;
      title: string;
      description?: string;
      node: ReactNode;
    }> = [];

    if (scope === "overall" && languageSeries.some((item) => item.value > 0)) {
      charts.push({
        key: "language-distribution",
        title: "Distribución por idioma",
        node: (
          <PieChart
            height={260}
            colors={[theme.palette.primary.main, theme.palette.secondary.main]}
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

    if (decadeSeries.length > 0) {
      charts.push({
        key: "decade-series",
        title: "Canciones por década",
        description: decadeSeries.some((item) => item.label === "Antes de 1900")
          ? "Las canciones anteriores a 1900 se agrupan para facilitar la lectura."
          : undefined,
        node: (
          <BarChart
            height={260}
            series={[
              {
                data: decadeSeries.map((item) => item.value),
                color: theme.palette.primary.main,
              },
            ]}
            xAxis={[
              {
                data: decadeSeries.map((item) => item.label),
                scaleType: "band",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 32 }}
          />
        ),
      });
    }

    if (tagSeries.length > 0) {
      charts.push({
        key: "tag-series",
        title: "Etiquetas más usadas",
        node: (
          <BarChart
            height={260}
            series={[
              {
                data: tagSeries.map((item) => item.value),
                color: theme.palette.success.main,
              },
            ]}
            xAxis={[
              {
                data: tagSeries.map((item) => item.label),
                scaleType: "band",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 52 }}
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
    tagSeries,
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
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

    if (selectedStats.artistsMostCommon.length > 0) {
      blocks.push({
        key: "artists-most",
        title: "Artistas con más canciones",
        items: selectedStats.artistsMostCommon,
        highlight: "top",
        spanTwo: true,
      });
    }

    if (selectedStats.tagsMostCommon.length > 0) {
      blocks.push({
        key: "tags-most",
        title: "Etiquetas más frecuentes",
        items: selectedStats.tagsMostCommon.map((item) => ({
          ...item,
          label: getSongTagLabel(item.label, availableSongTags),
        })),
        highlight: "top",
      });
    }

    return blocks;
  }, [availableSongTags, selectedStats]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 1 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 1 }}>
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
        justifyContent="flex-end"
      >
        <ToggleButtonGroup
          value={scope}
          exclusive
          onChange={(_event, value) => value && setScope(value)}
          size="small"
          color="primary"
          sx={{
            alignSelf: { xs: "flex-start", sm: "center" },
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
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
            width: "100%",
            maxWidth: 1080,
            mx: "auto",
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
            width: "100%",
            maxWidth: 1600,
            mx: "auto",
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
            <ChartCard
              key={chart.key}
              title={chart.title}
              description={chart.description}
              isEmpty={false}
            >
              {chart.node}
            </ChartCard>
          ))}
        </Box>
      ) : null}

      {visibleLists.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            width: "100%",
            maxWidth: 1600,
            mx: "auto",
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
            borderRadius: 1,
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
