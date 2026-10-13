FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages
COPY app ./app
RUN mkdir -p /data
ENV PYTHONUNBUFFERED=1 \
    RESEARCH_DB_PATH=/data/research.db

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8003/health')" || exit 1

EXPOSE 8003
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
