# Pathway Live Data Ingestion Service

This service uses Pathway for real-time live data ingestion from various APIs, starting with weather data sources.

## Features

- **Real-time Data Streaming**: Continuous ingestion from live APIs
- **Weather API Integration**: OpenWeatherMap and other weather services
- **Data Processing**: Clean, transform, and format data for consumption
- **Node.js Integration**: Send processed data to Node.js backend
- **Configurable Sources**: Dynamic source configuration via API

## Requirements

```bash
pip install pathway-ai
pip install requests
pip install python-dotenv
```

## Environment Variables

```
WEATHER_API_KEY=your_openweather_api_key
NODE_BACKEND_URL=http://localhost:5000
PATHWAY_PORT=8000
```

## Usage

```bash
cd pathway-service
python pathway_weather_service.py
```

## Architecture

```
Live APIs → Pathway → Data Processing → Node.js Backend → Vector Database
```

The Pathway service acts as a real-time data pipeline that:
1. Fetches data from configured APIs (weather, news, etc.)
2. Processes and transforms the data
3. Streams processed data to the Node.js backend
4. Node.js backend handles vectorization and storage