import { Box, Paper, Stack, Typography } from "@mui/material";
import { BarChart, LineChart } from "@mui/x-charts";
import { type ReactNode } from "react";

import type { GameSessionStatistics } from "./types";

interface GameSessionStatisticsViewProps {
  stats: GameSessionStatistics | null;
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
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
  const dailySeries = stats?.daily ?? [];
  const monthlySeries = stats?.monthly ?? [];
  const yearlySeries = stats?.yearly ?? [];

  const dailyLabels = dailySeries.map((item) => item.label.slice(5));

  if (!stats) {
    return (
      <Paper elevation={0} sx={{ p: 4, textAlign: "center", borderRadius: 0 }}>
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
        />
        <MetricCard
          label="Partidas este mes"
          value={stats.currentMonthCount}
          helper="Mes calendario actual"
        />
        <MetricCard
          label="Partidas este año"
          value={stats.currentYearCount}
          helper="Año calendario actual"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
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
            series={[{ data: dailySeries.map((item) => item.count) }]}
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
            series={[{ data: monthlySeries.map((item) => item.count) }]}
            xAxis={[
              {
                data: monthlySeries.map((item) => item.label),
                scaleType: "band",
              },
            ]}
            margin={{ left: 48, right: 12, top: 10, bottom: 30 }}
          />
        </ChartCard>
      </Box>

      <ChartCard
        title="Partidas por año"
        isEmpty={yearlySeries.length === 0}
        emptyMessage="Sin datos anuales para mostrar."
      >
        <BarChart
          height={260}
          series={[{ data: yearlySeries.map((item) => item.count) }]}
          xAxis={[
            {
              data: yearlySeries.map((item) => item.label),
              scaleType: "band",
            },
          ]}
          margin={{ left: 48, right: 12, top: 10, bottom: 30 }}
        />
      </ChartCard>
    </Stack>
  );
}
