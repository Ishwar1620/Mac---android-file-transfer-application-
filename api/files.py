"""
API endpoints for file operations and transfers.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Dict, Optional
import os
import tempfile
from services.adb_service import adb_service
from services.file_service import file_service
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["files"])


class TransferRequest(BaseModel):
    """Request model for file transfers."""
    source_path: str
    destination_path: str
    device_serial: Optional[str] = None


@router.get("/mac/files")
async def list_mac_files(path: Optional[str] = Query(None)):
    """
    List files in a Mac directory.
    
    Args:
        path: Directory path (defaults to home directory)
        
    Returns:
        List of file/directory information
    """
    try:
        files = file_service.list_files(path)
        current_path = file_service.validate_path(path) if path else file_service.home_dir
        parent_path = file_service.get_parent_directory(current_path)
        
        return {
            'current_path': current_path,
            'parent_path': parent_path,
            'files': files
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing Mac files: {str(e)}")


@router.get("/android/files")
async def list_android_files(
    serial: str = Query(..., description="Device serial number"),
    path: str = Query("/sdcard", description="Directory path")
):
    """
    List files in an Android directory.
    
    Args:
        serial: Device serial number
        path: Directory path on Android device
        
    Returns:
        List of file/directory information
    """
    try:
        files = adb_service.list_files(serial, path)
        
        # Get parent path
        parent_path = os.path.dirname(path) if path != "/" else "/"
        
        return {
            'current_path': path,
            'parent_path': parent_path,
            'files': files
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing Android files: {str(e)}")


@router.post("/transfer/mac-to-android")
async def transfer_mac_to_android(request: TransferRequest):
    """
    Transfer file from Mac to Android device.
    
    Args:
        request: Transfer request with source, destination, and device serial
        
    Returns:
        Success message
    """
    try:
        if not request.device_serial:
            raise HTTPException(status_code=400, detail="Device serial is required")
        
        # Validate source file exists on Mac
        if not os.path.exists(request.source_path):
            raise HTTPException(status_code=404, detail=f"Source file not found: {request.source_path}")
        
        if os.path.isdir(request.source_path):
            raise HTTPException(status_code=400, detail="Directory transfer not supported yet")
        
        # Push file to Android
        adb_service.push_file(request.device_serial, request.source_path, request.destination_path)
        
        return {
            'success': True,
            'message': f'File transferred successfully to {request.destination_path}'
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transferring file: {str(e)}")


@router.post("/transfer/android-to-mac")
async def transfer_android_to_mac(request: TransferRequest):
    """
    Transfer file from Android device to Mac.
    
    Args:
        request: Transfer request with source, destination, and device serial
        
    Returns:
        Success message
    """
    try:
        if not request.device_serial:
            raise HTTPException(status_code=400, detail="Device serial is required")
        
        # Check if source file exists on Android
        if not adb_service.file_exists(request.device_serial, request.source_path):
            raise HTTPException(status_code=404, detail=f"Source file not found on device: {request.source_path}")
        
        # Pull file from Android
        adb_service.pull_file(request.device_serial, request.source_path, request.destination_path)
        
        return {
            'success': True,
            'message': f'File transferred successfully to {request.destination_path}'
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error transferring file: {str(e)}")


@router.get("/download/mac")
async def download_mac_file(path: str = Query(..., description="File path on Mac")):
    """
    Download a file from Mac.
    
    Args:
        path: File path on Mac
        
    Returns:
        File download response
    """
    try:
        validated_path = file_service.validate_path(path)
        
        if not os.path.isfile(validated_path):
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        filename = os.path.basename(validated_path)
        return FileResponse(
            path=validated_path,
            filename=filename,
            media_type='application/octet-stream'
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")


@router.get("/download/android")
async def download_android_file(
    serial: str = Query(..., description="Device serial number"),
    path: str = Query(..., description="File path on Android")
):
    """
    Download a file from Android device.
    
    Args:
        serial: Device serial number
        path: File path on Android device
        
    Returns:
        File download response
    """
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
            tmp_path = tmp_file.name
        
        # Pull file from Android to temp location
        adb_service.pull_file(serial, path, tmp_path)
        
        filename = os.path.basename(path)
        
        def cleanup():
            """Cleanup temporary file after sending."""
            try:
                os.unlink(tmp_path)
            except:
                pass
        
        return FileResponse(
            path=tmp_path,
            filename=filename,
            media_type='application/octet-stream',
            background=cleanup
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")


@router.post("/upload/mac")
async def upload_to_mac(
    file: UploadFile = File(...),
    destination_path: str = Query(..., description="Destination directory on Mac")
):
    """
    Upload a file to Mac.
    
    Args:
        file: File to upload
        destination_path: Destination directory path
        
    Returns:
        Success message with file path
    """
    try:
        # Validate destination directory
        validated_path = file_service.validate_path(destination_path)
        
        if not os.path.isdir(validated_path):
            raise HTTPException(status_code=400, detail="Destination must be a directory")
        
        # Create full file path
        file_path = os.path.join(validated_path, file.filename)
        
        # Write file
        content = await file.read()
        file_service.write_file(file_path, content)
        
        return {
            'success': True,
            'message': f'File uploaded successfully',
            'path': file_path
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
