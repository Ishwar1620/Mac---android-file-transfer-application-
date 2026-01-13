"""
ADB Service for Android device management and file operations.
"""
import os
from typing import List, Dict, Optional
from adbutils import adb, AdbDevice, AdbError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ADBService:
    """Service for managing Android devices via ADB."""
    
    def __init__(self):
        """Initialize ADB service."""
        self.adb = adb
    
    def get_devices(self) -> List[Dict[str, str]]:
        """
        Get list of connected Android devices.
        
        Returns:
            List of device dictionaries with serial and model info
        """
        try:
            devices = []
            for device in self.adb.device_list():
                try:
                    device_info = {
                        'serial': device.serial,
                        'model': device.prop.model or 'Unknown',
                        'manufacturer': device.prop.get('ro.product.manufacturer', 'Unknown'),
                        'android_version': device.prop.get('ro.build.version.release', 'Unknown'),
                        'state': 'device'
                    }
                    devices.append(device_info)
                except Exception as e:
                    logger.error(f"Error getting device info for {device.serial}: {e}")
                    devices.append({
                        'serial': device.serial,
                        'model': 'Unknown',
                        'manufacturer': 'Unknown',
                        'android_version': 'Unknown',
                        'state': 'device'
                    })
            return devices
        except Exception as e:
            logger.error(f"Error listing devices: {e}")
            return []
    
    def get_device(self, serial: str) -> Optional[AdbDevice]:
        """
        Get ADB device by serial number.
        
        Args:
            serial: Device serial number
            
        Returns:
            AdbDevice instance or None if not found
        """
        try:
            return self.adb.device(serial=serial)
        except Exception as e:
            logger.error(f"Error getting device {serial}: {e}")
            return None
    
    def list_files(self, serial: str, path: str = "/sdcard") -> List[Dict[str, any]]:
        """
        List files in a directory on Android device.
        
        Args:
            serial: Device serial number
            path: Path to list files from
            
        Returns:
            List of file/directory information
        """
        device = self.get_device(serial)
        if not device:
            raise ValueError(f"Device {serial} not found")
        
        try:
            # Use shell command to list files with details
            output = device.shell(f"ls -la '{path}'")
            files = []
            
            for line in output.strip().split('\n'):
                if not line or line.startswith('total'):
                    continue
                
                parts = line.split()
                if len(parts) < 8:
                    continue
                
                permissions = parts[0]
                size = parts[4] if parts[4].isdigit() else '0'
                name = ' '.join(parts[7:])
                
                # Skip . and ..
                if name in ['.', '..']:
                    continue
                
                is_directory = permissions.startswith('d')
                
                file_info = {
                    'name': name,
                    'path': os.path.join(path, name),
                    'is_directory': is_directory,
                    'size': int(size) if not is_directory else 0,
                    'permissions': permissions,
                    'type': 'directory' if is_directory else 'file'
                }
                files.append(file_info)
            
            return sorted(files, key=lambda x: (not x['is_directory'], x['name'].lower()))
        except Exception as e:
            logger.error(f"Error listing files on {serial} at {path}: {e}")
            raise
    
    def pull_file(self, serial: str, remote_path: str, local_path: str) -> bool:
        """
        Pull file from Android device to Mac.
        
        Args:
            serial: Device serial number
            remote_path: Path on Android device
            local_path: Path on Mac
            
        Returns:
            True if successful, False otherwise
        """
        device = self.get_device(serial)
        if not device:
            raise ValueError(f"Device {serial} not found")
        
        try:
            # Ensure local directory exists
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            
            # Pull file
            device.sync.pull(remote_path, local_path)
            logger.info(f"Pulled {remote_path} to {local_path}")
            return True
        except Exception as e:
            logger.error(f"Error pulling file from {serial}: {e}")
            raise
    
    def push_file(self, serial: str, local_path: str, remote_path: str) -> bool:
        """
        Push file from Mac to Android device.
        
        Args:
            serial: Device serial number
            local_path: Path on Mac
            remote_path: Path on Android device
            
        Returns:
            True if successful, False otherwise
        """
        device = self.get_device(serial)
        if not device:
            raise ValueError(f"Device {serial} not found")
        
        try:
            # Push file
            device.sync.push(local_path, remote_path)
            logger.info(f"Pushed {local_path} to {remote_path}")
            return True
        except Exception as e:
            logger.error(f"Error pushing file to {serial}: {e}")
            raise
    
    def file_exists(self, serial: str, path: str) -> bool:
        """
        Check if file exists on Android device.
        
        Args:
            serial: Device serial number
            path: Path to check
            
        Returns:
            True if file exists, False otherwise
        """
        device = self.get_device(serial)
        if not device:
            return False
        
        try:
            result = device.shell(f"test -e '{path}' && echo 'exists' || echo 'not_exists'")
            return 'exists' in result.strip()
        except Exception as e:
            logger.error(f"Error checking file existence on {serial}: {e}")
            return False


# Singleton instance
adb_service = ADBService()
