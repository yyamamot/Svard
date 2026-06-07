#!/bin/sh
set -eu

for file in docs/01-specification.md docs/02-adr.md docs/03-test-plan.md docs/04-implementation-plan.md docs/05-traceability.md docs/06-ui-design.md; do
  if grep -n $'\t' "$file" >/dev/null 2>&1; then
    echo "tab character found in docs file: $file" >&2
    exit 1
  fi
done

echo "doc language check passed"
