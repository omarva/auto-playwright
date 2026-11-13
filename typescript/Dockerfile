# Build from the REPOSITORY ROOT so the shared features/ folder is available:
#   docker build -f typescript/Dockerfile -t auto-playwright-ts .
#   docker run --rm -v "$PWD/typescript/reports:/app/typescript/reports" auto-playwright-ts
FROM mcr.microsoft.com/playwright:v1.65.0-noble

ENV CI=true \
    HEADLESS=true

WORKDIR /app/typescript
COPY typescript/package.json typescript/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY features /app/features
COPY typescript/ ./

CMD ["npm", "test"]
