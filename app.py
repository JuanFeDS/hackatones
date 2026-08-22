"""Interfaz de chat (Chainlit) para el agente analista financiero de Quick Logística.

Usa un ClaudeSDKClient persistente por sesión de chat (conecta una vez, mantiene el contexto
entre mensajes) y las herramientas nativas de agent/sdk_tools.py — el agente no escribe ni
ejecuta código, solo llama herramientas ya calculadas sobre los datos reales.
"""

import os
import uuid

import chainlit as cl
from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
)

from agent.data_loader import list_dataset_relative_paths
from agent.prompts import build_chat_system_prompt
from agent.sdk_tools import get_bench_tools
from agent.sdk_trace import append_events_file, serialize_sdk_message
from config import DATA_DIR, MODEL_ID, TRACES_DIR

MAX_TURNS = 15
MAX_BUDGET_USD = 1.50
EFFORT = "medium"

# Precarga el ledger + nómina/ausencias ANTES de que el servidor acepte conexiones. Sin esto,
# la primera sesión paga el costo de carga (decenas de segundos) dentro de on_chat_start, y si
# el navegador reintenta la conexión antes de que termine, cada reintento vuelve a disparar la
# carga completa en paralelo (el singleton no tiene lock) — eso deja el chat colgado sin poder
# mandar mensajes.
get_bench_tools()


def build_options(system_prompt, mcp_server, tool_names):
    """ClaudeAgentOptions del chat: sin Bash/Write/Edit, solo las herramientas del bench."""
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


@cl.on_chat_start
async def start_chat():
    """Conecta un ClaudeSDKClient persistente para esta sesión de chat."""
    dataset_filenames = list_dataset_relative_paths()
    mcp_server, tool_names = await cl.make_async(get_bench_tools)()

    system_prompt = build_chat_system_prompt(dataset_filenames)
    options = build_options(system_prompt, mcp_server, tool_names)

    client = ClaudeSDKClient(options=options)
    await client.connect()

    session_id = str(uuid.uuid4())
    trace_path = os.path.join(TRACES_DIR, f"{session_id}.jsonl")

    cl.user_session.set("client", client)
    cl.user_session.set("trace_path", trace_path)
    cl.user_session.set("turn_count", 0)
    cl.user_session.set("total_cost_usd", 0.0)

    if dataset_filenames:
        welcome_text = (
            "Agente analista de Quick Logística listo (dataset real cargado). Preguntame lo que "
            "necesites — margen por línea/proyecto, facturación real, gasto retroactivo, "
            "novedades por proyecto, etc."
        )
    else:
        welcome_text = (
            "Agente analista de Quick Logística listo, pero no encuentro el dataset en `data/` — "
            "avisá si hace falta cargarlo antes de preguntar."
        )

    await cl.Message(content=welcome_text).send()


@cl.on_chat_end
async def end_chat():
    """Desconecta el cliente persistente al cerrar la sesión de chat."""
    client: ClaudeSDKClient = cl.user_session.get("client")
    if client is not None:
        await client.disconnect()


@cl.on_message
async def handle_message(message: cl.Message):
    """Manda el mensaje al cliente persistente y va mostrando los pasos a medida que llegan."""
    client: ClaudeSDKClient = cl.user_session.get("client")
    trace_path = cl.user_session.get("trace_path")

    await client.query(message.content)

    all_messages = []
    final_text_parts = []
    result_message = None

    async for sdk_message in client.receive_response():
        all_messages.append(sdk_message)

        if isinstance(sdk_message, AssistantMessage):
            for block in sdk_message.content:
                if isinstance(block, TextBlock):
                    final_text_parts.append(block.text)
        elif isinstance(sdk_message, ResultMessage):
            result_message = sdk_message

    events = [serialize_sdk_message(sdk_message) for sdk_message in all_messages]
    await cl.make_async(append_events_file)(trace_path, events)

    final_text = "\n\n".join(final_text_parts) or "No obtuve una respuesta de texto para esta consulta."

    turn_count = cl.user_session.get("turn_count", 0) + 1
    total_cost_usd = cl.user_session.get("total_cost_usd", 0.0)
    if result_message is not None:
        total_cost_usd += result_message.total_cost_usd or 0.0
    cl.user_session.set("turn_count", turn_count)
    cl.user_session.set("total_cost_usd", total_cost_usd)

    await cl.Message(content=final_text).send()

    cost_summary = (
        f"_turno {turn_count} · costo turno: "
        f"${(result_message.total_cost_usd if result_message else 0.0):.4f} · "
        f"acumulado sesión: ${total_cost_usd:.4f}_"
    )
    await cl.Message(content=cost_summary).send()
