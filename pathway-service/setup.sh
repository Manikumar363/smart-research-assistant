#!/bin/bash

# Pathway Service Setup Script
echo "🚀 Setting up Pathway Live Data Ingestion Service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Create virtual environment
echo "📦 Creating virtual environment..."
cd pathway-service
python3 -m venv pathway-env

# Activate virtual environment
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    source pathway-env/Scripts/activate
else
    # Unix/Linux/macOS
    source pathway-env/bin/activate
fi

echo "📥 Installing dependencies..."

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from template. Please configure your API keys."
fi

echo "🎉 Pathway service setup complete!"
echo ""
echo "To start the service:"
echo "1. cd pathway-service"
echo "2. source pathway-env/bin/activate  (or pathway-env\\Scripts\\activate on Windows)"
echo "3. Configure .env file with your API keys"
echo "4. python pathway_weather_service.py"
echo ""
echo "📋 Next steps:"
echo "- Get OpenWeatherMap API key from https://openweathermap.org/api"
echo "- Add WEATHER_API_KEY to .env file"
echo "- Start the Node.js backend server"
echo "- Run the Pathway service"