"""Utilidades compartidas para serializar mensajes del Claude Agent SDK a una traza JSONL.

Usado tanto por run_bench.py (una traza por pregunta) como por app.py (una traza por sesión
de chat, con eventos que se van agregando turno a turno).
"""

import dataclasses
import json
import os


def classify_content_block(block):
    """Identifica el tipo de un content block ya serializado.

    Los dataclasses del SDK (ThinkingBlock, ToolUseBlock, ToolResultBlock, TextBlock) no
    incluyen un campo 'type' propio — dataclasses.asdict() lo pierde. Se infiere por las
    claves presentes para que la traza sea auditable sin adivinar.
    """
    if not isinstance(block, dict):
        return "raw"
    keys = set(block.keys())
    if {"thinking", "signature"} <= keys:
        return "thinking"
    if {"id", "name", "input"} <= keys:
        return "tool_use"
    if {"tool_use_id", "content"} <= keys:
        return "tool_result"
    if "text" in keys:
        return "text"
    return "unknown"


def serialize_sdk_message(message):
    """Convierte un SDKMessage (dataclass) en un dict JSON-serializable, con block types."""
    payload = {"_message_type": type(message).__name__}
    try:
        payload.update(dataclasses.asdict(message))
    except TypeError:
        payload["_raw_repr"] = repr(message)
        return payload

    content = payload.get("content")
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict):
                block["_block_type"] = classify_content_block(block)

    return payload


def write_events_file(path, events):
    """Escribe (reemplazando) una lista de eventos como JSONL — una traza nueva completa."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as output_file:
        for event in events:
            output_file.write(json.dumps(event, ensure_ascii=False, default=str) + "\n")


def append_events_file(path, events):
    """Agrega eventos al final de un JSONL existente (o lo crea) — para trazas de sesión larga."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as output_file:
        for event in events:
            output_file.write(json.dumps(event, ensure_ascii=False, default=str) + "\n")
