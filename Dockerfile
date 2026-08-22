FROM python:3.12-slim

# El Claude Agent SDK lanza el CLI de Claude Code como subproceso nativo (no lo trae
# empaquetado): en Linux, `npm install -g @anthropic-ai/claude-code` instala un binario
# real (a diferencia de Windows, donde npm genera un shim .cmd que el SDK rechaza).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && apt-get purge -y curl gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

# Render (y servicios similares) inyectan $PORT en runtime; Chainlit necesita 0.0.0.0
# para aceptar conexiones externas al contenedor.
CMD ["sh", "-c", "chainlit run app.py --host 0.0.0.0 --port ${PORT:-8000}"]
