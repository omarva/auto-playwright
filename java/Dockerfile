# syntax=docker/dockerfile:1
#
# Java implementation – runs the shared features/ against the configured targets.
# Build context MUST be the repository root (the image needs ../features):
#
#   docker build -f java/Dockerfile -t auto-playwright-java .
#   docker run --rm -e TAGS=@smoke -v "$PWD/java/reports:/app/java/reports" auto-playwright-java
#
FROM mcr.microsoft.com/playwright/java:v1.65.0-noble

ENV MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository" \
    HEADLESS=true \
    CI=true

WORKDIR /app/java

# 1) Resolve dependencies first so they are cached between source changes.
COPY java/.mvn/ .mvn/
COPY java/mvnw java/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline -DskipTests || true

# 2) Sources and the shared Gherkin features.
COPY features/ /app/features/
COPY java/src/ src/
RUN ./mvnw -B -q test-compile

# Browsers and OS dependencies are pre-installed in the Playwright base image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

CMD ["./mvnw", "-B", "verify"]
