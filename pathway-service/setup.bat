@echo off
echo 🚀 Setting up Pathway Live Data Ingestion Service...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8+ first.
    pause
    exit /b 1
)

echo ✅ Python found
python --version

REM Navigate to pathway service directory
cd pathway-service

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv pathway-env

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call pathway-env\Scripts\activate.bat

echo 📥 Installing dependencies...

REM Upgrade pip
python -m pip install --upgrade pip

REM Install requirements
pip install -r requirements.txt

REM Copy environment file if it doesn't exist
if not exist .env (
    copy .env.example .env
    echo 📝 Created .env file from template. Please configure your API keys.
)

echo 🎉 Pathway service setup complete!
echo.
echo To start the service:
echo 1. cd pathway-service
echo 2. pathway-env\Scripts\activate.bat
echo 3. Configure .env file with your API keys
echo 4. python pathway_weather_service.py
echo.
echo 📋 Next steps:
echo - Get OpenWeatherMap API key from https://openweathermap.org/api
echo - Add WEATHER_API_KEY to .env file
echo - Start the Node.js backend server
echo - Run the Pathway service

pause