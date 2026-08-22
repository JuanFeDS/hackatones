"""Toolkit determinístico para el análisis financiero de Quick Logística (Quick Golden Bench).

Implementa las convenciones exactas de CONVENTIONS.md como funciones ya probadas, para no
depender de que el modelo re-derive la lógica contable (clasificación de cuentas, criterio de
retroactivo, etc.) desde una descripción en español cada vez que responde una pregunta.

Uso típico (con el directorio de trabajo en data/):

    import quick_bench_toolkit as qbt

    ledger = qbt.load_ledger()
    metrics = qbt.group_metrics(ledger, period="7", cost_center_id="2002")
    tabla = qbt.margin_table(ledger, cost_center_id="2002")
    facturacion = qbt.facturacion_real(ledger, period="6")
    retro = qbt.retroactive_split(ledger, period="6")
"""

import os
import re

import pandas as pd

TOOLKIT_DIR = os.path.dirname(os.path.abspath(__file__))
LEDGER_CSV_NAME = "MAYO-JUNIO-JULIO 2026.csv"
LEDGER_CACHE_PATH = os.path.join(TOOLKIT_DIR, ".cache", "quick_bench_ledger.parquet")

LINES = {
    "2001": "LONG HAUL",
    "2002": "WAREHOUSE",
    "2003": "FIRST MILE",
    "3001": "LAST MILE COLOMBIA",
    "4001": "GERENCIAS",
    "5001": "COURIER COLOMBIA",
    "1001": "GLOBAL COLOMBIA",
}

PERIOD_NAMES = {"5": "Mayo", "6": "Junio", "7": "Julio"}

STRIP_COLUMNS = [
    "DocumentId", "ConceptId", "Module", "AccountId", "CostCenterId",
    "ProjectId", "Period", "CostCenterName", "State", "ClientId",
]

MONTH_TO_PERIOD = {
    "ENERO": "1", "ENE": "1", "FEBRERO": "2", "FEB": "2", "MARZO": "3", "MAR": "3",
    "ABRIL": "4", "ABR": "4", "MAYO": "5", "MAY": "5", "JUNIO": "6", "JUN": "6",
    "JULIO": "7", "JUL": "7", "AGOSTO": "8", "AGO": "8", "SEPTIEMBRE": "9", "SEP": "9",
    "OCTUBRE": "10", "OCT": "10", "NOVIEMBRE": "11", "NOV": "11", "DICIEMBRE": "12", "DIC": "12",
}

RETROACTIVE_MONTH_PATTERN = re.compile(
    r"\b(" + "|".join(MONTH_TO_PERIOD.keys()) + r")\b", re.IGNORECASE
)
RETROACTIVE_KEYWORD_PATTERN = re.compile(
    r"\b(REV|REVR|REVREM|REVERSION|AJUSTE|RECLA|RECLASIF|CORRECCION|RETROACTIVO)\b",
    re.IGNORECASE,
)

FACTURACION_NOTE_DOCS = {"NC", "NF", "NB", "DB"}


