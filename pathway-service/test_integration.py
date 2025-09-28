import asyncio
import aiohttp
import json
from datetime import datetime

async def test_pathway_integration():
    """Test the Pathway integration with Node.js backend"""
    
    print("🧪 Testing Pathway Integration...")
    
    # Mock weather data similar to what Pathway would send
    test_weather_data = [
        {
            'id': f"test_{int(datetime.now().timestamp())}",
            'city': 'Test City',
            'country': 'TEST',
            'coordinates': {'lat': 40.7128, 'lon': -74.0060},
            'weather': {
                'main': 'Clear',
                'description': 'clear sky',
                'icon': '01d'
            },
            'temperature': {
                'current': 22.5,
                'feels_like': 24.0,
                'min': 18.0,
                'max': 26.0
            },
            'pressure': 1013,
            'humidity': 65,
            'visibility': 10000,
            'wind': {
                'speed': 3.5,
                'deg': 180
            },
            'timestamp': datetime.utcnow().isoformat(),
            'source': 'pathway_test'
        }
    ]
    
    # Test payload
    payload = {
        'source_type': 'pathway_weather',
        'timestamp': datetime.utcnow().isoformat(),
        'data_count': len(test_weather_data),
        'weather_data': test_weather_data,
        'user_id': 'test_user',
        'session_id': None
    }
    
    try:
        print("📡 Sending test data to Node.js backend...")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'http://localhost:5000/api/pathway/ingest',
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    print("✅ Test successful!")
                    print(f"📊 Result: {json.dumps(result, indent=2)}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Test failed: HTTP {response.status}")
                    print(f"Error: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        return False

async def test_pathway_status():
    """Test the Pathway status endpoint"""
    
    print("\n🔍 Testing Pathway status endpoint...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                'http://localhost:5000/api/pathway/status',
                timeout=10
            ) as response:
                
                if response.status == 200:
                    result = await response.json()
                    print("✅ Status endpoint working!")
                    print(f"📊 Status: {json.dumps(result, indent=2)}")
                    return True
                else:
                    print(f"❌ Status test failed: HTTP {response.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Status test failed: {str(e)}")
        return False

async def main():
    """Run all Pathway integration tests"""
    
    print("🚀 Pathway Integration Test Suite")
    print("=" * 50)
    
    # Test 1: Data ingestion
    success1 = await test_pathway_integration()
    
    # Test 2: Status endpoint
    success2 = await test_pathway_status()
    
    print("\n" + "=" * 50)
    if success1 and success2:
        print("✅ All tests passed! Pathway integration is working.")
    else:
        print("❌ Some tests failed. Check the backend server and try again.")
    
    print("\nMake sure the Node.js backend is running on port 5000 before running tests.")

if __name__ == "__main__":
    asyncio.run(main())