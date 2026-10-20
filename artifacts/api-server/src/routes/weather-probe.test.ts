import assert from "node:assert/strict";
import { it } from "node:test";
import { loadTexasWeather } from "./weather-probe.ts";

it("requests Open-Meteo for the explicit Texas default and preserves observation units/time", async () => {
  const probe = await loadTexasWeather(async input => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.open-meteo.com");
    assert.equal(url.searchParams.get("latitude"), "30.2672");
    assert.equal(url.searchParams.get("longitude"), "-97.7431");
    assert.equal(url.searchParams.get("timezone"), "America/Chicago");
    return Response.json({ current: { time: "2026-10-20T12:00", temperature_2m: 25 }, current_units: { temperature_2m: "°C" } });
  });
  assert.match(probe.location, /no ubicación del usuario/);
  assert.equal(probe.current.temperature_2m, 25);
  assert.equal(probe.units?.temperature_2m, "°C");
});

it("does not invent weather when upstream fails or lacks observations", async () => {
  await assert.rejects(() => loadTexasWeather(async () => new Response("", { status: 503 })), /HTTP 503/);
  await assert.rejects(() => loadTexasWeather(async () => Response.json({})), /observación actual/);
});
