"""Lista los archivos de datos disponibles en data/ (recursivo), sin subir nada a ningún lado.

El agente ahora corre localmente (Claude Agent SDK) y accede a los datos a través de las
herramientas de agent/sdk_tools.py — esta lista solo se usa para armar la nota informativa del
system prompt (agent/prompts.py).
"""

import os

from config import DATA_DIR

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json", ".txt"}


def list_dataset_relative_paths():
    """Recorre DATA_DIR recursivamente y devuelve las rutas relativas de los archivos de datos."""
    if not os.path.isdir(DATA_DIR):
        return []

    relative_paths = []
    for root, dirs, filenames in os.walk(DATA_DIR):
        dirs.sort()
        dirs[:] = [name for name in dirs if not name.startswith(".")]
        for filename in sorted(filenames):
            if filename.startswith("."):
                continue
            extension = os.path.splitext(filename)[1].lower()
            if extension not in SUPPORTED_EXTENSIONS:
                continue
            absolute_path = os.path.join(root, filename)
            relative_path = os.path.relpath(absolute_path, DATA_DIR).replace(os.sep, "/")
            relative_paths.append(relative_path)

    relative_paths.sort()
    return relative_paths
