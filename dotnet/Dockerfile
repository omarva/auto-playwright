# syntax=docker/dockerfile:1
#
# C# / Reqnroll + Playwright test runner.
# Build context is the REPOSITORY ROOT (the shared features/ folder lives there):
#
#   docker build -f dotnet/Dockerfile -t autoplaywright-dotnet .
#   docker run --rm -e TAGS="@smoke" -v "$PWD/dotnet/reports:/app/dotnet/reports" autoplaywright-dotnet
#
# The .NET SDK image ships PowerShell, which Playwright's install script needs.
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HEADLESS=true \
    CONFIGURATION=Release

WORKDIR /app

# Restore first so the package layer is cached independently of source changes.
COPY dotnet/global.json dotnet/Directory.Build.props dotnet/AutoPlaywright.slnx dotnet/
COPY dotnet/AutoPlaywright.Specs/AutoPlaywright.Specs.csproj dotnet/AutoPlaywright.Specs/
RUN dotnet restore dotnet/AutoPlaywright.slnx

COPY features/ features/
COPY dotnet/ dotnet/
RUN dotnet build dotnet/AutoPlaywright.slnx -c Release --no-restore \
 && pwsh dotnet/AutoPlaywright.Specs/bin/Release/net10.0/playwright.ps1 install --with-deps chromium firefox webkit \
 && chmod +x dotnet/run-tests.sh

WORKDIR /app/dotnet
ENTRYPOINT ["./run-tests.sh"]
CMD ["--no-build"]
