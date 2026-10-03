"""Herramientas nativas (SDK MCP, in-process) que envuelven quick_bench_toolkit.

El agente NO escribe ni ejecuta código: elige una de estas herramientas y le pasa argumentos
tipados. Cada una corre en el mismo proceso de run_bench.py, sobre el ledger y la nómina/
ausencias ya cargados en memoria una sola vez — sin Bash, sin subprocess, sin reprocesar nada
por pregunta.
"""

import json
import os
import sys
import threading

from claude_agent_sdk import create_sdk_mcp_server, tool

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
sys.path.insert(0, DATA_DIR)

import quick_bench_toolkit as qbt  # noqa: E402

NOMINA_PATHS = {
    "5": os.path.join(DATA_DIR, "Nomina", "05. MAYO", "ACUMULADO FINAL QH MAY 2026.xlsx"),
    "6": os.path.join(DATA_DIR, "Nomina", "06. JUNIO", "ACUMULADO FINAL QH JUN 2026.xlsx"),
    "7": os.path.join(DATA_DIR, "Nomina", "07. JULIO", "ACUMULADO INICIAL QH 03.08.2026.xlsx"),
}
AUSENCIAS_PATHS = {
    "5": os.path.join(
        DATA_DIR, "Nomina", "05. MAYO", "Listado_de_Ausencias (80) - QH ABR - MAY 2026.xlsx"
    ),
    "6": os.path.join(DATA_DIR, "Nomina", "06. JUNIO", "Listado_de_Ausencias (81).xlsx"),
    "7": os.path.join(
        DATA_DIR, "Nomina", "07. JULIO", "Listado_de_Ausencias - JUN - JUL 2026 - QH.xlsx"
    ),
}