def load_ledger(csv_path=None, use_cache=True):
    """Carga y limpia el CSV contable: separador ';', decimal ',', strip en columnas clave.

    Cachea el resultado en .cache/ledger.parquet (relativo al directorio de trabajo actual)
    para no re-parsear el CSV completo de ~255.000 filas en cada llamada.
    """
    if use_cache and os.path.exists(LEDGER_CACHE_PATH):
        return pd.read_parquet(LEDGER_CACHE_PATH)

    path = csv_path or os.path.join(TOOLKIT_DIR, LEDGER_CSV_NAME)
    ledger = pd.read_csv(path, sep=";", dtype=str)

    for column in STRIP_COLUMNS:
        if column in ledger.columns:
            ledger[column] = ledger[column].str.strip()

    for column in ("Debito", "Credito"):
        ledger[column] = pd.to_numeric(
            ledger[column].str.replace(",", ".", regex=False), errors="coerce"
        ).fillna(0.0)

    ledger["Date"] = pd.to_datetime(ledger["Date"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
    ledger["AccountClass"] = ledger["AccountId"].str[0]
    ledger["Line"] = ledger["CostCenterId"].map(LINES)

    if use_cache:
        os.makedirs(os.path.dirname(LEDGER_CACHE_PATH), exist_ok=True)
        ledger.to_parquet(LEDGER_CACHE_PATH, index=False)

    return ledger


def group_metrics(ledger, period, cost_center_id=None, project_id=None):
    """INGRESO (clase 4), COSTO (6+7), GASTO (5) y MARGEN de un grupo y mes (CONV §2.1-2.4).

    `period`: "5" (mayo), "6" (junio) o "7" (julio). `margen` es `None` si ingreso <= 0.
    """
    subset = ledger[ledger["Period"] == str(period)]
    if cost_center_id is not None:
        subset = subset[subset["CostCenterId"] == str(cost_center_id)]
    if project_id is not None:
        subset = subset[subset["ProjectId"] == str(project_id)]

    clase4 = subset[subset["AccountClass"] == "4"]
    clase67 = subset[subset["AccountClass"].isin(["6", "7"])]
    clase5 = subset[subset["AccountClass"] == "5"]

    ingreso = float((clase4["Credito"] - clase4["Debito"]).sum())
    costo = float((clase67["Debito"] - clase67["Credito"]).sum())
    gasto = float((clase5["Debito"] - clase5["Credito"]).sum())
    margen = round((ingreso - costo) / ingreso, 4) if ingreso > 0 else None

    return {
        "period": str(period),
        "period_name": PERIOD_NAMES.get(str(period), str(period)),
        "ingreso": ingreso,
        "costo": costo,
        "gasto": gasto,
        "margen": margen,
    }


def classify_variation(variation_pp):
    """Semáforo (CONV §2.6, umbral verificado): 🟢 >+1.0pp · 🔴 <-1.0pp · 🟡 en el medio."""
    if variation_pp is None:
        return "n/a"
    if variation_pp > 1.0:
        return "🟢 Aumenta"
    if variation_pp < -1.0:
        return "🔴 Disminuye"
    return "🟡 Se mantiene"


def margin_table(ledger, cost_center_id=None, project_id=None):
    """Tabla mayo/junio/julio de un grupo (línea y/o proyecto): ingreso, costo, margen,

    variación jun->jul en pp, semáforo, variación de ingreso y utilidad de julio (CONV §2.5-2.6).
    """
    by_period = {
        period: group_metrics(ledger, period, cost_center_id=cost_center_id, project_id=project_id)
        for period in ("5", "6", "7")
    }

    margen_jun = by_period["6"]["margen"]
    margen_jul = by_period["7"]["margen"]
    variacion_pp = (
        round((margen_jul - margen_jun) * 100, 2)
        if margen_jul is not None and margen_jun is not None
        else None
    )

    return {
        "mayo": by_period["5"],
        "junio": by_period["6"],
        "julio": by_period["7"],
        "variacion_pp": variacion_pp,
        "variacion_ingreso": by_period["7"]["ingreso"] - by_period["6"]["ingreso"],
        "utilidad_julio": by_period["7"]["ingreso"] - by_period["7"]["costo"],
        "observacion": classify_variation(variacion_pp),
    }


def all_lines_margin_table(ledger):
    """margin_table() para cada línea de LINES, indexado por CostCenterId."""
    return {
        cost_center_id: {"line_name": line_name, **margin_table(ledger, cost_center_id=cost_center_id)}
        for cost_center_id, line_name in LINES.items()
    }


def facturacion_real(ledger, period):
    """Facturación real = Σcrédito FC − Σdébito DV (± notas), en cuentas clase 4 (CONV §4).

    Devuelve también el ingreso contable neto de clase 4, provisiones PI, reversiones RI y
    la diferencia entre ingreso contable y facturación real, para reportar como contexto.
    """
    subset = ledger[(ledger["Period"] == str(period)) & (ledger["AccountClass"] == "4")]

    fc_credito = float(subset.loc[subset["DocumentId"] == "FC", "Credito"].sum())
    dv_debito = float(subset.loc[subset["DocumentId"] == "DV", "Debito"].sum())
    notas = subset[subset["DocumentId"].isin(FACTURACION_NOTE_DOCS)]
    notas_netas = float((notas["Credito"] - notas["Debito"]).sum())
    facturacion = fc_credito - dv_debito + notas_netas

    ingreso_contable_neto = float((subset["Credito"] - subset["Debito"]).sum())
    provision_pi = float(
        (
            subset.loc[subset["DocumentId"] == "PI", "Credito"]
            - subset.loc[subset["DocumentId"] == "PI", "Debito"]
        ).sum()
    )
    reversion_ri = float(
        (
            subset.loc[subset["DocumentId"] == "RI", "Credito"]
            - subset.loc[subset["DocumentId"] == "RI", "Debito"]
        ).sum()
    )

    return {
        "period": str(period),
        "period_name": PERIOD_NAMES.get(str(period), str(period)),
        "facturacion_real": facturacion,
        "fc_credito": fc_credito,
        "dv_debito": dv_debito,
        "notas_netas": notas_netas,
        "ingreso_contable_neto": ingreso_contable_neto,
        "provision_pi": provision_pi,
        "reversion_ri": reversion_ri,
        "diferencia_ingreso_vs_facturacion": ingreso_contable_neto - facturacion,
    }


def _current_month_names(period):
    return [name for name, code in MONTH_TO_PERIOD.items() if code == str(period)]


def _is_retroactive(observation, period):
    """Aplica el criterio de retroactivo (CONV §5) sobre el texto de `Observation`."""
    if not isinstance(observation, str) or not observation.strip():
        return False
    text = observation.upper()

    for match in RETROACTIVE_MONTH_PATTERN.finditer(text):
        matched_period = MONTH_TO_PERIOD.get(match.group(1).upper())
        if matched_period is not None and int(matched_period) < int(period):
            return True

    if RETROACTIVE_KEYWORD_PATTERN.search(text):
        current_names = _current_month_names(period)
        if any(name in text for name in current_names):
            return False
        return True

    return False


def retroactive_split(ledger, period):
    """Partición corriente/retroactivo de gasto(5), costo(6+7) y total(5+6+7) (CONV §5).

    La partición se calcula sobre el neto (Debito - Credito). Incluye los 10 `Observation`
    más frecuentes de cada bucket para poder auditar el criterio aplicado.
    """
    subset = ledger[
        (ledger["Period"] == str(period)) & (ledger["AccountClass"].isin(["5", "6", "7"]))
    ].copy()
    subset["neto"] = subset["Debito"] - subset["Credito"]
    subset["es_retroactivo"] = subset["Observation"].apply(
        lambda observation: _is_retroactive(observation, period)
    )

    def bucket(account_classes):
        rows = subset[subset["AccountClass"].isin(account_classes)]
        corriente = float(rows.loc[~rows["es_retroactivo"], "neto"].sum())
        retroactivo = float(rows.loc[rows["es_retroactivo"], "neto"].sum())
        total = corriente + retroactivo
        pct_retroactivo = round(retroactivo / total * 100, 2) if total else None
        return {
            "corriente": corriente,
            "retroactivo": retroactivo,
            "total": total,
            "pct_retroactivo": pct_retroactivo,
        }

    return {
        "period": str(period),
        "period_name": PERIOD_NAMES.get(str(period), str(period)),
        "gasto_clase_5": bucket(["5"]),
        "costo_clase_6_7": bucket(["6", "7"]),
        "total_clase_5_6_7": bucket(["5", "6", "7"]),
        "top_observations_retroactivo": (
            subset.loc[subset["es_retroactivo"], "Observation"].value_counts().head(10).to_dict()
        ),
        "top_observations_corriente": (
            subset.loc[~subset["es_retroactivo"], "Observation"].value_counts().head(10).to_dict()
        ),
    }


def _xlsx_cache_path(path, prefix):
    basename = os.path.splitext(os.path.basename(path))[0]
    return os.path.join(TOOLKIT_DIR, ".cache", f"{prefix}_{basename}.parquet")


def load_nomina(path, use_cache=True):
    """Carga una hoja de nómina (`ACUMULADO ...xlsx`, hoja índice 0). `Period` queda como str.

    Cachea el resultado en .cache/ — openpyxl tarda varios segundos por archivo y no vale la
    pena repetir el parseo en cada arranque de proceso.
    """
    cache_path = _xlsx_cache_path(path, "nomina")
    if use_cache and os.path.exists(cache_path):
        return pd.read_parquet(cache_path)

    nomina = pd.read_excel(path, sheet_name=0)
    nomina["Period"] = nomina["Period"].astype(str)
    nomina["ClientId"] = nomina["ClientId"].astype(str)

    if use_cache:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        nomina.to_parquet(cache_path, index=False)

    return nomina


def load_ausencias(path, use_cache=True):
    """Carga el listado de ausencias (hoja `' Data'`, con espacio inicial).

    OJO: en el archivo real, la columna de empleado no se llama `ClientId` sino `Columna1`
    (no está documentado en el brief, se confirmó inspeccionando el archivo). Esta función la
    renombra a `ClientId` para que coincida con la convención del resto del toolkit.
    Deduplica por (ClientId, ConceptId, DateInitial, DateFinal) — CONV §1.5. Cachea en .cache/
    por la misma razón que `load_nomina`.
    """
    cache_path = _xlsx_cache_path(path, "ausencias")
    if use_cache and os.path.exists(cache_path):
        return pd.read_parquet(cache_path)

    ausencias = pd.read_excel(path, sheet_name=" Data")
    if "Columna1" in ausencias.columns and "ClientId" not in ausencias.columns:
        ausencias = ausencias.rename(columns={"Columna1": "ClientId"})
    ausencias["ClientId"] = ausencias["ClientId"].astype(str)
    ausencias["ProjectId"] = ausencias["ProjectId"].astype(str)
    ausencias["DateInitial"] = pd.to_datetime(
        ausencias["DateInitial"], format="%d/%m/%Y", errors="coerce"
    )
    ausencias["DateFinal"] = pd.to_datetime(
        ausencias["DateFinal"], format="%d/%m/%Y", errors="coerce"
    )
    ausencias = ausencias.drop_duplicates(
        subset=["ClientId", "ConceptId", "DateInitial", "DateFinal"]
    )

    if use_cache:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        ausencias.to_parquet(cache_path, index=False)

    return ausencias


def employee_project_map(ledger, period=None):
    """Vínculo empleado -> proyecto desde el ledger (CONV §1.6): filas DocumentId en (NM, AP)."""
    subset = ledger[ledger["DocumentId"].isin(["NM", "AP"])]
    if period is not None:
        subset = subset[subset["Period"] == str(period)]
    return (
        subset[["ClientId", "ClientName", "ProjectId"]]
        .dropna(subset=["ProjectId"])
        .drop_duplicates()
    )


def account_delta_breakdown(ledger, period_a, period_b, cost_center_id=None, project_id=None, top_n=10):
    """Descompone por AccountId/AccountName el delta (period_b - period_a) de INGRESO y COSTO.

    Útil para explicar de dónde sale la variación de un grupo entre dos meses (CONV §6.2).
    Devuelve los `top_n` por |Δ| para ingreso (clase 4) y costo (clases 6/7) por separado.
    """
    def account_sums(period):
        subset = ledger[ledger["Period"] == str(period)]
        if cost_center_id is not None:
            subset = subset[subset["CostCenterId"] == str(cost_center_id)]
        if project_id is not None:
            subset = subset[subset["ProjectId"] == str(project_id)]
        subset = subset.copy()
        subset["neto_ingreso"] = subset["Credito"] - subset["Debito"]
        subset["neto_costo"] = subset["Debito"] - subset["Credito"]
        return subset

    rows_a = account_sums(period_a)
    rows_b = account_sums(period_b)

    def delta_for(account_class, value_column):
        group_a = (
            rows_a[rows_a["AccountClass"] == account_class]
            .groupby(["AccountId", "AccountName"])[value_column]
            .sum()
        )
        group_b = (
            rows_b[rows_b["AccountClass"] == account_class]
            .groupby(["AccountId", "AccountName"])[value_column]
            .sum()
        )
        delta = group_b.add(-group_a, fill_value=0.0)
        delta = delta.reindex(delta.abs().sort_values(ascending=False).index)
        return [
            {"account_id": account_id, "account_name": account_name, "delta": float(value)}
            for (account_id, account_name), value in delta.head(top_n).items()
        ]

    return {
        "ingreso_por_cuenta": delta_for("4", "neto_ingreso"),
        "costo_por_cuenta": delta_for("6", "neto_costo") + delta_for("7", "neto_costo"),
    }
