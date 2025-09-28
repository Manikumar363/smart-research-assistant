import pathway as pw
import requests
import json
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import os
from dotenv import load_dotenv
import asyncio
import aiohttp

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WeatherDataSource:
    """Pathway-based weather data source for real-time ingestion"""
    
    def __init__(self):
        self.api_key = os.getenv('WEATHER_API_KEY', 'demo')
        self.base_url = os.getenv('WEATHER_BASE_URL', 'https://api.openweathermap.org/data/2.5')
        self.node_backend_url = os.getenv('NODE_BACKEND_URL', 'http://localhost:5000')
        self.node_endpoint = os.getenv('NODE_BACKEND_ENDPOINT', '/api/pathway/ingest')
        self.ingestion_interval = int(os.getenv('INGESTION_INTERVAL', '300'))  # 5 minutes
        self.batch_size = int(os.getenv('BATCH_SIZE', '10'))
        self.max_retries = int(os.getenv('MAX_RETRIES', '3'))
        
        # Weather cities configuration
        self.cities = [
            {'name': 'New York', 'lat': 40.7128, 'lon': -74.0060, 'country': 'US'},
            {'name': 'London', 'lat': 51.5074, 'lon': -0.1278, 'country': 'UK'},
            {'name': 'Tokyo', 'lat': 35.6762, 'lon': 139.6503, 'country': 'JP'},
            {'name': 'Sydney', 'lat': -33.8688, 'lon': 151.2093, 'country': 'AU'},
            {'name': 'Paris', 'lat': 48.8566, 'lon': 2.3522, 'country': 'FR'},
            {'name': 'Berlin', 'lat': 52.5200, 'lon': 13.4050, 'country': 'DE'},
            {'name': 'Mumbai', 'lat': 19.0760, 'lon': 72.8777, 'country': 'IN'},
            {'name': 'São Paulo', 'lat': -23.5505, 'lon': -46.6333, 'country': 'BR'}
        ]
        
        logger.info(f"🌤️ WeatherDataSource initialized with {len(self.cities)} cities")
        logger.info(f"⏱️ Ingestion interval: {self.ingestion_interval} seconds")
        
    async def fetch_weather_data(self, session: aiohttp.ClientSession, city: Dict) -> Optional[Dict]:
        """Fetch weather data for a specific city"""
        try:
            if self.api_key == 'demo':
                return self.generate_mock_weather_data(city)
            
            url = f"{self.base_url}/weather"
            params = {
                'lat': city['lat'],
                'lon': city['lon'],
                'appid': self.api_key,
                'units': 'metric'
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    return self.format_weather_data(data, city)
                else:
                    logger.warning(f"⚠️ API request failed for {city['name']}: HTTP {response.status}")
                    return self.generate_mock_weather_data(city)
                    
        except Exception as e:
            logger.error(f"❌ Failed to fetch weather for {city['name']}: {str(e)}")
            return self.generate_mock_weather_data(city)
    
    def generate_mock_weather_data(self, city: Dict) -> Dict:
        """Generate realistic mock weather data"""
        import random
        
        conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Mist', 'Fog']
        descriptions = {
            'Clear': ['clear sky', 'sunny'],
            'Clouds': ['few clouds', 'scattered clouds', 'broken clouds', 'overcast clouds'],
            'Rain': ['light rain', 'moderate rain', 'heavy rain', 'shower rain'],
            'Snow': ['light snow', 'snow', 'heavy snow'],
            'Mist': ['mist'],
            'Fog': ['fog']
        }
        
        condition = random.choice(conditions)
        description = random.choice(descriptions[condition])
        temperature = round(random.uniform(-10, 35), 1)
        feels_like = round(temperature + random.uniform(-5, 5), 1)
        humidity = random.randint(30, 90)
        pressure = random.randint(990, 1030)
        wind_speed = round(random.uniform(0, 15), 1)
        wind_deg = random.randint(0, 360)
        
        return {
            'id': f"mock_{city['name'].lower().replace(' ', '_')}_{int(time.time())}",
            'city': city['name'],
            'country': city['country'],
            'coordinates': {'lat': city['lat'], 'lon': city['lon']},
            'weather': {
                'main': condition,
                'description': description,
                'icon': f"{random.randint(1, 4):02d}d"
            },
            'temperature': {
                'current': temperature,
                'feels_like': feels_like,
                'min': round(temperature - random.uniform(2, 8), 1),
                'max': round(temperature + random.uniform(2, 8), 1)
            },
            'pressure': pressure,
            'humidity': humidity,
            'visibility': random.randint(1000, 10000),
            'wind': {
                'speed': wind_speed,
                'deg': wind_deg
            },
            'timestamp': datetime.utcnow().isoformat(),
            'source': 'pathway_mock_weather'
        }
    
    def format_weather_data(self, api_data: Dict, city: Dict) -> Dict:
        """Format real API weather data"""
        return {
            'id': f"api_{city['name'].lower().replace(' ', '_')}_{int(time.time())}",
            'city': city['name'],
            'country': city['country'],
            'coordinates': {'lat': city['lat'], 'lon': city['lon']},
            'weather': {
                'main': api_data['weather'][0]['main'],
                'description': api_data['weather'][0]['description'],
                'icon': api_data['weather'][0]['icon']
            },
            'temperature': {
                'current': api_data['main']['temp'],
                'feels_like': api_data['main']['feels_like'],
                'min': api_data['main']['temp_min'],
                'max': api_data['main']['temp_max']
            },
            'pressure': api_data['main']['pressure'],
            'humidity': api_data['main']['humidity'],
            'visibility': api_data.get('visibility', 10000),
            'wind': {
                'speed': api_data.get('wind', {}).get('speed', 0),
                'deg': api_data.get('wind', {}).get('deg', 0)
            },
            'timestamp': datetime.utcnow().isoformat(),
            'source': 'pathway_openweather_api'
        }
    
    async def fetch_all_weather_data(self) -> List[Dict]:
        """Fetch weather data for all cities concurrently"""
        async with aiohttp.ClientSession() as session:
            tasks = [self.fetch_weather_data(session, city) for city in self.cities]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            weather_data = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"❌ Failed to fetch weather for {self.cities[i]['name']}: {str(result)}")
                elif result:
                    weather_data.append(result)
            
            logger.info(f"✅ Fetched weather data for {len(weather_data)} cities")
            return weather_data
    
    async def send_to_backend(self, weather_data: List[Dict]) -> bool:
        """Send processed weather data to Node.js backend"""
        try:
            payload = {
                'source_type': 'pathway_weather',
                'timestamp': datetime.utcnow().isoformat(),
                'data_count': len(weather_data),
                'weather_data': weather_data
            }
            
            url = f"{self.node_backend_url}{self.node_endpoint}"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url, 
                    json=payload,
                    headers={'Content-Type': 'application/json'},
                    timeout=30
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Successfully sent weather data to backend: {result.get('message', 'Success')}")
                        return True
                    else:
                        logger.error(f"❌ Backend rejected weather data: HTTP {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"❌ Failed to send weather data to backend: {str(e)}")
            return False

class PathwayWeatherService:
    """Main Pathway service for weather data ingestion"""
    
    def __init__(self):
        self.weather_source = WeatherDataSource()
        self.running = False
        logger.info("🚀 PathwayWeatherService initialized")
    
    async def start_ingestion_loop(self):
        """Start the continuous data ingestion loop"""
        self.running = True
        logger.info("🔄 Starting weather data ingestion loop...")
        
        while self.running:
            try:
                logger.info("📡 Fetching weather data...")
                
                # Fetch weather data
                weather_data = await self.weather_source.fetch_all_weather_data()
                
                if weather_data:
                    # Send to backend
                    success = await self.weather_source.send_to_backend(weather_data)
                    
                    if success:
                        logger.info(f"✅ Ingestion cycle completed: {len(weather_data)} weather records processed")
                    else:
                        logger.warning("⚠️ Ingestion cycle completed with backend errors")
                else:
                    logger.warning("⚠️ No weather data fetched in this cycle")
                
                # Wait for next cycle
                logger.info(f"⏱️ Waiting {self.weather_source.ingestion_interval} seconds for next cycle...")
                await asyncio.sleep(self.weather_source.ingestion_interval)
                
            except Exception as e:
                logger.error(f"❌ Error in ingestion loop: {str(e)}")
                logger.info("🔄 Retrying in 60 seconds...")
                await asyncio.sleep(60)
    
    def stop(self):
        """Stop the ingestion service"""
        self.running = False
        logger.info("⏹️ Weather ingestion service stopped")

async def main():
    """Main entry point for the Pathway weather service"""
    logger.info("🌤️ Starting Pathway Weather Data Ingestion Service...")
    
    service = PathwayWeatherService()
    
    try:
        await service.start_ingestion_loop()
    except KeyboardInterrupt:
        logger.info("🔌 Received interrupt signal")
        service.stop()
    except Exception as e:
        logger.error(f"❌ Fatal error: {str(e)}")
        service.stop()
    
    logger.info("👋 Pathway Weather Service shutting down...")

if __name__ == "__main__":
    asyncio.run(main())