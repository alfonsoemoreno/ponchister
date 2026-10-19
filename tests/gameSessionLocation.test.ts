import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error Node 24 runs these TypeScript tests directly.
import { getGameSessionLocation, getMissingSessionColumn } from "../src/server/gameSessionLocation.ts";

test("decodes Vercel city metadata and rounds coordinates without retaining the IP", () => {
  assert.deepEqual(getGameSessionLocation({
    "x-vercel-ip-country": "br",
    "x-vercel-ip-city": "S%C3%A3o%20Paulo",
    "x-vercel-ip-country-region": "SP",
    "x-vercel-ip-latitude": "-23.55052",
    "x-vercel-ip-longitude": "-46.633308",
    "x-forwarded-for": "203.0.113.1",
  }), {
    countryCode: "BR", city: "São Paulo", region: "SP", latitude: -23.55, longitude: -46.63,
  });
});

test("keeps country-only sessions and handles localhost", () => {
  assert.deepEqual(getGameSessionLocation({ "x-vercel-ip-country": "CL" }), {
    countryCode: "CL", city: null, region: null, latitude: null, longitude: null,
  });
  assert.deepEqual(getGameSessionLocation({}), {
    countryCode: null, city: null, region: null, latitude: null, longitude: null,
  });
});

test("rejects malformed city values, invalid countries and incomplete coordinates", () => {
  for (const city of ["%broken", "a".repeat(121), "San%00tiago", " "]) {
    assert.equal(getGameSessionLocation({ "x-vercel-ip-country": "CL", "x-vercel-ip-city": city }).city, null);
  }
  for (const country of ["XX", "ZZ", "CHILE", "1A"]) {
    assert.equal(getGameSessionLocation({ "x-vercel-ip-country": country, "x-vercel-ip-city": "Santiago" }).city, null);
  }
  for (const [lat, lng] of [["91", "0"], ["-33", "181"], ["Infinity", "0"], ["-33", ""], ["NaN", "0"]]) {
    const location = getGameSessionLocation({
      "x-vercel-ip-country": "CL", "x-vercel-ip-city": "Santiago",
      "x-vercel-ip-latitude": lat, "x-vercel-ip-longitude": lng,
    });
    assert.equal(location.latitude, null);
    assert.equal(location.longitude, null);
  }
});

test("accepts zero coordinates and the first repeated header", () => {
  const location = getGameSessionLocation({
    "x-vercel-ip-country": ["GH", "CL"], "x-vercel-ip-city": "Accra",
    "x-vercel-ip-latitude": "0", "x-vercel-ip-longitude": "0",
  });
  assert.equal(location.countryCode, "GH");
  assert.equal(location.latitude, 0);
  assert.equal(location.longitude, 0);
});

test("identifies wrapped Postgres missing-column errors without masking other failures", () => {
  assert.equal(getMissingSessionColumn({ cause: { code: "42703", message: 'column "city" of relation "game_sessions" does not exist' } }), "city");
  assert.equal(getMissingSessionColumn({ code: "23505", message: 'column "city"' }), null);
  assert.equal(getMissingSessionColumn(new Error("Network unavailable")), null);
});
