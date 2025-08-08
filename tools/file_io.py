"""
This module provides file I/O operations for The Ark.
"""
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def list_project_files() -> dict:
    """
    Lists all files in the project directory, ignoring common temporary files.

    Returns:
        A dictionary with status and a list of file paths.
    """
    logging.info("Listing all project files.")
    try:
        project_files = []
        ignored_dirs = {'__pycache__', '.git', '.idea'}
        for root, dirs, files in os.walk('.'):
            # Modify dirs in-place to prune traversal
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for name in files:
                project_files.append(os.path.join(root, name))
        return {"status": "success", "result": project_files}
    except Exception as e:
        logging.error(f"Failed to list project files: {e}")
        return {"status": "error", "result": str(e)}

def read_multiple_files(filepaths: list) -> dict:
    """
    Reads the content of multiple files.

    Args:
        filepaths: A list of paths to the files.

    Returns:
        A dictionary with status and a dictionary of file contents.
    """
    logging.info(f"Reading {len(filepaths)} files.")
    content_map = {}
    try:
        for filepath in filepaths:
            with open(filepath, 'r', encoding='utf-8') as f:
                content_map[filepath] = f.read()
        return {"status": "success", "result": content_map}
    except FileNotFoundError as e:
        logging.error(f"File not found during multi-read: {e.filename}")
        return {"status": "error", "result": f"File not found: {e.filename}"}
    except Exception as e:
        logging.error(f"An error occurred while reading files: {e}")
        return {"status": "error", "result": str(e)}
