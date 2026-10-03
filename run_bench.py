"""Corre las 7 preguntas del Quick Golden Bench con el Claude Agent SDK (ejecución local).

El agente NO escribe ni ejecuta código: las 6 herramientas de `agent/sdk_tools.py` (MCP
in-process) envuelven `data/quick_bench_toolkit.py` y corren directo en este mismo proceso sobre
el ledger y la nómina/ausencias ya cargados en memoria una sola vez — el agente solo elige qué
herramienta llamar y con qué argumentos. `max_turns` y `max_budget_usd` ponen un techo duro por
las dudas. Las preguntas son independientes entre sí, así que corren en paralelo.
"""

import asyncio
import json
import os
import re
import sys

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, query

from agent.data_loader import list_dataset_relative_paths
from agent.prompts import build_question_message, build_system_prompt
from agent.sdk_tools import build_bench_tools, load_bench_context
from agent.sdk_trace import serialize_sdk_message, write_events_file
from config import DATA_DIR, MODEL_ID

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_DIR = os.path.join(BASE_DIR, "charlas", "2026-agents-bogota", "hackathon", "preguntas")
ANSWERS_DIR = os.path.join(BASE_DIR, "answers")
BENCH_TRACES_DIR = os.path.join(BASE_DIR, "traces")
ALL_QUESTION_IDS = [f"q0{n}" for n in range(1, 8)]

MAX_TURNS = 12
MAX_BUDGET_USD = 0.60
EFFORT = "low"

QUESTION_HEADING_PATTERN = re.compile(r"^#\s*(q\d+)\s*[—-]\s*(.+?)\s*$", re.MULTILINE)
ANSWER_HINT_PATTERN = re.compile(r'"answer":\s*/\*\s*(.+?)\s*\*/', re.DOTALL)
JSON_FENCE_PATTERN = re.compile(r"```json\s*(.*?)```", re.DOTALL)


def load_question(question_id):
    """Lee preguntas/qNN.md y extrae el texto de la pregunta y el hint de forma de `answer`."""
    question_path = os.path.join(QUESTIONS_DIR, f"{question_id}.md")
    with open(question_path, "r", encoding="utf-8") as question_file:
        content = question_file.read()

    heading_match = QUESTION_HEADING_PATTERN.search(content)
    if not heading_match:
        raise ValueError(f"No encontré el encabezado de la pregunta en {question_path}")
    question_text = heading_match.group(2)

    hint_match = ANSWER_HINT_PATTERN.search(content)
    answer_shape_hint = (
        hint_match.group(1) if hint_match else "la respuesta, en el formato que tenga más sentido"
    )

    return question_text, answer_shape_hint


def collect_final_text(assistant_messages):
    """Concatena los bloques de texto de todos los AssistantMessage de la sesión."""
    text_parts = []
    for message in assistant_messages:
        for block in message.content:
            if isinstance(block, TextBlock):
                text_parts.append(block.text)
    return "\n\n".join(text_parts)


def extract_json_envelope(final_text, question_id):
    """Extrae y parsea el último bloque ```json ... ``` del texto final."""
    fenced_blocks = JSON_FENCE_PATTERN.findall(final_text)
    if not fenced_blocks:
        return None
    try:
        envelope = json.loads(fenced_blocks[-1])
    except json.JSONDecodeError:
        return None
    envelope.setdefault("question_id", question_id)
    return envelope


def build_fallback_envelope(question_id, final_text):
    """Envelope de respaldo cuando el modelo no devolvió un bloque JSON parseable."""
    return {
        "question_id": question_id,
        "answer": None,
        "summary": final_text[:2000],
        "method": "No se pudo extraer un bloque ```json parseable de la respuesta del modelo.",
        "code": "",
        "caveats": ["El modelo no devolvió el envelope JSON esperado; ver 'summary' para el texto crudo."],
        "conventions": [],
    }


