#!/usr/bin/env bash
#
# backup-to-ventoy.sh — comprehensive pre-reinstall backup for Arch/EndeavourOS
# to a mounted Ventoy/exFAT USB.
#
# Captures what a reinstall + package manager cannot give back:
#   home files, dotfiles, configs/keybinds, own code, game saves, browser
#   profiles (history/bookmarks/tabs/logins/cookies/extensions), wallpapers,
#   /opt, /etc, and full package inventories (pacman, AUR, npm, cargo, go,
#   flatpak, snap, pipx, systemd services).
#
# Skips only regenerable trees (.cache, node_modules, Python envs, Trash, .npm)
# but records their package manifests so they can be rebuilt.
#
# Usage:
#   sudo ./backup-to-ventoy.sh [--dest DIR] [--stamp YYYY-MM-DD] [--inventory-only]
#
# Default dest: /run/media/$SUDO_USER/Ventoy   (auto-detected Ventoy mount)
# Output:      <dest>/backup/<HOST>-Backup-<STAMP>/
#
set -uo pipefail

TARGET_USER="${SUDO_USER:-$(id -un)}"
SRC_HOME="${SRC_HOME:-/home/${TARGET_USER}}"
HOST="$(hostnamectl --static 2>/dev/null || hostname)"
STAMP="$(date +%Y-%m-%d)"
DEST=""
INVENTORY_ONLY=0
ZSTD_LEVEL="${ZSTD_LEVEL:-3}"
ZSTD_THREADS="${ZSTD_THREADS:-0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --stamp) STAMP="$2"; shift 2 ;;
    --inventory-only) INVENTORY_ONLY=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$DEST" ]; then
  for d in "/run/media/${TARGET_USER}/Ventoy" "/run/media/${TARGET_USER}/"*/ "/mnt/ventoy" "/mnt/ventoy-check"; do
    [ -d "$d" ] && DEST="$d" && break
  done
fi

[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo $0" >&2; exit 1; }
[ -n "$DEST" ] && [ -d "$DEST" ] || { echo "Destination not found. Use --dest /path/to/Ventoy" >&2; exit 1; }
[ -d "$SRC_HOME" ] || { echo "Home not found: $SRC_HOME" >&2; exit 1; }

BK="${DEST%/}/backup/${HOST}-Backup-${STAMP}"
mkdir -p "${BK}"/{00-inventory/{packages,system,home,devtools,project-deps},10-home,20-opt,30-etc,40-logs,50-firefox}
LOG="${BK}/40-logs/backup-$(date +%Y%m%d-%H%M%S).log"
: >"$LOG"

note() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }
as_user() {
  if [ "$(id -un)" = "$TARGET_USER" ]; then
    "$@"
  else
    sudo -u "$TARGET_USER" env HOME="$SRC_HOME" XDG_RUNTIME_DIR="/run/user/$(id -u "$TARGET_USER")" "$@"
  fi
}

note "Host: $HOST | user: $TARGET_USER | home: $SRC_HOME"
note "Backup dir: $BK"
note "Log: $LOG"

pgrep -x firefox >/dev/null 2>&1 && \
  note "WARNING: Firefox is running. CLOSE IT and re-run for a consistent places.sqlite/history."

