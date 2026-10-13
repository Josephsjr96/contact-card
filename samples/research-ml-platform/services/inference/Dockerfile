FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
# CPU-only torch build keeps the image well under GPU-wheel sizes, which
# matters on a 10GB free-storage constraint.
RUN pip install --no-cache-dir --target=/build/deps \
    torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --target=/build/deps -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages
COPY app ./app
RUN mkdir -p /data/model_cache
ENV PYTHONUNBUFFERED=1 \
    MODEL_CACHE_DIR=/data/model_cache \
    HF_HOME=/data/model_cache/hf

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1

EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
