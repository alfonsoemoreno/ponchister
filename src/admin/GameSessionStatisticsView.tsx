import { Box, Paper, Stack, Typography } from "@mui/material";
import { BarChart, LineChart } from "@mui/x-charts";
import { type ReactNode } from "react";
import { useTheme } from "@mui/material/styles";

import type { GameSessionStatistics } from "./types";
import GameSessionWorldMap from "./GameSessionWorldMap";

interface GameSessionStatisticsViewProps {
  stats: GameSessionStatistics | null;
}

function MetricCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: number;
  helper: string;
  accent: string;
}) {
  const theme = useTheme();
  const formattedValue = new Intl.NumberFormat("es-CL").format(value);
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        borderTop: `3px solid ${accent}`,
        background: `linear-gradient(135deg, ${accent}0c 0%, ${theme.palette.background.paper} 58%)`,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {formattedValue}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {helper}
        </Typography>
      </Stack>
    </Paper>
  );
}

function ChartCard({
  title,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  isEmpty: boolean;
  emptyMessage: string;
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
        {isEmpty ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          children
        )}
      </Stack>
    </Paper>
  );
}

export default function GameSessionStatisticsView({
  stats,
}: GameSessionStatisticsViewProps) {
  const theme = useTheme();
  const dailySeries = stats?.daily ?? [];
  const monthlySeries = stats?.monthly ?? [];

  const dailyLabels = dailySeries.map((item) => {
    const [, month, day] = item.label.split("-").map(Number);
    return Number.isFinite(month) && Number.isFinite(day)
      ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`
      : item.label;
  });
  const monthlyLabels = monthlySeries.map((item) => {
    const [year, month] = item.label.split("-").map(Number);
    if (!Number.isFinite(month) || !Number.isFinite(year)) return item.label;
    return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  });

  if (!stats) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 1 }}>
        <Typography variant="body1" color="text.secondary">
          No hay partidas registradas todavía.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Estadísticas de partidas
      </Typography>

      <Box
        sx={{
          display: "grid",
          width: "100%",
          maxWidth: 1080,
          mx: "auto",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Partidas hoy"
          value={stats.todayCount}
          helper="Desde las 00:00"
          accent={theme.palette.secondary.main}
        />
        <MetricCard
          label="Partidas este mes"
          value={stats.currentMonthCount}
          helper="Mes calendario actual"
          accent={theme.palette.primary.main}
        />
        <MetricCard
          label="Partidas este año"
          value={stats.currentYearCount}
          helper="Año calendario actual"
          accent={theme.palette.success.main}
        />
      </Box>

      <Box sx={{ width: "100%", maxWidth: 1480, mx: "auto" }}>
        <GameSessionWorldMap
          countries={stats.countries}
          periodMonths={stats.locationPeriodMonths}
          locationDetectionAvailable={stats.locationDetectionAvailable}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          width: "100%",
          maxWidth: 1480,
          mx: "auto",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "repeat(2, minmax(0, 1fr))",
          },
          alignItems: "start",
        }}
      >
        <ChartCard
          title="Evolución diaria (30 días)"
          isEmpty={dailySeries.length === 0}
          emptyMessage="Sin datos diarios para mostrar."
        >
          <LineChart
            height={240}
            series={[{ data: dailySeries.map((item) => item.count), color: theme.palette.secondary.main }]}
            xAxis={[
              {
                data: dailyLabels,
                scaleType: "point",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 30 }}
          />
        </ChartCard>

        <ChartCard
          title="Partidas por mes (12 meses)"
          isEmpty={monthlySeries.length === 0}
          emptyMessage="Sin datos mensuales para mostrar."
        >
          <BarChart
            height={240}
            series={[{ data: monthlySeries.map((item) => item.count), color: theme.palette.primary.main }]}
            xAxis={[
              {
                data: monthlyLabels,
                scaleType: "band",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 30 }}
          />
        </ChartCard>
      </Box>

    </Stack>
  );
}
