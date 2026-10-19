import type { GameSessionCityCount } from "./types";

export type CountryCount = { countryCode: string; count: number };
export type MapLocation = { id: string; label: string; detail: string; count: number; latitude: number | null; longitude: number | null };

export const COUNTRY_COORDINATES: Record<string, [number, number]> = {
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


export function getCountryName(code: string) {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function cityLocationId(city: Pick<GameSessionCityCount, "countryCode" | "region" | "city">) {
  return JSON.stringify([city.countryCode, city.region, city.city]);
}

export function getMapLocations(countries: CountryCount[], cities: GameSessionCityCount[], view: "countries" | "cities"): MapLocation[] {
  return (view === "countries"
    ? countries.map(country => ({
        id: country.countryCode, label: getCountryName(country.countryCode),
        detail: "Ubicación representativa del país", count: country.count,
        latitude: COUNTRY_COORDINATES[country.countryCode]?.[1] ?? null,
        longitude: COUNTRY_COORDINATES[country.countryCode]?.[0] ?? null,
      }))
    : cities.map(city => ({
        id: cityLocationId(city), label: city.city,
        detail: [city.region, getCountryName(city.countryCode)].filter(Boolean).join(" · "),
        count: city.count, latitude: city.latitude, longitude: city.longitude,
      })))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}
