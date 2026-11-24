#!/usr/bin/env bash
# verify-backup.sh — verify a backup made by backup-to-ventoy.sh
# Usage: ./verify-backup.sh /path/to/HOST-Backup-STAMP
set -uo pipefail
BK="${1:-}"
[ -n "$BK" ] && [ -d "$BK" ] || { echo "Usage: $0 /path/to/HOST-Backup-STAMP" >&2; exit 2; }
cd "$BK" || exit 1
rc=0
echo "== sha256 =="
if [ -f SHA256SUMS.txt ]; then
  sha256sum -c SHA256SUMS.txt || rc=1
else
  echo "SHA256SUMS.txt missing"; rc=1
fi
echo "== zstd integrity =="
for a in 10-home/*.tar.zst 20-opt/*.tar.zst 30-etc/*.tar.zst 50-firefox/*.tar.zst; do
  [ -e "$a" ] || continue
  if zstd -tq "$a"; then echo "OK   $a"; else echo "FAIL $a"; rc=1; fi
done
echo "== required files =="
for f in MANIFEST.txt RESTORE.md 00-inventory/packages/pacman-explicit.txt 00-inventory/packages/pacman-foreign-aur.txt; do
  [ -e "$f" ] && echo "OK   $f" || { echo "MISSING $f"; rc=1; }
done
exit "$rc"