def _json_result(payload):
    """Empaqueta un dict/list como el content block de texto que espera el protocolo MCP."""
    return {
        "content": [
            {"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2, default=str)}
        ]
    }


def load_bench_context():
    """Carga en memoria el ledger y la nómina/ausencias de los tres meses (una sola vez)."""
    ledger = qbt.load_ledger(csv_path=os.path.join(DATA_DIR, qbt.LEDGER_CSV_NAME))
    nomina_by_period = {
        period: qbt.load_nomina(path) for period, path in NOMINA_PATHS.items() if os.path.exists(path)
    }
    ausencias_by_period = {
        period: qbt.load_ausencias(path)
        for period, path in AUSENCIAS_PATHS.items()
        if os.path.exists(path)
    }
    return ledger, nomina_by_period, ausencias_by_period


def _project_employees(ledger, project_id, period):
    """ClientId de los empleados de un proyecto en un período, según el vínculo del ledger."""
    mapping = qbt.employee_project_map(ledger, period=period)
    matches = mapping.loc[mapping["ProjectId"] == str(project_id), "ClientId"]
    return sorted(matches.unique().tolist())


def build_bench_tools(ledger, nomina_by_period, ausencias_by_period):
    """Arma el server MCP con las herramientas del bench, cerradas sobre los datos ya cargados."""

    @tool(
        "margin_table",
        "Tabla de ingreso/costo/margen de mayo/junio/julio para una linea y/o proyecto de Quick "
        "Logistica, con variacion jun->jul en pp, semaforo, variacion de ingreso y utilidad de "
        "julio. Dejar un argumento en '' significa 'sin filtrar por ese campo'.",
        {"cost_center_id": str, "project_id": str},
    )
    async def margin_table_tool(args):
        result = qbt.margin_table(
            ledger,
            cost_center_id=args.get("cost_center_id") or None,
            project_id=args.get("project_id") or None,
        )
        return _json_result(result)

    @tool(
        "all_lines_margin_table",
        "margin_table() para las 7 lineas de Quick Logistica de una sola vez (CostCenterId: "
        "2001 LONG HAUL, 2002 WAREHOUSE, 2003 FIRST MILE, 3001 LAST MILE COLOMBIA, "
        "4001 GERENCIAS, 5001 COURIER COLOMBIA, 1001 GLOBAL COLOMBIA).",
        {},
    )
    async def all_lines_margin_table_tool(_args):
        return _json_result(qbt.all_lines_margin_table(ledger))

    @tool(
        "facturacion_real",
        "Facturacion real de un mes (Sigma credito FC menos Sigma debito DV, +/- notas, en "
        "cuentas clase 4), con contexto de ingreso contable neto, provisiones PI y reversiones "
        "RI, y la diferencia entre ingreso contable y facturacion real. period: '5'/'6'/'7'.",
        {"period": str},
    )
    async def facturacion_real_tool(args):
        return _json_result(qbt.facturacion_real(ledger, period=args["period"]))

    @tool(
        "retroactive_split",
        "Particion corriente/retroactivo de gasto (clase 5), costo (6+7) y total, para un mes, "
        "con los Observation mas frecuentes de cada bucket para auditar el criterio aplicado. "
        "period: '5'/'6'/'7'.",
        {"period": str},
    )
    async def retroactive_split_tool(args):
        return _json_result(qbt.retroactive_split(ledger, period=args["period"]))

    @tool(
        "account_delta_breakdown",
        "Top-N cuentas contables por variacion absoluta de ingreso y de costo entre dos meses, "
        "para una linea y/o proyecto — para explicar de donde sale una variacion de margen. "
        "period_a/period_b: '5'/'6'/'7'. Dejar cost_center_id/project_id en '' para no filtrar.",
        {"period_a": str, "period_b": str, "cost_center_id": str, "project_id": str, "top_n": float},
    )
    async def account_delta_breakdown_tool(args):
        result = qbt.account_delta_breakdown(
            ledger,
            period_a=args["period_a"],
            period_b=args["period_b"],
            cost_center_id=args.get("cost_center_id") or None,
            project_id=args.get("project_id") or None,
            top_n=int(args.get("top_n") or 10),
        )
        return _json_result(result)

    @tool(
        "project_novelties",
        "Analisis completo de 'novedades' de un proyecto entre junio y julio: metricas de "
        "margen, descomposicion de la variacion de costo/ingreso por cuenta, altas/bajas de "
        "personal, conceptos de nomina con mayor variacion, y ausencias del proyecto por mes. "
        "Usar esta herramienta para preguntas del tipo 'que novedades tuvo el proyecto NNNN'.",
        {"project_id": str},
    )
    async def project_novelties_tool(args):
        project_id = str(args["project_id"])

        metrics = qbt.margin_table(ledger, project_id=project_id)
        deltas = qbt.account_delta_breakdown(ledger, "6", "7", project_id=project_id, top_n=10)

        employees_by_period = {
            period: _project_employees(ledger, project_id, period) for period in ("5", "6", "7")
        }
        altas = sorted(set(employees_by_period["7"]) - set(employees_by_period["6"]))
        bajas = sorted(set(employees_by_period["6"]) - set(employees_by_period["7"]))

        nomina_concept_deltas = []
        if "6" in nomina_by_period and "7" in nomina_by_period:
            relevant_employees = set(employees_by_period["6"]) | set(employees_by_period["7"])

            def concept_sums(period):
                nomina_df = nomina_by_period[period]
                subset = nomina_df[nomina_df["ClientId"].isin(relevant_employees)]
                return subset.groupby("ConceptName")["Value"].sum()

            junio_sums = concept_sums("6")
            julio_sums = concept_sums("7")
            delta = julio_sums.add(-junio_sums, fill_value=0.0)
            delta = delta.reindex(delta.abs().sort_values(ascending=False).index)
            nomina_concept_deltas = [
                {"concept": concept, "delta_jun_a_jul": float(value)}
                for concept, value in delta.head(10).items()
            ]

        ausencias_por_periodo = {}
        for period, ausencias_df in ausencias_by_period.items():
            subset = ausencias_df[ausencias_df["ProjectId"] == project_id]
            columns = [
                column
                for column in ("ClientId", "ClientName", "ConceptName", "DateInitial", "DateFinal", "Quantity")
                if column in subset.columns
            ]
            ausencias_por_periodo[period] = json.loads(subset[columns].to_json(orient="records"))

        return _json_result(
            {
                "project_id": project_id,
                "metrics": metrics,
                "cost_account_deltas_jun_jul": deltas["costo_por_cuenta"],
                "income_account_deltas_jun_jul": deltas["ingreso_por_cuenta"],
                "empleados_mayo": employees_by_period["5"],
                "empleados_junio": employees_by_period["6"],
                "empleados_julio": employees_by_period["7"],
                "altas_jun_a_jul": altas,
                "bajas_jun_a_jul": bajas,
                "nomina_concept_deltas_jun_jul": nomina_concept_deltas,
                "ausencias_por_periodo": ausencias_por_periodo,
            }
        )

    tools = [
        margin_table_tool,
        all_lines_margin_table_tool,
        facturacion_real_tool,
        retroactive_split_tool,
        account_delta_breakdown_tool,
        project_novelties_tool,
    ]
    server = create_sdk_mcp_server(name="quick_bench", version="1.0.0", tools=tools)
    tool_names = [defined_tool.name for defined_tool in tools]
    return server, tool_names


_bench_tools_singleton = None
_bench_tools_lock = threading.Lock()


def get_bench_tools():
    """Devuelve (server, tool_names), cargando los datos y armando las herramientas una sola
    vez por proceso. Pensado para el chat: la primera sesión paga la carga, las siguientes
    reutilizan el mismo server (los datos son de solo lectura, seguro entre requests async).

    Con lock: si dos hilos llaman esto a la vez (ej. la precarga de arranque y la primera
    sesión conectándose en simultáneo), el segundo espera al primero en vez de repetir la
    carga completa en paralelo — eso fue justo lo que dejó el chat colgado la primera vez.
    """
    global _bench_tools_singleton
    if _bench_tools_singleton is not None:
        return _bench_tools_singleton
    with _bench_tools_lock:
        if _bench_tools_singleton is None:
            ledger, nomina_by_period, ausencias_by_period = load_bench_context()
            _bench_tools_singleton = build_bench_tools(
                ledger, nomina_by_period, ausencias_by_period
            )
    return _bench_tools_singleton
