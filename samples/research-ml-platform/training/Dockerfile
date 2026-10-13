FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir \
    torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["python", "train.py"]
