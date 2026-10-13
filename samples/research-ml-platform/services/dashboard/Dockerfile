FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages
COPY app ./app
ENV PYTHONUNBUFFERED=1

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8501/_stcore/health')" || exit 1

EXPOSE 8501
CMD ["streamlit", "run", "app/main.py", "--server.port=8501", "--server.address=0.0.0.0"]
