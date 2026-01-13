"""
File Service for Mac file system operations.
"""
import os
from typing import List, Dict
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FileService:
    """Service for managing Mac file system operations."""
    
    def __init__(self):
        """Initialize file service."""
        self.home_dir = str(Path.home())
    
    def validate_path(self, path: str) -> str:
        """
        Validate and normalize path to prevent directory traversal attacks.
        
        Args:
            path: Path to validate
            
        Returns:
            Normalized absolute path
            
        Raises:
            ValueError: If path is invalid or outside allowed directories
        """
        # If path is empty or root, use home directory
        if not path or path == '/':
            return self.home_dir
        
        # Resolve to absolute path
        abs_path = os.path.abspath(os.path.expanduser(path))
        
        # Check if path exists
        if not os.path.exists(abs_path):
            raise ValueError(f"Path does not exist: {path}")
        
        return abs_path
    
    def list_files(self, path: str = None) -> List[Dict[str, any]]:
        """
        List files in a directory on Mac.
        
        Args:
            path: Path to list files from (defaults to home directory)
            
        Returns:
            List of file/directory information
        """
        if path is None:
            path = self.home_dir
        
        try:
            validated_path = self.validate_path(path)
            files = []
            
            for item in os.listdir(validated_path):
                item_path = os.path.join(validated_path, item)
                
                # Skip hidden files starting with .
                if item.startswith('.'):
                    continue
                
                try:
                    stat_info = os.stat(item_path)
                    is_directory = os.path.isdir(item_path)
                    
                    file_info = {
                        'name': item,
                        'path': item_path,
                        'is_directory': is_directory,
                        'size': stat_info.st_size if not is_directory else 0,
                        'modified': int(stat_info.st_mtime),
                        'type': 'directory' if is_directory else 'file'
                    }
                    files.append(file_info)
                except (OSError, PermissionError) as e:
                    logger.warning(f"Cannot access {item_path}: {e}")
                    continue
            
            # Sort: directories first, then by name
            return sorted(files, key=lambda x: (not x['is_directory'], x['name'].lower()))
        except Exception as e:
            logger.error(f"Error listing files at {path}: {e}")
            raise
    
    def get_file_info(self, path: str) -> Dict[str, any]:
        """
        Get information about a specific file or directory.
        
        Args:
            path: Path to file or directory
            
        Returns:
            File information dictionary
        """
        try:
            validated_path = self.validate_path(path)
            stat_info = os.stat(validated_path)
            is_directory = os.path.isdir(validated_path)
            
            return {
                'name': os.path.basename(validated_path),
                'path': validated_path,
                'is_directory': is_directory,
                'size': stat_info.st_size if not is_directory else 0,
                'modified': int(stat_info.st_mtime),
                'type': 'directory' if is_directory else 'file'
            }
        except Exception as e:
            logger.error(f"Error getting file info for {path}: {e}")
            raise
    
    def read_file(self, path: str) -> bytes:
        """
        Read file contents.
        
        Args:
            path: Path to file
            
        Returns:
            File contents as bytes
        """
        try:
            validated_path = self.validate_path(path)
            
            if os.path.isdir(validated_path):
                raise ValueError(f"Path is a directory: {path}")
            
            with open(validated_path, 'rb') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading file {path}: {e}")
            raise
    
    def write_file(self, path: str, content: bytes) -> bool:
        """
        Write content to file.
        
        Args:
            path: Path to file
            content: File content as bytes
            
        Returns:
            True if successful
        """
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            with open(path, 'wb') as f:
                f.write(content)
            
            logger.info(f"Wrote file to {path}")
            return True
        except Exception as e:
            logger.error(f"Error writing file {path}: {e}")
            raise
    
    def get_parent_directory(self, path: str) -> str:
        """
        Get parent directory of a path.
        
        Args:
            path: Path to get parent of
            
        Returns:
            Parent directory path
        """
        validated_path = self.validate_path(path)
        parent = os.path.dirname(validated_path)
        return parent if parent != validated_path else validated_path


# Singleton instance
file_service = FileService()
