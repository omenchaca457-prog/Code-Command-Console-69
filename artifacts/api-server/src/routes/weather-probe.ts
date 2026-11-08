export async function loadTexasWeather(fetcher: typeof fetch = fetch) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: "30.2672",
    longitude: "-97.7431",
    current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    timezone: "America/Chicago",
    forecast_days: "1",
  }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(6_000) });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  const data = await response.json() as {
    current?: Record<string, unknown>;
    current_units?: Record<string, string>;
  };
  if (!data.current?.time) throw new Error("Open-Meteo no devolvió una observación actual.");
  return {
    source: "Open-Meteo",
    location: "Austin, Texas (ubicación por defecto, no ubicación del usuario)",
    latitude: 30.2672,
    longitude: -97.7431,
    capturedAt: new Date().toISOString(),
    current: data.current,
    units: data.current_units,
  };
}
