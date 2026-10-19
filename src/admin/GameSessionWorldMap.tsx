import { useMemo } from "react";
import { Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import { useTheme } from "@mui/material/styles";

type CountryCount = { countryCode: string; count: number };

const COUNTRY_COORDINATES: Record<string, [number, number]> = {
  AE: [54, 24], AF: [67, 33], AL: [20, 41], AM: [45, 40], AR: [-64, -34], AT: [14, 47], AU: [134, -25],
  AZ: [47.5, 40.5], BA: [18, 44], BD: [90, 24], BE: [4.5, 50.5], BG: [25, 42.7], BO: [-64.7, -16.7],
  BR: [-51, -10], BY: [28, 53], CA: [-106, 57], CH: [8.2, 46.8], CL: [-71, -33], CN: [104, 35], CO: [-72, 4],
  CR: [-84, 10], CU: [-79.5, 21.5], CY: [33, 35], CZ: [15.5, 49.8], DE: [10.5, 51], DK: [9.5, 56],
  DO: [-70.2, 19], DZ: [2, 28], EC: [-78, -1.5], EG: [30, 27], ES: [-4, 40], ET: [40, 9], FI: [26, 64],
  FR: [2, 46], GB: [-2, 54], GE: [43, 42], GH: [-1, 8], GR: [22, 39], GT: [-90.5, 15.5], HK: [114, 22],
  HN: [-86.5, 15], HR: [16, 45], HU: [19, 47], ID: [118, -2], IE: [-8, 53], IL: [35, 31], IN: [79, 22],
  IR: [53, 32], IQ: [44, 33], IS: [-19, 65], IT: [12.5, 42.5], JP: [138, 37], JO: [36, 31], KE: [38, 0],
  KH: [105, 12.5], KR: [128, 36], KW: [47.5, 29.5], KZ: [68, 48], LB: [35.8, 33.8], LK: [80.7, 7.8], LT: [24, 56],
  LV: [24.5, 57], MA: [-7, 32], MD: [29, 47], MK: [21.7, 41.6], MM: [96, 21], MX: [-102, 23], MY: [102, 4],
  NG: [8, 9], NL: [5.5, 52], NO: [10, 62], NP: [84, 28], NZ: [172, -41], OM: [57, 21], PA: [-80, 9],
  PE: [-75, -9], PH: [122, 12], PK: [69, 30], PL: [19, 52], PT: [-8, 39.5], PY: [-58, -23], QA: [51, 25],
  RO: [25, 46], RS: [21, 44], RU: [90, 60], SA: [45, 24], SE: [16, 62], SG: [104, 1.3], SI: [14.8, 46],
  SK: [19.5, 48.7], SN: [-14.5, 14.5], TH: [101, 16], TN: [9, 34], TR: [35, 39], TW: [121, 24], TZ: [35, -6],
  UA: [32, 49], UG: [32, 1], US: [-98, 39], UY: [-56, -33], UZ: [64, 41], VE: [-66, 8], VN: [108, 16],
  ZA: [24, -29], ZW: [30, -19],
};

const LAND_MASSES = [
  // North America and Central America
  "M34 83 L51 61 76 55 93 39 119 33 143 40 165 37 186 45 207 43 224 55 246 55 265 68 280 68 297 83 317 88 337 101 350 114 343 127 327 130 317 144 299 149 289 166 275 169 274 185 292 198 303 216 291 226 280 219 270 203 260 190 245 187 232 175 216 173 202 163 187 163 180 149 166 142 158 126 143 121 135 106 119 100 109 86 90 88 77 78 59 83 47 96 Z",
  // South America
  "M285 211 L302 207 319 215 332 228 337 246 350 263 357 282 352 301 344 319 339 340 328 361 322 384 312 409 304 425 294 407 291 385 284 365 283 343 274 322 270 301 275 282 269 262 274 243 280 226 Z",
  // Europe and Asia
  "M470 119 L481 105 495 104 503 91 520 94 531 82 547 87 560 75 576 81 589 73 607 80 621 75 638 82 654 78 670 85 689 82 705 90 722 87 740 96 758 91 775 101 793 98 810 108 830 104 848 114 868 111 885 121 904 119 921 129 941 127 959 139 975 139 992 152 985 164 968 169 956 180 940 180 927 192 909 188 896 199 878 193 864 204 845 198 831 207 813 201 799 211 779 204 765 215 746 207 733 218 714 207 697 210 682 196 663 202 648 187 630 190 615 175 598 180 585 163 566 166 552 150 534 154 520 139 504 143 493 127 479 132 Z",
  // Africa
  "M448 163 L463 151 480 153 494 164 508 167 519 181 519 201 510 219 507 239 498 257 495 280 484 300 478 326 466 351 454 359 447 340 442 319 432 302 430 281 420 264 422 243 413 225 418 205 429 191 432 175 Z",
  // Arabian Peninsula and India
  "M533 198 L549 189 564 195 575 210 571 225 557 232 541 224 Z",
  "M602 188 L618 183 633 190 641 204 635 223 624 236 615 220 607 205 Z",
  // Australia
  "M807 288 L821 280 840 283 857 292 875 295 892 309 909 317 923 333 918 349 907 363 897 378 880 388 864 381 850 369 833 364 820 350 811 334 799 322 Z",
  // Greenland
  "M363 33 L378 23 394 31 401 49 394 68 389 88 377 105 365 93 359 74 354 55 Z",
  // Japan, Indonesia, Philippines, New Zealand, Madagascar, Caribbean islands
  "M887 151 L895 145 900 154 897 165 891 170 Z",
  "M772 244 L789 241 800 249 794 257 778 255 Z",
  "M829 234 L839 230 846 238 841 251 833 249 Z",
  "M925 402 L938 397 948 405 945 418 934 422 926 414 Z",
  "M504 311 L511 314 509 331 504 345 499 337 Z",
  "M76 201 L87 197 96 204 93 212 83 214 Z",
];

function project([longitude, latitude]: [number, number]) {
  return {
    x: ((longitude + 180) / 360) * 1000,
    y: ((82 - latitude) / 164) * 500,
  };
}

function getCountryName(code: string) {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function WorldMap({ countries }: { countries: CountryCount[] }) {
  const theme = useTheme();
  const mapColors = theme.palette.mode === "dark"
    ? { background: "#17242b", grid: "#253b43", land: "#203e43", coast: "#315a60" }
    : { background: "#f1fbfb", grid: "#d7eff0", land: "#dff3f2", coast: "#bce4e5" };
  const maxCount = countries[0]?.count ?? 0;
  const markedCountries = useMemo(
    () => countries.flatMap((country) => {
      const coordinates = COUNTRY_COORDINATES[country.countryCode];
      return coordinates ? [{ ...country, ...project(coordinates) }] : [];
    }),
    [countries]
  );

  return (
    <Box sx={{ width: "100%", overflow: "hidden", borderRadius: 2, bgcolor: mapColors.background }}>
      <svg viewBox="0 0 1000 500" role="img" aria-label="Mapa mundial de partidas por país" style={{ display: "block", width: "100%", height: "auto" }}>
        <title>Partidas registradas en los últimos 12 meses por país</title>
        <defs>
          <pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke={mapColors.grid} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1000" height="500" fill={mapColors.background} />
        <rect width="1000" height="500" fill="url(#map-grid)" />
        {[100, 200, 300, 400].map((y) => <path key={y} d={`M0 ${y} H1000`} stroke={mapColors.grid} strokeDasharray="3 7" />)}
        {LAND_MASSES.map((path, index) => <path key={index} d={path} fill={mapColors.land} stroke={mapColors.coast} strokeWidth="2" strokeLinejoin="round" />)}
        {markedCountries.map((country) => {
          const radius = 6 + (maxCount ? (Math.sqrt(country.count / maxCount) * 9) : 0);
          return (
            <g key={country.countryCode}>
              <title>{`${getCountryName(country.countryCode)}: ${new Intl.NumberFormat("es-CL").format(country.count)} partidas`}</title>
              <circle cx={country.x} cy={country.y} r={radius + 5} fill={theme.palette.primary.main} opacity="0.16" />
              <circle cx={country.x} cy={country.y} r={radius} fill={theme.palette.primary.main} fillOpacity="0.9" stroke={theme.palette.background.paper} strokeWidth="3" />
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

export default function GameSessionWorldMap({ countries, periodMonths, locationDetectionAvailable }: { countries: CountryCount[]; periodMonths: number; locationDetectionAvailable: boolean }) {
  const theme = useTheme();
  const sorted = useMemo(() => [...countries].sort((a, b) => b.count - a.count), [countries]);
  const total = sorted.reduce((sum, country) => sum + country.count, 0);
  const visible = sorted.slice(0, 8);

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Stack spacing={2.5}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 2, bgcolor: theme.palette.mode === "dark" ? "background.default" : "#fff2ec", color: "primary.main" }}>
            <PublicOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 650 }}>Dónde se juega Ponchister</Typography>
            <Typography variant="body2" color="text.secondary">Distribución aproximada por país · últimos {periodMonths} meses</Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{new Intl.NumberFormat("es-CL").format(total)}</Typography>
            <Typography variant="caption" color="text.secondary">partidas ubicadas</Typography>
          </Box>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.7fr) minmax(260px, 0.8fr)" }, gap: 2.5, alignItems: "stretch" }}>
          <WorldMap countries={sorted} />
          <Stack spacing={1.5} sx={{ minWidth: 0, py: { lg: 0.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>Países con más partidas</Typography>
              <Typography variant="caption" color="text.secondary">{sorted.length} {sorted.length === 1 ? "país" : "países"}</Typography>
            </Stack>
            {total === 0 ? (
              <Box sx={{ flex: 1, display: "grid", alignContent: "center", minHeight: 140 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {locationDetectionAvailable
                    ? "Aún no hay ubicaciones disponibles"
                    : "Este entorno no está recibiendo el país de conexión"}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {locationDetectionAvailable
                    ? "Las partidas anteriores a la activación de esta medición no incluyen ubicación. Las nuevas se agruparán por país."
                    : "La ubicación se obtiene del encabezado de país que proporciona Vercel. En localhost no está disponible; comprueba esta vista en el despliegue de Vercel para confirmar la detección."}
                </Typography>
              </Box>
            ) : visible.map((country, index) => {
              const share = total ? (country.count / total) * 100 : 0;
              return (
                <Box key={country.countryCode}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ width: 20, fontVariantNumeric: "tabular-nums" }}>{String(index + 1).padStart(2, "0")}</Typography>
                    <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 550 }}>{getCountryName(country.countryCode)}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{new Intl.NumberFormat("es-CL").format(country.count)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={share} sx={{ ml: 3.5, height: 4, borderRadius: 4, bgcolor: theme.palette.mode === "dark" ? "divider" : "#f5efeb", "& .MuiLinearProgress-bar": { borderRadius: 4, bgcolor: "primary.main" } }} />
                </Box>
              );
            })}
            {total > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: "auto !important", pt: 1 }}>
                Ubicación aproximada derivada del país de conexión. No se almacena la dirección IP.
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