# ---------------------------------------------------------------- 00-inventory
note "Collecting package inventory"
P="${BK}/00-inventory/packages"
pacman -Qqe  >"$P/pacman-explicit.txt" 2>&1 || true
pacman -Qq   >"$P/pacman-all.txt" 2>&1 || true
pacman -Qe   >"$P/pacman-explicit-versions.txt" 2>&1 || true
pacman -Q    >"$P/pacman-all-versions.txt" 2>&1 || true
pacman -Qqm  >"$P/pacman-foreign-aur.txt" 2>&1 || true
pacman -Qm   >"$P/pacman-foreign-versions.txt" 2>&1 || true
pacman -Qdtq >"$P/pacman-orphans.txt" 2>&1 || true
pacman-conf --repo-list >"$P/pacman-repo-list.txt" 2>&1 || true
cat /etc/pacman.d/mirrorlist >"$P/pacman-mirrorlist.txt" 2>&1 || true
as_user npm ls -g --depth=0 >"$P/npm-globals.txt" 2>&1 || true
as_user bun pm ls -g >"$P/bun-globals.txt" 2>&1 || true
{ echo "=== ~/.cargo/bin ==="; ls -la "$SRC_HOME/.cargo/bin" 2>&1; echo; echo "=== cargo install --list ==="; as_user cargo install --list 2>&1; } >"$P/cargo-installs.txt"
{ echo "=== ~/go/bin ==="; ls -la "$SRC_HOME/go/bin" 2>&1; } >"$P/go-tools.txt"
{ echo "=== /opt ==="; ls -la /opt 2>&1; echo; du -sh /opt/* 2>&1; } >"$P/opt-contents.txt"
{ echo "=== /usr/local/bin ==="; ls -la /usr/local/bin 2>&1; echo; echo "=== /usr/local/sbin ==="; ls -la /usr/local/sbin 2>&1; } >"$P/usr-local-bin.txt"
systemctl list-unit-files --state=enabled --no-pager >"$P/systemd-services.txt" 2>&1 || true
as_user systemctl --user list-unit-files --state=enabled --no-pager >"$P/systemd-user-services.txt" 2>&1 || true
flatpak list --app --columns=application,version,origin >"$P/flatpak.txt" 2>&1 || true
snap list >"$P/snap.txt" 2>&1 || true
as_user pipx list >"$P/python-pipx.txt" 2>&1 || true
{ echo "=== yay cache ==="; ls "$SRC_HOME/.cache/yay" 2>&1; echo; echo "=== paru cache ==="; ls "$SRC_HOME/.cache/paru/clone" 2>&1; } >"$P/yay-paru-cache.txt"
find "$SRC_HOME/.local/share/applications" /usr/share/applications -maxdepth 1 -name '*.desktop' 2>/dev/null | sort >"$P/installed-desktop-files.txt"
{
  echo "=== Package Inventory Summary ==="
  echo "Date: $STAMP"; echo "Host: $HOST ($(uname -r))"
  echo; echo "Explicit (pacman -Qqe): $(wc -l <"$P/pacman-explicit.txt")"
  echo "All (pacman -Qq): $(wc -l <"$P/pacman-all.txt")"
  echo "Foreign/AUR (pacman -Qqm): $(wc -l <"$P/pacman-foreign-aur.txt")"
  echo "Orphans (pacman -Qdtq): $(wc -l <"$P/pacman-orphans.txt")"
  echo; echo "=== Foreign/AUR ==="; cat "$P/pacman-foreign-aur.txt"
} >"$P/SUMMARY.txt"

note "Collecting system inventory"
S="${BK}/00-inventory/system"
cat /etc/os-release >"$S/os-release.txt" 2>&1 || true
hostnamectl >"$S/hostnamectl.txt" 2>&1 || true
cat /etc/fstab >"$S/fstab.txt" 2>&1 || true
cat /etc/crypttab >"$S/crypttab.txt" 2>&1 || true
{ echo "=== /proc/cmdline ==="; cat /proc/cmdline; echo; echo "=== /etc/kernel/cmdline ==="; cat /etc/kernel/cmdline 2>&1; } >"$S/kernel-cmdline.txt"
lsblk -o NAME,SIZE,FSTYPE,LABEL,UUID,MOUNTPOINTS >"$S/lsblk.txt" 2>&1 || true
btrfs subvolume list / >"$S/btrfs-subvolumes.txt" 2>&1 || true
{ echo "=== efibootmgr ==="; efibootmgr -v 2>&1; echo; echo "=== ESP tree ==="; find /boot/efi -maxdepth 3 2>&1; } >"$S/boot-entry.txt"
{ echo "=== passwd ==="; getent passwd; echo; echo "=== group ==="; getent group; } >"$S/users-groups.txt"
{ echo "=== /etc/sudoers ==="; cat /etc/sudoers 2>&1; echo; echo "=== /etc/sudoers.d ==="; ls -la /etc/sudoers.d 2>&1; cat /etc/sudoers.d/* 2>&1; } >"$S/sudoers.txt"
systemctl list-unit-files --state=enabled --no-pager >"$S/systemd-enabled.txt" 2>&1 || true
systemctl list-unit-files --state=masked --no-pager >"$S/systemd-masked.txt" 2>&1 || true
{ echo "=== nmcli connections ==="; nmcli -t -f NAME,TYPE,DEVICE connection show 2>&1; echo; echo "=== system-connections ==="; ls -la /etc/NetworkManager/system-connections 2>&1; } >"$S/network-connections.txt"
{ echo "=== locale ==="; locale 2>&1; echo; echo "=== timedatectl ==="; timedatectl 2>&1; echo; echo "=== localectl ==="; localectl 2>&1; } >"$S/locale-time.txt"
ls -la /etc/keyd >"$S/keyd-etc-list.txt" 2>&1 || true
lpstat -p -d >"$S/printers.txt" 2>&1 || true
{ echo "=== bluetoothctl ==="; bluetoothctl list 2>&1; bluetoothctl devices 2>&1; echo; echo "=== /var/lib/bluetooth ==="; ls -la /var/lib/bluetooth 2>&1; } >"$S/bluetooth.txt"
findmnt -R / >"$S/mounts.txt" 2>&1 || true
pacman -Qii 2>/dev/null | grep -E '^(Name|MODIFIED)' >"$S/installed-configs.txt" || true
{
  echo "=== System Inventory Summary ==="
  echo "Host: $HOST | Date: $STAMP"
  echo "OS: $(grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2- | tr -d '\"')"
  echo "Kernel: $(uname -r)"
  echo "Encryption: $(grep -vE '^\s*#|^\s*$' /etc/crypttab 2>/dev/null | wc -l) active crypttab entries"
  echo "Enabled services: $(grep -c 'enabled' "$S/systemd-enabled.txt" 2>/dev/null || echo 0)"
  echo "See the individual files in this directory."
} >"$S/SUMMARY.txt"

note "Collecting home inventory"
H="${BK}/00-inventory/home"
{ echo "=== top-level sizes ==="; du -sh "$SRC_HOME"/* "$SRC_HOME"/.[!.]* 2>/dev/null | sort -h; } >"$H/top-level-sizes.txt"
find "$SRC_HOME" -xdev -type f -printf '%s\t%p\n' 2>/dev/null | sort -k2 >"$H/all-files.txt"
find "$SRC_HOME" -xdev -maxdepth 1 -name '.*' -printf '%p\n' 2>/dev/null | sort >"$H/dotfiles.txt"
find "$SRC_HOME/Pictures" -xdev -type f -printf '%s\t%p\n' 2>/dev/null | sort -k2 >"$H/wallpapers.txt"
find "$SRC_HOME" -xdev -type f \( -name '*.sh' -o -name '*.bash' -o -name '*.zsh' \) -not -path '*/node_modules/*' -not -path '*/.cache/*' -printf '%p\n' 2>/dev/null | sort >"$H/scripts.txt"
{
  echo "### ls -la ~/.mozilla ###"; ls -la "$SRC_HOME/.mozilla" 2>&1
  echo; echo "### ls -la ~/.config/mozilla ###"; ls -la "$SRC_HOME/.config/mozilla" 2>&1
  echo; echo "### dirs under ~/.config/mozilla (maxdepth 3) ###"; find "$SRC_HOME/.config/mozilla" -maxdepth 3 2>&1
  echo; echo "### profiles ###"; ls -la "$SRC_HOME/.config/mozilla/firefox" 2>&1
  echo; echo "### profile files (history/bookmarks/tabs/logins) ###"
  find "$SRC_HOME/.config/mozilla/firefox" -maxdepth 2 -type f \
    \( -name 'places.sqlite' -o -name 'prefs.js' -o -name 'xulstore.json' \
       -o -name 'logins.json' -o -name 'key4.db' -o -name 'cookies.sqlite' \
       -o -name 'sessionstore*' \) -printf '%s\t%p\n' 2>/dev/null | sort -k2
  echo; echo "### extensions ###"; find "$SRC_HOME/.config/mozilla/firefox" -path '*/extensions/*' -printf '%p\n' 2>/dev/null
} >"$H/firefox-profiles.txt"
find "$SRC_HOME" -xdev -type f -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -200 >"$H/biggest-files.txt"
find "$SRC_HOME" -xdev -type f \( -name '*.zip' -o -name '*.tar' -o -name '*.tar.gz' -o -name '*.tar.zst' -o -name '*.7z' -o -name '*.rar' \) -printf '%s\t%p\n' 2>/dev/null | sort -k2 >"$H/archives.txt"
{ echo "=== ~/Games ==="; ls -la "$SRC_HOME/Games" 2>&1; du -sh "$SRC_HOME/Games" 2>&1; echo; echo "=== ~/games ==="; ls -la "$SRC_HOME/games" 2>&1; du -sh "$SRC_HOME/games" 2>&1; } >"$H/games.txt"
{ echo "=== ~/.local/share/wineprefixes ==="; ls -la "$SRC_HOME/.local/share/wineprefixes" 2>&1; echo; echo "=== ~/.wine ==="; ls -la "$SRC_HOME/.wine" 2>&1; } >"$H/wine-prefixes.txt"
du -sh "$SRC_HOME/.config"/* 2>/dev/null | sort -h >"$H/config-dir-sizes.txt"
{
  echo "=== Home Inventory Summary ==="
  echo "Home: $SRC_HOME | Date: $STAMP"
  echo "Total: $(du -sh "$SRC_HOME" 2>/dev/null | cut -f1)"
  echo "Files: $(wc -l <"$H/all-files.txt")"
  echo
  echo "Biggest top-level dirs:"; head -20 "$H/top-level-sizes.txt"
  echo
  echo "Firefox profiles:"; grep -E '^drwx' "$H/firefox-profiles.txt" | tail -10
  echo
  echo "Sensitive (plaintext secrets may exist):"
  for p in important.txt .gnupg .ssh .config/gh .config/opencode .claude.json .emulator_console_auth_token; do
    [ -e "$SRC_HOME/$p" ] && echo "  $SRC_HOME/$p"
  done
} >"$H/SUMMARY.txt"

note "Collecting devtools inventory"
D="${BK}/00-inventory/devtools"
CONFIG_SRC=(
  "$SRC_HOME/.config/hypr" "$SRC_HOME/.config/waybar" "$SRC_HOME/.config/kitty"
  "$SRC_HOME/.config/rofi" "$SRC_HOME/.config/kate" "$SRC_HOME/.config/Code/User"
  "$SRC_HOME/.config/kdeglobals" "$SRC_HOME/.config/kglobalshortcutsrc"
  "$SRC_HOME/.config/fish" "$SRC_HOME/.config/mpv" "$SRC_HOME/.config/cava"
  "$SRC_HOME/.config/wallust" "$SRC_HOME/.config/gtk-3.0" "$SRC_HOME/.config/gtk-4.0"
  "$SRC_HOME/.config/swaync"
)
for c in "${CONFIG_SRC[@]}"; do
  [ -e "$c" ] || continue
  if [ -d "$c" ]; then
    find "$c" -type f -size -200k -print0 2>/dev/null | while IFS= read -r -d '' f; do
      mkdir -p "${D}/configs$(dirname "$f")"
      cp -p "$f" "${D}/configs$f" 2>/dev/null || true
    done
  else
    mkdir -p "${D}/configs$(dirname "$c")"
    cp -p "$c" "${D}/configs$c" 2>/dev/null || true
  fi
done
{ for b in rustfmt cargo-fmt clippy-driver clang-format clang-tidy black ruff pyright gofmt gopls deno prettier eslint biome dprint shellcheck shfmt stylua; do
    printf '%-16s %s\n' "$b" "$(command -v "$b" 2>/dev/null || echo MISSING)"; done; } >"$D/formatter-linter-binaries.txt"
{ for t in gcc clang rustc cargo node npm deno bun python python3 go java javac cmake lua luajit git; do
    printf '%-10s ' "$t"
    if ! command -v "$t" >/dev/null 2>&1; then echo MISSING; continue; fi
    case "$t" in
      go) go version 2>&1 | head -1 ;;
      lua) lua -v 2>&1 | head -1 ;;
      luajit) luajit -v 2>&1 | head -1 ;;
      *) "$t" --version 2>&1 | head -1 ;;
    esac
  done; } >"$D/toolchains.txt"
as_user rustup component list --installed >"$D/rust-components.txt" 2>&1 || true
as_user code --list-extensions >"$D/vscode-extensions.txt" 2>&1 || true
{ echo "=== settings.json ==="; cat "$SRC_HOME/.config/Code/User/settings.json" 2>&1; echo; echo "=== keybindings.json ==="; cat "$SRC_HOME/.config/Code/User/keybindings.json" 2>&1; } >"$D/vscode-config.txt"
as_user npm ls -g --depth=0 >"$D/node-globals.txt" 2>&1 || true
{ echo "=== editor configs ==="; for f in "$SRC_HOME/.config/kate/katerc" "$SRC_HOME/.config/Code/User/settings.json" "$SRC_HOME/.vimrc" "$SRC_HOME/.config/nvim/init.vim"; do [ -e "$f" ] && echo "$f"; done; } >"$D/editor-configs.txt"
{ echo "=== app config dirs ==="; ls -d "$SRC_HOME/.config"/* 2>/dev/null; } >"$D/app-configs.txt"
{ echo "=== hyprland keybinds ==="; grep -hE '^\s*bind' "$SRC_HOME/.config/hypr"/*.conf "$SRC_HOME/.config/hypr"/*/*.conf 2>/dev/null; echo; echo "=== KDE shortcuts ==="; cat "$SRC_HOME/.config/kglobalshortcutsrc" 2>/dev/null; } >"$D/keybinds.txt"
{
  echo "=== DevTools Summary ==="
  echo "Config files copied: $(find "$D/configs" -type f 2>/dev/null | wc -l)"
  echo "VS Code extensions: $(wc -l <"$D/vscode-extensions.txt" 2>/dev/null || echo 0)"
  echo "Toolchains:"; cat "$D/toolchains.txt"
} >"$D/summary.txt"

