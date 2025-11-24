import { WeatherData } from '../types';

const OPENWEATHER_API_KEY = "c741f55c4f611454adfd929f35805d56";

export const fetchWeather = async (city: string): Promise<WeatherData | { error: string }> => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.cod !== 200) {
            return { error: `Could not find weather data for ${city}.` };
        }

        return {
            city: data.name,
            country: data.sys.country,
            temperature: `${Math.round(data.main.temp)}°C`,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
        };
    } catch (e) {
        console.error("Weather fetch failed:", e);
        return { error: "Failed to connect to weather service." };
    }
};