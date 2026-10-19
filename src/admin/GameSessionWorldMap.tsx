"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Button, ButtonBase, Chip, LinearProgress, Paper, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import { useTheme } from "@mui/material/styles";
import type { GameSessionCityCount } from "./types";
import type { MapFocusRequest } from "./GameSessionLeafletMap";
import { getMapLocations, type CountryCount } from "./gameLocationMap";

const InteractiveMap = dynamic(() => import("./GameSessionLeafletMap"), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" sx={{ height: { xs: 340, md: 440 } }} />,
});
const format = new Intl.NumberFormat("es-CL");

export default function GameSessionWorldMap({ countries, cities = [], periodMonths, locationDetectionAvailable }: {
  countries: CountryCount[];
  cities?: GameSessionCityCount[];
  periodMonths: number;
  locationDetectionAvailable: boolean;
}) {
  const theme = useTheme();
  const [view, setView] = useState<"countries" | "cities">("countries");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocusRequest | null>(null);
  const locations = useMemo(() => getMapLocations(countries, cities, view), [countries, cities, view]);
  const countryTotal = countries.reduce((sum, country) => sum + country.count, 0);
  const cityTotal = cities.reduce((sum, city) => sum + city.count, 0);
  const total = view === "cities" ? cityTotal : countryTotal;
  const withoutCity = Math.max(0, countryTotal - cityTotal);
  const missingCoordinates = locations.filter(location => location.latitude === null || location.longitude === null).reduce((sum, location) => sum + location.count, 0);
  const selected = locations.find(location => location.id === selectedId);

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={2.5}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 2, bgcolor: theme.palette.mode === "dark" ? "background.default" : "#fff2ec", color: "primary.main", flexShrink: 0 }}>
            <PublicOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 650 }}>Dónde se juega Ponchister</Typography>
            <Typography variant="body2" color="text.secondary">Ubicación aproximada · últimos {periodMonths} meses</Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{format.format(total)}</Typography>
            <Typography variant="caption" color="text.secondary">{view === "cities" ? "con ciudad" : "con país"}</Typography>
          </Box>
        </Stack>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
          <ToggleButtonGroup value={view} exclusive size="small" aria-label="Agrupar ubicaciones" onChange={(_, value: "countries" | "cities" | null) => {
            if (!value) return;
            setView(value); setSelectedId(null); setFocus(null);
          }}>
            <ToggleButton value="countries">Países</ToggleButton>
            <ToggleButton value="cities">Ciudades</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" startIcon={<PublicOutlinedIcon />} onClick={() => {
            setSelectedId(null);
            setFocus(previous => ({ id: null, sequence: (previous?.sequence ?? 0) + 1 }));
          }}>Vista mundial</Button>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.7fr) minmax(260px, 0.8fr)" }, gap: 2.5 }}>
          <Box sx={{ minWidth: 0, overflow: "hidden", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <InteractiveMap locations={locations} view={view} focus={focus} onSelect={setSelectedId} />
          </Box>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>{view === "cities" ? "Ciudades" : "Países"} con más partidas</Typography>
              <Chip size="small" label={locations.length} aria-label={`${locations.length} ${view === "cities" ? "ciudades" : "países"}`} />
            </Stack>
            {locations.length === 0 ? (
              <Box sx={{ flex: 1, display: "grid", alignContent: "center", minHeight: 140 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {view === "cities" ? "Aún no hay ciudades registradas" : locationDetectionAvailable ? "Aún no hay ubicaciones disponibles" : "Este entorno no recibe la ubicación de conexión"}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {view === "cities"
                    ? "Las nuevas partidas incluirán la ciudad cuando esté disponible. Las anteriores siguen en la vista de países."
                    : "La detección está disponible en Vercel; en localhost las partidas se registran sin ubicación."}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={0.5} sx={{ maxHeight: 310, overflowY: "auto", pr: 0.5 }}>
                {locations.map((location, index) => {
                  const canFocus = location.latitude !== null && location.longitude !== null;
                  return (
                    <ButtonBase key={location.id} disabled={!canFocus} aria-pressed={selectedId === location.id} onClick={() => {
                      setSelectedId(location.id);
                      setFocus(previous => ({ id: location.id, sequence: (previous?.sequence ?? 0) + 1 }));
                    }} sx={{ display: "block", textAlign: "left", p: 1, borderRadius: 1, bgcolor: selectedId === location.id ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover" }, "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" }, "&.Mui-disabled": { opacity: 0.7 } }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>{String(index + 1).padStart(2, "0")}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{location.label}</Typography>
                          {view === "cities" && <Typography variant="caption" color="text.secondary" noWrap component="div">{location.detail}</Typography>}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{format.format(location.count)}</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={total ? location.count / total * 100 : 0} sx={{ ml: 3.5, height: 4, borderRadius: 4, bgcolor: "action.hover", "& .MuiLinearProgress-bar": { borderRadius: 4 } }} />
                    </ButtonBase>
                  );
                })}
              </Stack>
            )}
            {selected && <Typography variant="caption" role="status" color="text.secondary">{selected.label} · {format.format(selected.count)} {selected.count === 1 ? "partida" : "partidas"}</Typography>}
            <Box sx={{ mt: "auto !important", pt: 1 }}>
              {view === "cities" && withoutCity > 0 && <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>{format.format(withoutCity)} {withoutCity === 1 ? "partida tiene" : "partidas tienen"} solo país y se {withoutCity === 1 ? "muestra" : "muestran"} en esa vista.</Typography>}
              {missingCoordinates > 0 && <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.75 }}>{format.format(missingCoordinates)} partidas sin coordenadas disponibles; incluidas en el ranking.</Typography>}
              <Typography variant="caption" color="text.secondary">Ubicación aproximada de la conexión; puede variar con redes móviles o VPN. No se almacena la dirección IP.</Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
