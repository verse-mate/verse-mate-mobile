#!/bin/bash
set -e

echo "=========================================="
echo "Web Desktop E2E Tests"
echo "Display: $DISPLAY"
echo "=========================================="

# Phase 1: Warm up — load app once to prime bundle + skip onboarding
echo "Phase 1: Warming up web app..."
if ! maestro test .maestro/shared/setup-desktop-web.yaml; then
  echo "Warmup failed, retrying after 10s..."
  sleep 10
  if ! maestro test .maestro/shared/setup-desktop-web.yaml; then
    echo "Warmup failed twice, final retry after 10s..."
    sleep 10
    maestro test .maestro/shared/setup-desktop-web.yaml
  fi
fi
echo "Warmup complete"

# Phase 2: Run desktop split-view tests
echo "Phase 2: Running web-desktop tests..."
OVERALL_EXIT=0
maestro test .maestro/web-desktop/ || OVERALL_EXIT=1

if [ $OVERALL_EXIT -ne 0 ]; then
  echo "Some web desktop tests failed"
  exit 1
fi
echo "All web desktop Maestro tests passed"
