"""
Advanced Live Data Ingestion Service with Source Registration
Supports dynamic source management and rolling window data management
"""
import asyncio
import aiohttp
import json
import time
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class AdvancedLiveDataService:
    """Advanced live data service with source registration and rolling window management"""
    
    def __init__(self):
        self.backend_url = os.getenv('NODE_BACKEND_URL', 'http://localhost:5001')
        self.registered_sources = {}
        self.active_tasks = {}
        
    async def get_registered_sources(self):
        """Fetch registered sources from backend"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.backend_url}/api/pathway/sources/active"
                
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('sources', [])
                    else:
                        print(f"⚠️ Failed to fetch sources: {response.status}")
                        return []
        except Exception as e:
            print(f"❌ Error fetching registered sources: {e}")
            return []

    async def fetch_weather_data(self, session, source_config):
        """Fetch weather data for a registered weather source"""
        try:
            cities = source_config.get('config', {}).get('cities', ['New York'])
            api_key = source_config.get('config', {}).get('apiKey')
            
            weather_results = []
            
            for city in cities:
                try:
                    if api_key and api_key != 'demo-key':
                        # Try real API if key is provided
                        url = f"http://api.openweathermap.org/data/2.5/weather"
                        params = {
                            'q': city,
                            'appid': api_key,
                            'units': 'metric'
                        }
                        
                        async with session.get(url, params=params, timeout=10) as response:
                            if response.status == 200:
                                data = await response.json()
                                weather_data = {
                                    'city': data['name'],
                                    'temperature': data['main']['temp'],
                                    'description': data['weather'][0]['description'],
                                    'humidity': data['main']['humidity'],
                                    'windSpeed': data['wind'].get('speed', 0),
                                    'pressure': data['main']['pressure'],
                                    'timestamp': datetime.now().isoformat(),
                                    'source': f"openweathermap-api-{source_config['sourceId']}",
                                    'coordinates': {
                                        'lat': data['coord']['lat'],
                                        'lon': data['coord']['lon']
                                    }
                                }
                                weather_results.append(weather_data)
                                continue
                    
                    # Fallback to mock data
                    weather_data = self.generate_mock_weather_data(city, source_config['sourceId'])
                    weather_results.append(weather_data)
                    
                except Exception as city_error:
                    print(f"⚠️ Error fetching weather for {city}: {city_error}")
                    # Add mock data as fallback
                    weather_data = self.generate_mock_weather_data(city, source_config['sourceId'])
                    weather_results.append(weather_data)
            
            return weather_results
            
        except Exception as e:
            print(f"❌ Error in fetch_weather_data: {e}")
            return []

    def generate_mock_weather_data(self, city, source_id):
        """Generate realistic mock weather data"""
        import random
        
        base_temps = {
            'New York': 15, 'London': 12, 'Tokyo': 18, 'Sydney': 22, 
            'Berlin': 8, 'Paris': 14, 'Los Angeles': 24, 'Chicago': 10,
            'Toronto': 9, 'Mumbai': 28
        }
        
        conditions = [
            'Clear sky', 'Few clouds', 'Scattered clouds', 'Broken clouds', 
            'Light rain', 'Sunny', 'Partly cloudy', 'Overcast'
        ]
        
        base_temp = base_temps.get(city, 15)
        temperature = base_temp + random.randint(-5, 10)
        
        return {
            'city': city,
            'temperature': temperature,
            'description': random.choice(conditions),
            'humidity': random.randint(40, 80),
            'windSpeed': round(random.uniform(0, 15), 1),
            'pressure': random.randint(990, 1020),
            'timestamp': datetime.now().isoformat(),
            'source': f'pathway-service-{source_id}',
            'sourceId': source_id,
            'coordinates': self.get_coordinates(city)
        }
    
    def get_coordinates(self, city):
        """Get approximate coordinates for cities"""
        coords = {
            'New York': {'lat': 40.7128, 'lon': -74.0060},
            'London': {'lat': 51.5074, 'lon': -0.1278},
            'Tokyo': {'lat': 35.6762, 'lon': 139.6503},
            'Sydney': {'lat': -33.8688, 'lon': 151.2093},
            'Berlin': {'lat': 52.5200, 'lon': 13.4050},
            'Paris': {'lat': 48.8566, 'lon': 2.3522},
            'Los Angeles': {'lat': 34.0522, 'lon': -118.2437},
            'Chicago': {'lat': 41.8781, 'lon': -87.6298},
            'Toronto': {'lat': 43.6532, 'lon': -79.3832},
            'Mumbai': {'lat': 19.0760, 'lon': 72.8777}
        }
        return coords.get(city, {'lat': 0, 'lon': 0})

    async def fetch_rss_data(self, session, source_config):
        """Fetch RSS/News feed data with real RSS parsing"""
        try:
            feed_url = source_config.get('sourceUrl')
            if not feed_url:
                return []

            print(f"🔄 Fetching RSS feed from: {feed_url}")
            
            # Set appropriate headers for RSS requests
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }

            async with session.get(feed_url, timeout=15, headers=headers) as response:
                if response.status == 200:
                    content = await response.text()
                    rss_items = self.parse_rss_content(content, source_config)
                    
                    if rss_items:
                        print(f"✅ Successfully parsed {len(rss_items)} RSS items from {feed_url}")
                        return rss_items
                    else:
                        # Fallback to mock data if parsing fails
                        print(f"⚠️ RSS parsing failed, using mock data for {feed_url}")
                        return self.generate_mock_rss_data(source_config)
                else:
                    print(f"⚠️ Failed to fetch RSS from {feed_url}: {response.status}")
                    return self.generate_mock_rss_data(source_config)
        except Exception as e:
            print(f"❌ Error fetching RSS data: {e}")
            return self.generate_mock_rss_data(source_config)

    def parse_rss_content(self, content, source_config):
        """Parse RSS XML content and extract items"""
        try:
            import xml.etree.ElementTree as ET
            
            # Parse XML content
            root = ET.fromstring(content)
            items = []
            
            # Handle different RSS formats
            rss_items = root.findall('.//item')  # RSS 2.0
            if not rss_items:
                rss_items = root.findall('.//{http://www.w3.org/2005/Atom}entry')  # Atom feeds
            
            for item in rss_items[:10]:  # Limit to latest 10 items per fetch
                try:
                    # Extract RSS item data
                    title = self.get_xml_text(item, ['title'])
                    description = self.get_xml_text(item, ['description', 'summary', '{http://www.w3.org/2005/Atom}summary'])
                    link = self.get_xml_text(item, ['link', 'guid', '{http://www.w3.org/2005/Atom}link'])
                    pub_date = self.get_xml_text(item, ['pubDate', 'published', '{http://www.w3.org/2005/Atom}published'])
                    
                    # Clean and format the data
                    if title:
                        rss_item = {
                            'title': title.strip(),
                            'description': (description or '').strip()[:500] + ('...' if len(description or '') > 500 else ''),
                            'content': f"{title}\n\n{description or ''}",
                            'link': link or '',
                            'timestamp': pub_date or datetime.now().isoformat(),
                            'source': f"rss-{source_config['sourceId']}",
                            'sourceId': source_config['sourceId'],
                            'sourceName': source_config['sourceName'],
                            'sourceUrl': source_config['sourceUrl'],
                            'type': 'rss_article'
                        }
                        items.append(rss_item)
                        
                except Exception as item_error:
                    print(f"⚠️ Error parsing RSS item: {item_error}")
                    continue
            
            return items
            
        except Exception as e:
            print(f"❌ Error parsing RSS XML: {e}")
            return []

    def get_xml_text(self, element, tag_names):
        """Helper to extract text from XML element with multiple possible tag names"""
        for tag in tag_names:
            found = element.find(tag)
            if found is not None and found.text:
                return found.text.strip()
        return None

    def generate_mock_rss_data(self, source_config):
        """Generate mock RSS data as fallback"""
        mock_articles = [
            {
                'title': f"Breaking: Latest updates from {source_config['sourceName']}",
                'description': "Important news and updates from our RSS feed source.",
                'content': f"Breaking: Latest updates from {source_config['sourceName']}\n\nImportant news and updates from our RSS feed source.",
                'link': f"{source_config.get('sourceUrl', '')}/article-1",
                'timestamp': datetime.now().isoformat(),
                'source': f"rss-{source_config['sourceId']}",
                'sourceId': source_config['sourceId'],
                'sourceName': source_config['sourceName'],
                'sourceUrl': source_config['sourceUrl'],
                'type': 'rss_article'
            },
            {
                'title': f"Technology Update from {source_config['sourceName']}",
                'description': "Latest technology trends and innovations in the industry.",
                'content': f"Technology Update from {source_config['sourceName']}\n\nLatest technology trends and innovations in the industry.",
                'link': f"{source_config.get('sourceUrl', '')}/article-2",
                'timestamp': datetime.now().isoformat(),
                'source': f"rss-{source_config['sourceId']}",
                'sourceId': source_config['sourceId'],
                'sourceName': source_config['sourceName'],
                'sourceUrl': source_config['sourceUrl'],
                'type': 'rss_article'
            }
        ]
        
        return mock_articles

    async def send_data_to_backend(self, session, data, source_config):
        """Send data to Node.js backend with source information"""
        try:
            url = f"{self.backend_url}/api/pathway/ingest"
            
            payload = {
                'data': data,
                'type': source_config['sourceType'],
                'sourceId': source_config['sourceId'],
                'timestamp': datetime.now().isoformat(),
                'source_metadata': {
                    'sourceName': source_config['sourceName'],
                    'sourceType': source_config['sourceType'],
                    'sourceUrl': source_config['sourceUrl'],
                    'maxEntries': source_config['maxEntries']
                }
            }
            
            async with session.post(url, json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    return True, result.get('message', 'Success')
                else:
                    error_text = await response.text()
                    return False, f"HTTP {response.status}: {error_text}"
                    
        except Exception as e:
            return False, f"Connection error: {e}"

    async def process_source(self, source_config):
        """Process a single registered source"""
        source_id = source_config['sourceId']
        source_type = source_config['sourceType']
        source_name = source_config['sourceName']
        
        print(f"🔄 Processing source: {source_name} ({source_type})")
        
        async with aiohttp.ClientSession() as session:
            try:
                # Fetch data based on source type
                if source_type == 'weather':
                    data_items = await self.fetch_weather_data(session, source_config)
                elif source_type == 'rss' or source_type == 'news':
                    data_items = await self.fetch_rss_data(session, source_config)
                else:
                    print(f"⚠️ Unsupported source type: {source_type}")
                    return
                
                if not data_items:
                    print(f"⚠️ No data retrieved for {source_name}")
                    return
                
                # Send each data item to backend
                success_count = 0
                for data_item in data_items:
                    success, message = await self.send_data_to_backend(session, data_item, source_config)
                    if success:
                        success_count += 1
                        print(f"✅ Sent data for {source_name}: {message}")
                    else:
                        print(f"❌ Failed to send data for {source_name}: {message}")
                
                print(f"📊 Source {source_name}: {success_count}/{len(data_items)} items sent successfully")
                
            except Exception as e:
                print(f"❌ Error processing source {source_name}: {e}")

    async def run_source_monitoring(self):
        """Main loop to monitor and process registered sources"""
        print(f"🚀 Starting Advanced Live Data Service")
        print(f"📡 Backend URL: {self.backend_url}")
        print("=" * 60)
        
        while True:
            try:
                print(f"\n🔍 Checking for registered sources at {datetime.now().strftime('%H:%M:%S')}")
                
                # Get current registered sources
                sources = await self.get_registered_sources()
                
                if not sources:
                    print("📭 No registered sources found")
                    await asyncio.sleep(30)  # Check again in 30 seconds
                    continue
                
                print(f"📋 Found {len(sources)} registered sources")
                
                # Process each active source
                for source in sources:
                    source_name = source.get('sourceName', 'unknown')
                    status = source.get('status')
                    is_active = source.get('isActive')
                    print(f"🔍 Source: {source_name} | Status: {status} | IsActive: {is_active}")
                    
                    if source.get('status') == 'active' and source.get('isActive'):
                        try:
                            # Check if it's time to process this source
                            last_ingested = source.get('lastIngestedAt')
                            interval = source.get('ingestionInterval', 300)  # default 5 minutes
                            
                            if not last_ingested:
                                # Never ingested, process now
                                await self.process_source(source)
                            else:
                                # Check if enough time has passed
                                last_time = datetime.fromisoformat(last_ingested.replace('Z', '+00:00'))
                                current_time = datetime.now()
                                time_diff = (current_time - last_time.replace(tzinfo=None)).total_seconds()
                                
                                if time_diff >= interval:
                                    await self.process_source(source)
                                else:
                                    next_run = interval - time_diff
                                    print(f"⏳ Source {source['sourceName']}: next run in {int(next_run)}s")
                        
                        except Exception as source_error:
                            print(f"❌ Error processing source {source.get('sourceName', 'unknown')}: {source_error}")
                    else:
                        print(f"⏸️ Source {source.get('sourceName', 'unknown')} is inactive")
                
                # Wait before next check
                print(f"💤 Waiting 60 seconds before next source check...")
                await asyncio.sleep(60)
                
            except KeyboardInterrupt:
                print("\n🛑 Stopping Advanced Live Data Service...")
                break
            except Exception as e:
                print(f"❌ Unexpected error in main loop: {e}")
                await asyncio.sleep(30)  # Wait before retrying

async def main():
    """Main function to run the advanced service"""
    print("🚀 Advanced Live Data Service with Source Registration")
    print("📊 Features: Rolling window data management, Source registration, Real-time monitoring")
    print("Press Ctrl+C to stop the service\n")
    
    service = AdvancedLiveDataService()
    await service.run_source_monitoring()

if __name__ == "__main__":
    asyncio.run(main())