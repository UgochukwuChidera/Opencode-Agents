#!/usr/bin/env bash
#
# organize-usb.sh — sort a messy drive into six key folders plus two overflow
# folders, move-only (nothing is deleted).
#
#   Pictures  Downloads  Documents  Desktop  Videos  Music
#   To Be Organized   To Be Deleted
#
# Usage:
#   ./organize-usb.sh /run/media/$USER/Ventoy            # dry run (default)
#   ./organize-usb.sh /run/media/$USER/Ventoy --apply    # actually move
#
# Rules:
#   - loose files are classified by extension
#   - clearly-named folders are moved whole (Anime -> Videos/Anime, etc.)
#   - unknown folders/files go to "To Be Organized" for human review
#   - exact duplicates (same basename + same byte size) go to "To Be Deleted/duplicates"
#   - empty folders go to "To Be Deleted/empty dirs"
#   - $RECYCLE.BIN, System Volume Information and .Trash-* are never touched
#
set -uo pipefail

USB="${1:-}"
APPLY=0
[ "${2:-}" = "--apply" ] && APPLY=1
[ -n "$USB" ] && [ -d "$USB" ] || { echo "Usage: $0 /path/to/usb [--apply]" >&2; exit 2; }
cd "$USB" || exit 1

mkdir -p "To Be Organized"
LOG="$USB/To Be Organized/_ORGANIZE_REPORT.txt"
CATS=(Pictures Downloads Documents Desktop Videos Music)
EXTRAS=("To Be Organized" "To Be Deleted")

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

do_mv() {
  local src="$1" dest="$2"
  if [ "$APPLY" -eq 1 ]; then
    mkdir -p "$dest" && mv -n "$src" "$dest/" && log "MOVED: $src -> $dest/"
  else
    echo "WOULD MOVE: $src -> $dest/"
  fi
}

# move a file, but if an identical (basename+size) file already exists under
# the destination root, park it in To Be Deleted/duplicates instead.
move_dup_in() {
  local src="$1" dest="$2" search="$3" base size found="" f fsize fbase
  base="$(basename "$src")"; size="$(stat -c %s "$src")"
  while IFS= read -r -d '' f; do
    fsize="$(stat -c %s "$f")"
    [ "$fsize" = "$size" ] || continue
    fbase="$(basename "$f")"
    [ "$fbase" = "$base" ] || continue
    found="$f"; break
  done < <(find "$search" -type f -print0 2>/dev/null)
  if [ -n "$found" ]; then
    if [ "$APPLY" -eq 1 ]; then
      mkdir -p "To Be Deleted/duplicates"
      [ -e "To Be Deleted/duplicates/$base" ] && base="$base.$(date +%s%N)"
      mv -n "$src" "To Be Deleted/duplicates/$base" && log "DUPLICATE: $src (same as $found)"
    else
      echo "WOULD DEDUPE: $src (same as $found)"
    fi
  else
    do_mv "$src" "$dest"
  fi
}

classify_file() {
  case "${1,,}" in
    *.jpg|*.jpeg|*.png|*.gif|*.webp|*.bmp|*.svg|*.heic|*.tif|*.tiff|*.avif) echo Pictures ;;
    *.mp4|*.mkv|*.webm|*.avi|*.mov|*.m4v|*.flv|*.wmv|*.mpg|*.mpeg|*.ts|*.m2ts) echo Videos ;;
    *.mp3|*.flac|*.wav|*.m4a|*.aac|*.ogg|*.opus|*.wma|*.aiff|*.alac) echo Music ;;
    *.pdf|*.doc|*.docx|*.ppt|*.pptx|*.xls|*.xlsx|*.odt|*.ods|*.odp|*.md|*.txt|*.rtf|*.epub|*.mobi|*.csv) echo Documents ;;
    *.iso|*.img|*.zip|*.7z|*.rar|*.tar|*.gz|*.xz|*.zst|*.bz2|*.exe|*.msi|*.deb|*.rpm|*.appimage|*.apk|*.dmg) echo Downloads ;;
    *) echo "To Be Organized" ;;
  esac
}

classify_dir() {
  case "${1,,}" in
    *anime*|*silo*|*series*|*season*|*movie*|*film*|*episode*) echo Videos ;;
    *game*|*games*) echo Downloads ;;
    *music*|*song*|*audio*|*album*) echo Music ;;
    *picture*|*photo*|*image*|*wallpaper*|*artwork*) echo Pictures ;;
    *document*|*project*|*code*|*notes*|*paper*|*school*|*academic*|*work*|*career*) echo Documents ;;
    *download*|*setup*|*installer*) echo Downloads ;;
    *) echo "" ;;
  esac
}

if [ "$APPLY" -eq 1 ]; then
  echo "===============================================" >>"$LOG"
  echo "ORGANIZE RUN $(date)" >>"$LOG"
else
  echo "DRY RUN — pass --apply to move files"
fi

for c in "${CATS[@]}" "${EXTRAS[@]}"; do
  [ "$APPLY" -eq 1 ] && mkdir -p "$c"
  echo "target: $c"
done

shopt -s nullglob dotglob
for item in *; do
  case "$item" in
    "\$RECYCLE.BIN"|"System Volume Information"|.Trash-*|"To Be Organized"|"To Be Deleted") continue ;;
    Pictures|Downloads|Documents|Desktop|Videos|Music) continue ;;
  esac

  if [ -f "$item" ]; then
    cat="$(classify_file "$item")"
    move_dup_in "$item" "$cat" "$cat"
    continue
  fi

  [ -d "$item" ] || continue
  cat="$(classify_dir "$item")"
  if [ -n "$cat" ]; then
    do_mv "$item" "$cat"
  else
    do_mv "$item" "To Be Organized"
  fi
done

# park empty leftovers
if [ "$APPLY" -eq 1 ]; then
  mkdir -p "To Be Deleted/empty dirs"
  find . -mindepth 1 -maxdepth 1 -type d -empty \
    ! -name '$RECYCLE.BIN' ! -name 'System Volume Information' \
    ! -name Pictures ! -name Downloads ! -name Documents ! -name Desktop \
    ! -name Videos ! -name Music ! -name 'To Be Organized' ! -name 'To Be Deleted' \
    -exec mv -n {} "To Be Deleted/empty dirs/" \; 2>/dev/null
  echo "===============================================" >>"$LOG"
fi
echo "Done. Report: $LOG"
