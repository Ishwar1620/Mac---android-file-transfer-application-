# Android File Transfer Application

A modern web-based application for transferring files between Mac and Android devices with a beautiful split-view interface.

## Features

- 🔄 **Bidirectional File Transfer**: Transfer files between Mac and Android seamlessly
- 📱 **Real-time Device Detection**: Automatically detects connected Android devices
- 🎨 **Modern UI**: Beautiful dark-themed split-view interface with smooth animations
- 🖱️ **Drag & Drop**: Intuitive drag-and-drop file transfer
- 🔌 **WebSocket Support**: Real-time device status updates
- 📂 **File Browser**: Navigate both Mac and Android file systems easily

## Prerequisites

1. **Python 3.8+** installed on your Mac
2. **ADB (Android Debug Bridge)** installed:
   ```bash
   brew install android-platform-tools
   ```
3. **Android Device** with USB debugging enabled:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times to enable Developer Options
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

## Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Connect your Android device via USB and accept the USB debugging authorization prompt

## Usage

1. Start the application:
   ```bash
   python main.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

3. Select your Android device from the dropdown menu

4. Browse files on both Mac (left panel) and Android (right panel)

5. Transfer files by:
   - **Drag & Drop**: Drag a file from one panel to the other
   - **Click**: Click a file to select it, then use transfer buttons

## Project Structure

```
file/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── api/
│   ├── devices.py         # Device management endpoints
│   └── files.py           # File operations endpoints
├── services/
│   ├── adb_service.py     # Android device communication
│   └── file_service.py    # Mac file system operations
└── static/
    ├── index.html         # Main HTML page
    ├── css/
    │   └── styles.css     # Application styles
    └── js/
        └── app.js         # Frontend JavaScript
```

## API Endpoints

### Devices
- `GET /api/devices` - List connected Android devices
- `GET /api/devices/{serial}/info` - Get device information

### Files
- `GET /api/mac/files?path={path}` - List Mac files
- `GET /api/android/files?serial={serial}&path={path}` - List Android files
- `POST /api/transfer/mac-to-android` - Transfer file from Mac to Android
- `POST /api/transfer/android-to-mac` - Transfer file from Android to Mac
- `GET /api/download/mac?path={path}` - Download Mac file
- `GET /api/download/android?serial={serial}&path={path}` - Download Android file

### WebSocket
- `WS /ws` - Real-time device status updates

## Troubleshooting

### No devices detected
- Ensure USB debugging is enabled on your Android device
- Check ADB connection: `adb devices`
- Try disconnecting and reconnecting your device
- Accept the USB debugging authorization prompt on your device

### Permission errors
- On Android, ensure the app has storage permissions
- On Mac, check that the application has file system access

### Connection issues
- Restart the application
- Check that port 8000 is not in use
- Ensure your firewall allows the connection

## Technology Stack

- **Backend**: FastAPI, Python 3.10+
- **Android Communication**: adbutils
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time Updates**: WebSockets
- **Styling**: Modern CSS with dark theme and animations


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
