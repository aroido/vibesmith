#!/bin/bash
# SHA256 해시 계산 헬퍼

if [ "$#" -eq 0 ]; then
  echo "Usage: ./calculate-sha256.sh path/to/artifact [path/to/artifact ...]"
  exit 1
fi

for artifact in "$@"; do
  SHA256=$(shasum -a 256 "$artifact" | awk '{print $1}')
  echo "$SHA256  $artifact"
done