note "Recording project dependency manifests"
PR="${BK}/00-inventory/project-deps"
find "$SRC_HOME" -xdev -type f \
  \( -name 'package.json' -o -name 'requirements*.txt' -o -name 'pyproject.toml' \
     -o -name 'Pipfile' -o -name 'poetry.lock' -o -name 'go.mod' -o -name 'Gemfile' \
     -o -name 'Cargo.toml' -o -name 'composer.json' \) \
  -not -path '*/node_modules/*' -not -path '*/.cache/*' -not -path '*/.cargo/registry/*' \
  -not -path '*/go/pkg/mod/*' -not -path '*/site-packages/*' -not -path '*/target/*' \
  -not -path '*/.git/*' -not -path '*/venv/*' -not -path '*/.venv/*' \
  | sort >"$PR/manifest-paths.txt"
: >"$PR/manifest-contents.txt"
while IFS= read -r f; do
  printf '\n===== %s =====\n' "$f" >>"$PR/manifest-contents.txt"
  cat "$f" >>"$PR/manifest-contents.txt" 2>/dev/null
done <"$PR/manifest-paths.txt"
sed 's#/[^/]*$##' "$PR/manifest-paths.txt" | sort -u >"$PR/project-roots.txt"
: >"$PR/project-listing.txt"
while IFS= read -r d; do
  [ -n "$d" ] || continue
  printf '\n===== %s =====\n' "$d" >>"$PR/project-listing.txt"
  ls -la "$d" >>"$PR/project-listing.txt" 2>/dev/null
