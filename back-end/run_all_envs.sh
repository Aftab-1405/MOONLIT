#!/bin/bash
set -e

# Base command
PYTEST_CMD="env/bin/pytest tests/integration/ -v"

echo "=========================================="
echo "🏃 RUNNING INTEGRATION TESTS IN ALL ENVIRONMENTS"
echo "=========================================="

for ENV in development staging testing production; do
    echo ""
    echo "=========================================="
    echo "🌍 Environment: $ENV"
    echo "=========================================="
    APP_ENV=$ENV $PYTEST_CMD || echo "❌ Tests failed in $ENV"
done

echo ""
echo "✅ Finished running across all environments!"
