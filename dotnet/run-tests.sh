#!/usr/bin/env bash
# Runs the Reqnroll suite, translating the shared TAGS / PARALLEL / BROWSER conventions
# into `dotnet test` arguments.
#
#   ./run-tests.sh                                # everything except @wip
#   TAGS="@smoke and not @api" ./run-tests.sh     # tag expression
#   BROWSER=firefox PARALLEL=4 ./run-tests.sh
#   ./run-tests.sh --demo                         # headed, slowed-down tour of playwright.dev
#   ./run-tests.sh --install-browsers             # build + install the browser first
#
# Extra arguments are passed straight to `dotnet test`.
set -euo pipefail
cd "$(dirname "$0")"

TAGS="${TAGS:-not @wip}"
BROWSER="${BROWSER:-chromium}"
PARALLEL="${PARALLEL:-2}"
CONFIGURATION="${CONFIGURATION:-Debug}"
INSTALL=false
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --demo)
      TAGS="@demo"; PARALLEL=1
      export HEADLESS=false SLOW_MO="${SLOW_MO:-500}" ;;
    --install-browsers) INSTALL=true ;;
    *) EXTRA+=("$1") ;;
  esac
  shift
done

# Cucumber tag expression -> VSTest filter on NUnit categories.
#   @smoke and not @api  ->  Category=smoke&Category!=api
to_filter() {
  echo "$1" | sed -E \
    -e 's/not[[:space:]]+@([A-Za-z0-9_-]+)/Category!=\1/g' \
    -e 's/(^|[^!=A-Za-z0-9_])@([A-Za-z0-9_-]+)/\1Category=\2/g' \
    -e 's/[[:space:]]+and[[:space:]]+/\&/g' \
    -e 's/[[:space:]]+or[[:space:]]+/|/g' \
    -e 's/^[[:space:]]+|[[:space:]]+$//g'
}

export BROWSER

if [[ "$INSTALL" == true ]]; then
  dotnet build -c "$CONFIGURATION" --nologo
  pwsh "AutoPlaywright.Specs/bin/$CONFIGURATION/net10.0/playwright.ps1" install --with-deps "$BROWSER"
fi

FILTER="$(to_filter "$TAGS")"
ARGS=(test -c "$CONFIGURATION" --nologo)
[[ -n "$FILTER" ]] && ARGS+=(--filter "$FILTER")
ARGS+=(${EXTRA[@]+"${EXTRA[@]}"} -- "NUnit.NumberOfTestWorkers=$PARALLEL")

echo "dotnet ${ARGS[*]}"
exec dotnet "${ARGS[@]}"