done <"$PR/project-roots.txt"

# ------------------------------------------------------------------- archives
if [ "$INVENTORY_ONLY" -eq 1 ]; then
  note "Inventory-only mode: skipping archives."
else
  note "Archiving home (excluding Games/games/Music and regenerable trees)"
  EXCLUDES=(
    --exclude="${TARGET_USER}/Games" --exclude="${TARGET_USER}/Games/*"
    --exclude="${TARGET_USER}/games" --exclude="${TARGET_USER}/games/*"
    --exclude="${TARGET_USER}/Music" --exclude="${TARGET_USER}/Music/*"
    --exclude="${TARGET_USER}/.cache" --exclude="${TARGET_USER}/.cache/*"
    --exclude="${TARGET_USER}/.npm" --exclude="${TARGET_USER}/.npm/*"
    --exclude="${TARGET_USER}/.local/share/Trash" --exclude="${TARGET_USER}/.local/share/Trash/*"
    --exclude='*/node_modules' --exclude='*/node_modules/*'
    --exclude='*/__pycache__' --exclude='*.pyc' --exclude='*.pyo'
    --exclude='*/site-packages' --exclude='*/site-packages/*'
    --exclude='*/dist-packages' --exclude='*/dist-packages/*'
    --exclude='*/.venv' --exclude='*/.venv/*' --exclude='*/venv' --exclude='*/venv/*'
    --exclude='*/.tox' --exclude='*/.nox'
    --exclude='*/.mypy_cache' --exclude='*/.pytest_cache' --exclude='*/.ruff_cache' --exclude='*/.pytype'
    --exclude='*.egg-info' --exclude='*.egg-link'
  )
  tar -C /home "${EXCLUDES[@]}" \
    --warning=no-file-changed --warning=no-file-removed --ignore-failed-read \
    -cf - "$TARGET_USER" 2>>"$LOG" | zstd -q -T"$ZSTD_THREADS" -"$ZSTD_LEVEL" >"${BK}/10-home/home-main.tar.zst"
  note "  home-main: $(du -h "${BK}/10-home/home-main.tar.zst" | cut -f1)"

  GAME_MEMBERS=()
  [ -d "$SRC_HOME/Games" ] && GAME_MEMBERS+=("$TARGET_USER/Games")
  [ -d "$SRC_HOME/games" ] && GAME_MEMBERS+=("$TARGET_USER/games")
  if [ ${#GAME_MEMBERS[@]} -gt 0 ]; then
    note "Archiving Games -> 10-home/home-games.tar.zst"
    tar -C /home --warning=no-file-changed --ignore-failed-read -cf - "${GAME_MEMBERS[@]}" 2>>"$LOG" \
      | zstd -q -T"$ZSTD_THREADS" -"$ZSTD_LEVEL" >"${BK}/10-home/home-games.tar.zst"
  fi

  if [ -d "$SRC_HOME/Music" ]; then
    note "Archiving Music -> 10-home/home-music.tar.zst"
    tar -C /home --warning=no-file-changed --ignore-failed-read -cf - "$TARGET_USER/Music" 2>>"$LOG" \
      | zstd -q -T"$ZSTD_THREADS" -"$ZSTD_LEVEL" >"${BK}/10-home/home-music.tar.zst"
  fi

  note "Archiving /opt -> 20-opt/opt.tar.zst"
  tar -C / --warning=no-file-changed --ignore-failed-read -cf - opt 2>>"$LOG" \
    | zstd -q -T"$ZSTD_THREADS" -"$ZSTD_LEVEL" >"${BK}/20-opt/opt.tar.zst"

  note "Archiving /etc -> 30-etc/etc.tar.zst"
  tar -C / --warning=no-file-changed --ignore-failed-read -cf - etc 2>>"$LOG" \
    | zstd -q -T"$ZSTD_THREADS" -"$ZSTD_LEVEL" >"${BK}/30-etc/etc.tar.zst"

  note "Archiving ALL Firefox profiles -> 50-firefox/firefox-profiles.tar.zst"
  FF_SRC=()
  [ -d "$SRC_HOME/.config/mozilla" ] && FF_SRC+=("$TARGET_USER/.config/mozilla")
  [ -d "$SRC_HOME/.mozilla" ] && FF_SRC+=("$TARGET_USER/.mozilla")
  if [ ${#FF_SRC[@]} -gt 0 ]; then
    tar -C /home --warning=no-file-changed --ignore-failed-read -cf - "${FF_SRC[@]}" 2>>"$LOG" \
      | zstd -q -T"$ZSTD_THREADS" -"$ZSTD_LEVEL" >"${BK}/50-firefox/firefox-profiles.tar.zst"
  else
    note "  no Firefox profile dirs found"
  fi
fi

# ------------------------------------------------------- manifest + checksums
note "Writing MANIFEST / SHA256SUMS / RESTORE.md"
{
  echo "${HOST} backup — ${STAMP}"
  echo "Host: ${HOST}  Kernel: $(uname -r)  User: ${TARGET_USER}"
  echo "Created: $(date)"
  echo
  echo "== Archives =="
  find "$BK" -maxdepth 2 -name '*.tar.zst' -printf '%12s  %p\n' | sort -k2
  echo
  echo "== Inventory files =="
  find "$BK/00-inventory" -type f -printf '%10s  %p\n' | sort -k2
} >"$BK/MANIFEST.txt"

if [ "$INVENTORY_ONLY" -eq 0 ]; then
  ( cd "$BK" && find . -maxdepth 2 -name '*.tar.zst' -exec sha256sum {} \; >SHA256SUMS.txt )
fi

cat >"$BK/RESTORE.md" <<EOF
# RESTORE.md — ${HOST} backup (${STAMP})

> Read this whole file before restoring. Do not improvise paths.

## 0. Context
- Source host \`${HOST}\`, user \`${TARGET_USER}\` (uid $(id -u "$TARGET_USER")).
- Target is an exFAT/Ventoy drive: **no Unix ownership or symlinks**. Everything is \`.tar.zst\`.
- Extract as **root**, then \`chown -R ${TARGET_USER}:${TARGET_USER}\`.
- **Close Firefox before restoring/touching profiles** (SQLite consistency).
- \`~/important.txt\` may contain plaintext API keys — protect this backup.

## 1. Layout
\`\`\`
00-inventory/   packages, system, home, devtools, project-deps
10-home/        home-main.tar.zst   (home minus Games/games/Music + regenerables)
                home-games.tar.zst  (only ~/Games and ~/games, if present)
                home-music.tar.zst  (only ~/Music, if present)
20-opt/         opt.tar.zst
30-etc/         etc.tar.zst         (REFERENCE ONLY — diff, do not overwrite)
50-firefox/     firefox-profiles.tar.zst (history/bookmarks/tabs/logins/cookies/extensions)
MANIFEST.txt    sizes + inventory
SHA256SUMS.txt  verify with: sha256sum -c SHA256SUMS.txt
\`\`\`

## 2. Verify first
\`\`\`
cd "$(basename "$BK")"
sha256sum -c SHA256SUMS.txt
zstd -t 10-home/*.tar.zst 20-opt/*.tar.zst 30-etc/*.tar.zst 50-firefox/*.tar.zst
\`\`\`
If anything fails, STOP.

## 3. Restore order
### 3.1 Packages (names only)
\`\`\`
sudo pacman -Syyu
yay -S --needed \$(cat 00-inventory/packages/pacman-explicit.txt 00-inventory/packages/pacman-foreign-aur.txt)
\`\`\`
- Use \`yay\`/\`paru\` so AUR/foreign packages resolve.
- Globals: \`cat 00-inventory/packages/npm-globals.txt\`, \`cargo-installs.txt\`, \`go-tools.txt\`.
- Per-project deps: \`00-inventory/project-deps/\` — install inside each project root, never globally.

### 3.2 Home
\`\`\`
sudo tar -C /home --zstd -xpf 10-home/home-main.tar.zst
sudo chown -R ${TARGET_USER}:${TARGET_USER} /home/${TARGET_USER}
# optional:
sudo tar -C /home --zstd -xpf 10-home/home-games.tar.zst
sudo tar -C /home --zstd -xpf 10-home/home-music.tar.zst
sudo chown -R ${TARGET_USER}:${TARGET_USER} /home/${TARGET_USER}
\`\`\`

### 3.3 /opt and /etc
\`\`\`
sudo tar -C / --zstd -xpf 20-opt/opt.tar.zst
sudo mkdir -p /tmp/etc-ref && sudo tar -C /tmp/etc-ref --zstd -xpf 30-etc/etc.tar.zst
diff -r /tmp/etc-ref/etc /etc   # REVIEW — do not blindly overwrite
\`\`\`

### 3.4 Firefox
\`\`\`
sudo tar -C /home --zstd -xpf 50-firefox/firefox-profiles.tar.zst
sudo chown -R ${TARGET_USER}:${TARGET_USER} /home/${TARGET_USER}/.config/mozilla
\`\`\`
Profiles: \`~/.config/mozilla/firefox/\` (places.sqlite = history+bookmarks,
sessionstore-backups = tabs, logins.json+key4.db = saved logins).

## 4. Not in the archive (regenerate)
\`.cache\`, \`node_modules\`, Python venvs/site-packages, \`.npm\`, Trash.
Package names are in \`00-inventory/packages/\`; project manifests in \`00-inventory/project-deps/\`.

## 5. Gotchas
- [ ] Extracted as root + chowned.
- [ ] Firefox closed.
- [ ] /etc diffed, not overwritten.
- [ ] AUR restored with yay/paru.
- [ ] Sensitive files (\`important.txt\`, \`.gnupg\`, \`.ssh\`) secured.
EOF

# ------------------------------------------------------------------ integrity
if [ "$INVENTORY_ONLY" -eq 0 ]; then
  note "Verifying archive integrity (zstd -t)"
  for a in "$BK"/10-home/*.tar.zst "$BK"/20-opt/*.tar.zst "$BK"/30-etc/*.tar.zst "$BK"/50-firefox/*.tar.zst; do
    [ -e "$a" ] || continue
    if zstd -tq "$a" 2>>"$LOG"; then note "  OK   $a"; else note "  FAIL $a"; fi
  done
fi

note "Backup complete."
echo
echo "Backup location: $BK"
echo "Log: $LOG"
echo "Verify: cd \"$BK\" && sha256sum -c SHA256SUMS.txt"
