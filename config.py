"""Configuración central del agente analista de Quick Logística."""

import os

from dotenv import load_dotenv

load_dotenv()

# Sonnet 5 en vez de Opus 5: el hackaton evalúa precisión Y costo, y Sonnet 5 tiene
# precio de lanzamiento ($2/$10 por MTok) vigente hasta 2026-08-31.
MODEL_ID = os.environ.get("QUICK_ANALYST_MODEL", "claude-sonnet-5")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
TRACES_DIR = os.path.join(BASE_DIR, "traces")
