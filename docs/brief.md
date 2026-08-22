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

## Decisiones de arquitectura tomadas (versión inicial, superada — ver más abajo)
- UI: Chainlit (chat UI en Python, muestra pasos intermedios del agente).
- Ejecución de código: code execution tool de Anthropic (sandbox gestionado, no infra propia).
- Se arrancó el esqueleto del proyecto sin datos sintéticos — se espera el dataset real antes de
  cablear el análisis de negocio específico.

## Pivote final: sin ejecución de código, Claude Agent SDK (2026-08-22)
El diseño con code execution + reporte JSON tardaba ~13 rondas por pregunta (~18-20 min el lote
de 7) porque el agente escribía y depuraba pandas ad-hoc en cada corrida. Decisión explícita del
usuario: **el agente no escribe ni ejecuta código** — toda la lógica de negocio se implementa una
sola vez, se prueba, y se expone como herramientas.

- **`data/quick_bench_toolkit.py`**: funciones determinísticas puras (sin LLM) que implementan
  las convenciones exactas de `CONVENTIONS.md` — clasificación de cuentas, semáforo ±1.0pp,
  facturación real, partición corriente/retroactivo, cruce nómina/ausencias por proyecto.
  Cachea el ledger (255.859 filas) y cada xlsx de nómina/ausencias en `.cache/*.parquet` — sin
  caché, el CSV tarda unos segundos y los 6 xlsx (openpyxl) ~46s en total; con caché, todo carga
  en <2s.
- **`agent/sdk_tools.py`**: envuelve el toolkit como 6 herramientas nativas del Claude Agent SDK
  (`create_sdk_mcp_server`, in-process — sin subprocess/Bash). El agente solo elige herramienta y
  argumentos tipados; nunca ve un intérprete de código. `strict_mcp_config=True` +
  `tools=allowed_tools=<las 6>` garantiza que no tenga Bash/Read/Write/Edit disponibles
  (verificado inspeccionando el `SystemMessage` de init de la sesión).
- **`run_bench.py`** (batch, para el bench): `query()` sin estado, una llamada por pregunta,
  las 7 en paralelo (`asyncio.gather`) sobre datos cargados una sola vez en memoria. Resultado:
  ~28-30s el lote completo, 2-4 turnos por pregunta, ~$0.40 total (vs. ~$1.37 y ~18-20 min de la
  versión con code execution).
- **`app.py`** (chat interactivo, Chainlit): `ClaudeSDKClient` persistente por sesión (conecta
  una vez, mantiene contexto entre mensajes). El system prompt de chat (`build_chat_system_prompt`
  en `agent/prompts.py`) es distinto al del batch: mismo rigor interno (planear→ejecutar→
  verificar), pero la respuesta visible es solo la conclusión en tono conversacional — sin narrar
  el proceso ni mostrar los pasos/herramientas en la UI (decisión explícita del usuario, dos
  veces: "no quiero ver la traza en la interfaz" y "dale más verbosidad, no que parezca un log").

### Bug de arranque del chat (resuelto)
La primera versión del chat se quedaba colgada sin dejar mandar mensajes. Causas encontradas (en
orden de impacto):
1. `chainlit run -w` (modo watch) recarga toda la app cuando detecta un cambio de archivo —
   incluida la escritura de la caché parquet que el propio servidor genera. Eso mataba la sesión
   a mitad de `on_chat_start`. Fix: correr sin `-w` en producción.
2. `load_nomina`/`load_ausencias` no tenían caché (a diferencia del ledger) — ~46s de carga en
   cada arranque de proceso, sin lock en el singleton `get_bench_tools()`. Si el navegador
   reintentaba la conexión antes de que terminara (el timeout del socket es más corto que la
   carga), cada reintento disparaba una carga nueva en paralelo, compitiendo por I/O y sin que
   ninguna terminara nunca. Fix: cachear también nómina/ausencias en `.cache/*.parquet`, y
   precalentar el singleton (`get_bench_tools()` a nivel de módulo, antes de que Chainlit acepte
   conexiones) para que `on_chat_start` sea instantáneo desde la primera sesión.

## Envío al leaderboard
Equipo: **JuanfeDS**. Primer envío (arquitectura con code execution): puntaje 0.335, calidad
0.564, costo $1.37, posición #2. Envío posterior (arquitectura sin código, Agent SDK): mismo
método de scoring, costo total del lote ~$0.40 — la fórmula de valor (`calidad × 2 / (2 + costo)`)
debería mejorar por la caída de costo aun con calidad similar. `submit.py` (oficial, descargado
de quick-golden-bench.vercel.app) empaqueta `answers/` + `traces/` con manifest sha256 y hace
POST a `/api/submit`; `--pack-only` valida sin enviar.

## Deploy (2026-08-22)
Repo en GitHub: `JuanFeDS/hackaton_claude` (privado — contiene el dataset real pseudonimizado,
61MB, sin necesidad de Git LFS). Deploy del chat en Render (Web Service, Docker): `Dockerfile`
instala Node.js + `@anthropic-ai/claude-code` (el Agent SDK lanza el CLI como binario nativo, no
lo trae empaquetado) además de las deps de Python; `render.yaml` describe el servicio para el
flujo de Blueprint (no siempre visible en la UI de Render — alternativa: "New Web Service" manual
apuntando al mismo repo, detecta el Dockerfile solo). Variables de entorno en el dashboard de
Render (no en el repo): `ANTHROPIC_API_KEY`, `QUICK_ANALYST_MODEL`. Nota: plan free de Render
duerme el servicio tras ~15 min sin tráfico; el próximo request tarda en despertar.
