import { Router } from 'express';
import { getEnv } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// In-memory cache — weather doesn't change every second
let weatherCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Get current weather
router.get('/current', async (req: AuthenticatedRequest, res) => {
  try {
    const env = getEnv();
    const apiKey = env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'Weather not configured — add OPENWEATHER_API_KEY to env' });
    }

    // Allow override via query param, fall back to env default
    const location = (req.query.location as string) || env.WEATHER_LOCATION;

    // Check cache
    if (weatherCache && Date.now() - weatherCache.timestamp < CACHE_TTL) {
      return res.json(weatherCache.data);
    }

    // Fetch from OpenWeatherMap
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: `Weather API error: ${err.message || response.statusText}`,
      });
    }

    const raw = await response.json();

    const weather = {
      location: raw.name,
      country: raw.sys?.country,
      temp: Math.round(raw.main?.temp),
      feels_like: Math.round(raw.main?.feels_like),
      temp_min: Math.round(raw.main?.temp_min),
      temp_max: Math.round(raw.main?.temp_max),
      humidity: raw.main?.humidity,
      description: raw.weather?.[0]?.description,
      icon: raw.weather?.[0]?.icon,
      icon_url: raw.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${raw.weather[0].icon}@2x.png` : null,
      wind_speed: raw.wind?.speed,
      wind_deg: raw.wind?.deg,
      clouds: raw.clouds?.all,
      visibility: raw.visibility,
      sunrise: raw.sys?.sunrise ? new Date(raw.sys.sunrise * 1000).toISOString() : null,
      sunset: raw.sys?.sunset ? new Date(raw.sys.sunset * 1000).toISOString() : null,
      fetched_at: new Date().toISOString(),
    };

    // Cache it
    weatherCache = { data: weather, timestamp: Date.now() };

    res.json(weather);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch weather' });
  }
});

// Get forecast (next 5 days, 3-hour intervals)
router.get('/forecast', async (req: AuthenticatedRequest, res) => {
  try {
    const env = getEnv();
    const apiKey = env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ error: 'Weather not configured' });
    }

    const location = (req.query.location as string) || env.WEATHER_LOCATION;

    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&cnt=16`;
    const response = await fetch(url);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: `Forecast API error: ${err.message || response.statusText}`,
      });
    }

    const raw = await response.json();

    const forecast = (raw.list || []).map((item: any) => ({
      dt: item.dt_txt,
      temp: Math.round(item.main?.temp),
      feels_like: Math.round(item.main?.feels_like),
      description: item.weather?.[0]?.description,
      icon: item.weather?.[0]?.icon,
      wind_speed: item.wind?.speed,
      humidity: item.main?.humidity,
      rain_3h: item.rain?.['3h'] || 0,
    }));

    res.json({
      location: raw.city?.name,
      country: raw.city?.country,
      forecast,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch forecast' });
  }
});

export default router;
