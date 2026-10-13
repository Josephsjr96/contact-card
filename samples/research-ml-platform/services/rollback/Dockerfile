FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages
COPY app ./app
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8004/health')" || exit 1

EXPOSE 8004
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
