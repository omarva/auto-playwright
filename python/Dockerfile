# Build from the REPOSITORY ROOT so the shared features/ folder is available:
#   docker build -f python/Dockerfile -t auto-playwright-py .
#   docker run --rm -v "$PWD/python/reports:/app/python/reports" auto-playwright-py
FROM mcr.microsoft.com/playwright/python:v1.65.1-noble

ENV CI=true \
    HEADLESS=true \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/python
COPY python/requirements.txt ./
RUN pip install -r requirements.txt

COPY features /app/features
COPY python/ ./

CMD ["python", "-m", "pytest"]
