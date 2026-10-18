# One container for the whole system: FastAPI serves the API under /api and the built frontend under /.
#   docker build -t vitalight .
#   docker run -p 8000:8000 -v vitalight-data:/data -e VITALIGHT_SECRET=change-me vitalight

FROM node:22-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY api/models ./api/models
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    VITALIGHT_DB=sqlite:////data/vitalight.db \
    VITALIGHT_DIST=/app/dist
COPY api/requirements.txt ./api/
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api/vitalight ./api/vitalight
COPY api/models ./api/models
COPY --from=web /web/dist ./dist
RUN useradd --create-home vitalight && mkdir /data && chown vitalight /data
USER vitalight
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=15s --start-period=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["python", "-m", "uvicorn", "--app-dir", "api", "vitalight.main:app", "--host", "0.0.0.0", "--port", "8000"]
