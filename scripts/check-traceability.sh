#!/bin/sh
set -eu

required='docs/01-specification.md docs/02-adr.md docs/03-test-plan.md docs/04-implementation-plan.md docs/05-traceability.md docs/06-ui-design.md docs/08-feature-catalog.md docs/process/token-efficiency.md docs/traceability/README.md docs/history/04-implementation-history.md'

for file in $required; do
  if [ ! -s "$file" ]; then
    echo "missing required docs file: $file" >&2
    exit 1
  fi
done

search_paths='docs/01-specification.md docs/02-adr.md docs/03-test-plan.md docs/04-implementation-plan.md docs/05-traceability.md docs/08-feature-catalog.md docs/traceability docs/history/04-implementation-history.md docs/history/implementation'

for id in REQ-F001 ADR-001 IMP-001 IMP-004 TP-001 TP-006 TP-007 FEAT-001; do
  if ! grep -R "$id" $search_paths >/dev/null 2>&1; then
    echo "traceability id not found: $id" >&2
    exit 1
  fi
done

echo "traceability check passed"
