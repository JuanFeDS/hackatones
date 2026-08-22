# Brief del hackaton — Analista financiero agéntico (Quick Logística)

## Contexto
Workshop con formato de hackaton. La tesis: el 95% de los pilotos de IA generativa en empresas no
generan valor porque construyen chatbots (responden lo que dice el dato) en vez de agentes que
analizan (planifican el análisis, escriben y ejecutan su propio código, verifican si el resultado
tiene sentido, y avisan cuando la información no alcanza para decidir).

## Empresa caso: Quick Logística
Operación en Colombia, México, Chile y USA. Objetivo: construir el mejor AI Agent para análisis de
información — versátil, robusto, capaz de responder preguntas reales de negocio y hacer análisis
masivo de datos.

## Qué se construye
Un agente analítico funcional en un día, usando el ecosistema de Anthropic (API, Claude Agent SDK,
MCP, etc.).

## Cómo se evalúa
- Todos los equipos corren el mismo eval harness contra respuestas conocidas (no gana la demo más
  vistosa, gana el agente cuyas cifras aguantan revisión y validación de negocio).
- Se evalúa precisión de la respuesta **y** optimización en costos.

## Datos conocidos al 2026-08-22
- Dataset real de Quick Logística: aún no entregado.
- Detalle del eval harness: aún no entregado.
- Deadline: mismo día (hasta ~3/4 de la jornada).

## Tarea de negocio concreta (docs/guia.md, agregada 2026-08-22)
El caso real es un **informe de rentabilidad por proyecto** para junio y julio de 2026:
- Fuente contable: "MAYO-JUNIO-JULIO 2026.csv" (clase 4 = ingresos, 5 = gastos, 6 = costos de venta
  Warehouse, 7 = costos de proyecto).
- Fuentes de soporte: nómina ("Acumulado Final/Inicial QH") y ausencias, de mayo/junio/julio 2026,
  usadas solo para explicar variaciones de costo (vacaciones, incapacidades, novedades de personal).
- Salida esperada por proyecto: GERENCIA, PROYECTO, NOMBRE C. DE COSTO ("Proyecto <código>"),
  INGRESO/COSTO/% por mes, VARIACIÓN, semáforo (🟢/🔴/🟡), VARIACIÓN INGRESO, UTILIDAD, COMENTARIO.
- El brief no define el umbral numérico de "🟡 se mantiene" — se asumió ±1 punto porcentual en
  `agent/prompts.py` (`RENTABILIDAD_REPORT_SPEC`), declarado como supuesto explícito a ajustar si
  el eval harness espera otro criterio.
- Esta spec ya está cableada en el system prompt del agente (`agent/prompts.py`). Falta: los
  archivos de datos reales (ninguno estaba en `data/` al momento de leer el brief).

## Pivote real (charlas/2026-agents-bogota/hackathon/, agregado 2026-08-22)
El reto real no es un chat genérico: es el **Quick Golden Bench**
(quick-golden-bench.vercel.app), con 7 preguntas fijas (`preguntas/q01.md`…`q07.md`),
datos reales pseudonimizados (`data/CASO-FINANCIERO.zip`, checksum verificado) y
convenciones contables muy precisas (`CONVENTIONS.md`): mapeo `CostCenterId`→línea,
manejo de filas corridas, definición de "facturación real" (FC−DV±notas), criterio de
gasto corriente vs. retroactivo, umbral de semáforo ±1.0pp (confirmado, coincide con mi
supuesto anterior), cruce con nómina/ausencias para "novedades" por proyecto.

Entregable real: `answers/qNN.json` (schema: question_id/answer/summary/method/code/
caveats/conventions) + `traces/qNN.events.jsonl`, empaquetados y enviados con
`submit.py` (curl -sO desde quick-golden-bench.vercel.app) — **no** el chat de Chainlit.
Sin traza, tope de nota 0.5. `answer: null` con caveats > cifra inventada.

Equipo: **JuanfeDS**. El usuario pidió preparar el paquete (`--pack-only`) y revisar antes
de enviar — el envío real al leaderboard público lo hace el usuario.

Construido para esto: `run_bench.py` (corre las 7 preguntas contra el agente, cada una
como turno independiente pero reutilizando el mismo container de code execution —
evita re-parsear el CSV de 255k filas y no infla el costo en tokens por acumular
historial). `agent/prompts.py` tiene las convenciones exactas de `CONVENTIONS.md`
codificadas (`QUICK_BENCH_CONVENTIONS`) y el contrato de respuesta JSON
(`ANSWER_CONTRACT_TEMPLATE`). Los datos reales ya están copiados en `data/`
(CSV + Nomina/05,06,07).

## Decisiones de arquitectura tomadas
- UI: Chainlit (chat UI en Python, muestra pasos intermedios del agente).
- Ejecución de código: code execution tool de Anthropic (sandbox gestionado, no infra propia).
- Se arrancó el esqueleto del proyecto sin datos sintéticos — se espera el dataset real antes de
  cablear el análisis de negocio específico.