def write_json_file(path, payload):
    """Escribe un dict como JSON indentado, creando el directorio si hace falta."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as output_file:
        json.dump(payload, output_file, ensure_ascii=False, indent=2, default=str)


def build_options(system_prompt, mcp_server, tool_names):
    """ClaudeAgentOptions: sin Bash/Write/Edit, solo las herramientas del bench (MCP in-process)."""
    return ClaudeAgentOptions(
        system_prompt=system_prompt,
        model=MODEL_ID,
        cwd=DATA_DIR,
        mcp_servers={"quick_bench": mcp_server},
        strict_mcp_config=True,
        tools=list(tool_names),
        allowed_tools=list(tool_names),
        permission_mode="bypassPermissions",
        max_turns=MAX_TURNS,
        max_budget_usd=MAX_BUDGET_USD,
        effort=EFFORT,
        thinking={"type": "adaptive", "display": "summarized"},
    )


async def run_question(question_text_with_contract, options):
    """Corre una pregunta contra el SDK y devuelve (todos_los_mensajes, result_message)."""
    all_messages = []
    result_message = None

    async for message in query(prompt=question_text_with_contract, options=options):
        all_messages.append(message)
        if isinstance(message, ResultMessage):
            result_message = message

    return all_messages, result_message


async def process_question(question_id, options):
    """Corre una pregunta completa y escribe su answers/qNN.json + traces/qNN.events.jsonl."""
    question_text, answer_shape_hint = load_question(question_id)
    user_text = build_question_message(question_id, question_text, answer_shape_hint)

    print(f"--- arranca {question_id}: {question_text}")
    all_messages, result_message = await run_question(user_text, options)

    assistant_messages = [m for m in all_messages if isinstance(m, AssistantMessage)]
    final_text = collect_final_text(assistant_messages)
    envelope = extract_json_envelope(final_text, question_id)

    if envelope is None:
        print(f"    AVISO {question_id}: sin bloque ```json parseable, uso fallback.")
        envelope = build_fallback_envelope(question_id, final_text)

    write_json_file(os.path.join(ANSWERS_DIR, f"{question_id}.json"), envelope)

    events = [serialize_sdk_message(message) for message in all_messages]
    write_events_file(os.path.join(BENCH_TRACES_DIR, f"{question_id}.events.jsonl"), events)

    if result_message is None:
        print(f"    AVISO {question_id}: no llegó ResultMessage (revisar errores/timeouts).")
        return {"question_id": question_id, "cost_usd": 0.0, "num_turns": None}

    cost = result_message.total_cost_usd or 0.0
    print(f"--- termina {question_id}: {result_message.num_turns} turnos · ${cost:.4f}")
    return {"question_id": question_id, "cost_usd": cost, "num_turns": result_message.num_turns}


async def run_bench(question_ids):
    """Corre todas las preguntas del bench en paralelo (son independientes entre sí)."""
    dataset_filenames = list_dataset_relative_paths()
    if not dataset_filenames:
        print("ADVERTENCIA: no hay archivos en data/ — las respuestas no tendrán datos reales.")

    print("Cargando ledger + nómina + ausencias en memoria (una sola vez)...")
    ledger, nomina_by_period, ausencias_by_period = load_bench_context()
    print(f"  listo: {len(ledger)} filas de ledger, nómina de {len(nomina_by_period)} meses, "
          f"ausencias de {len(ausencias_by_period)} meses")

    mcp_server, tool_names = build_bench_tools(ledger, nomina_by_period, ausencias_by_period)
    print(f"  herramientas disponibles: {tool_names}")

    system_prompt = build_system_prompt(dataset_filenames)
    options = build_options(system_prompt, mcp_server, tool_names)

    # Las 7 preguntas comparten el mismo system_prompt + herramientas (prefijo cacheable).
    # Si las lanzamos todas a la vez, cada una paga su propia escritura de cache (cache_creation,
    # ~1.25x el precio de input) en vez de reusar la de las demás. Corriendo la primera sola
    # primero, esa escritura ya está lista cuando arrancan las otras 6 en paralelo, que entonces
    # pagan cache_read (~0.1x) por ese mismo prefijo.
    warmup_id, remaining_ids = question_ids[0], question_ids[1:]
    warmup_result = await process_question(warmup_id, options)
    remaining_results = await asyncio.gather(
        *(process_question(question_id, options) for question_id in remaining_ids)
    )
    results = [warmup_result, *remaining_results]

    total_cost_usd = sum(result["cost_usd"] for result in results)
    print()
    for result in sorted(results, key=lambda item: item["question_id"]):
        print(f"  {result['question_id']}: {result['num_turns']} turnos · ${result['cost_usd']:.4f}")
    print(f"Costo total del lote: ${total_cost_usd:.4f}")


if __name__ == "__main__":
    requested_question_ids = sys.argv[1:] or ALL_QUESTION_IDS
    asyncio.run(run_bench(requested_question_ids))
