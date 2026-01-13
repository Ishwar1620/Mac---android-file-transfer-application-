"""
API endpoints for Android device management.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict
from services.adb_service import adb_service

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.get("", response_model=List[Dict[str, str]])
async def list_devices():
    """
    Get list of all connected Android devices.
    
    Returns:
        List of device information dictionaries
    """
    try:
        devices = adb_service.get_devices()
        return devices
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing devices: {str(e)}")


@router.get("/{serial}/info")
async def get_device_info(serial: str):
    """
    Get detailed information about a specific device.
    
    Args:
        serial: Device serial number
        
    Returns:
        Device information dictionary
    """
    try:
        devices = adb_service.get_devices()
        device = next((d for d in devices if d['serial'] == serial), None)
        
        if not device:
            raise HTTPException(status_code=404, detail=f"Device {serial} not found")
        
        return device
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting device info: {str(e)}")
