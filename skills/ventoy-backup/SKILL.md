---
name: ventoy-backup
description: Use when backing up, migrating, or preparing to reinstall an Arch/EndeavourOS (or any pacman) machine to a Ventoy/exFAT USB — captures home files, dotfiles, configs, Firefox profiles/history/bookmarks/logins, pacman + AUR + npm/cargo/go/flatpak/snap/pipx package lists, /etc, /opt, and project manifests, then verifies and restores them. Trigger words: backup, back up, Ventoy, reinstall, migrate, snapshot, Firefox history, pacman apps.
---

# Ventoy comprehensive backup

Purpose: keep everything a reinstall + package manager **cannot** give back.
Skip only regenerable trees, but record their package manifests so they can be
rebuilt. Never delete the source, and never delete an old backup until a new
one verifies.

## Safety rules

- Run the backup as **root** (`sudo`), but always target the real user's home
  (`SUDO_USER`), not `/root`.
- **Close Firefox** before the run. `places.sqlite` (history + bookmarks) and
  the other SQLite DBs must be consistent.
- The USB is **exFAT**: no Unix ownership/symlinks. Everything is a
  `.tar.zst`; restore as root and `chown -R` afterwards.
- The backup is **unencrypted**. `~/important.txt`, `~/.gnupg`, `~/.ssh`,
  `~/.config/gh`, and `~/.claude.json` may contain secrets. Encrypt the drive
  or those files (e.g. `age`/`gpg`) if the USB can be lost.
- Do not overwrite `/etc` on restore — extract to `/tmp` and diff.
- **Do not delete the old backup folder until `verify-backup.sh` passes on a
  new one.**

## What gets captured

| Area | Contents |
| --- | --- |
| Home | everything except `.cache`, `node_modules`, Python envs, `.npm`, Trash, and (separately archived) `Games`, `games`, `Music` |
| Dotfiles/configs | shells, hypr/waybar/kitty/rofi/kate/VS Code, KDE shortcuts, GTK, wallust, mpv, cava |
| Firefox | **all** profiles: `places.sqlite` (history+bookmarks), `sessionstore-backups/` (tabs), `prefs.js`, `xulstore.json`, `logins.json`+`key4.db`, `cookies.sqlite`, extensions |
| Packages | `pacman -Qqe/-Qq/-Qqm/-Qe/-Qm/-Qdtq`, repo list, mirrorlist, orphans, systemd services (system+user), flatpak, snap, pipx, npm/cargo/bun/go globals, yay/paru cache |
| System | os-release, hostnamectl, fstab, crypttab, kernel cmdline, lsblk, btrfs subvolumes, boot entry, users/groups, sudoers, network profiles, locale/time, printers, bluetooth, mounts, modified package configs |
| /opt, /etc | full archives (`/etc` is reference-only) |
| Devtools | config copies, toolchains, VS Code extensions, keybinds, formatter/linter binaries |
| Project deps | every `package.json`, `requirements*.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc. + project roots |

## Quick start

```bash
# 1. Mount the Ventoy partition read-write (udisks is fine; no sudo needed)
udisksctl mount -b /dev/sdb1          # adjust device
# it appears at /run/media/$USER/Ventoy

# 2. Close Firefox, then run
sudo /home/carapace/Projects/Opencode-Agents/skills/ventoy-backup/scripts/backup-to-ventoy.sh \
  --dest /run/media/carapace/Ventoy

# 3. Verify
/home/carapace/Projects/Opencode-Agents/skills/ventoy-backup/scripts/verify-backup.sh \
  /run/media/carapace/Ventoy/backup/$(hostname)-Backup-$(date +%F)
```

Options: `--stamp YYYY-MM-DD`, `--inventory-only` (fast dry run of the
inventory), `ZSTD_LEVEL=3 ZSTD_THREADS=0`.

Output layout:

```
<dest>/backup/<HOST>-Backup-<STAMP>/
  00-inventory/{packages,system,home,devtools,project-deps}
  10-home/home-main.tar.zst
  10-home/home-games.tar.zst      (if ~/Games or ~/games exists)
  10-home/home-music.tar.zst      (if ~/Music exists)
  20-opt/opt.tar.zst
  30-etc/etc.tar.zst
  50-firefox/firefox-profiles.tar.zst
  MANIFEST.txt  SHA256SUMS.txt  RESTORE.md  40-logs/
```

## Manual procedure (if the script is unavailable)

```bash
BK=/run/media/$USER/Ventoy/backup/$(hostname)-Backup-$(date +%F)
sudo mkdir -p "$BK"/{00-inventory/{packages,system,home,devtools,project-deps},10-home,20-opt,30-etc,50-firefox,40-logs}

# packages
pacman -Qqe  > "$BK/00-inventory/packages/pacman-explicit.txt"
pacman -Qqm  > "$BK/00-inventory/packages/pacman-foreign-aur.txt"
pacman -Qe   > "$BK/00-inventory/packages/pacman-explicit-versions.txt"
pacman -Qdtq > "$BK/00-inventory/packages/pacman-orphans.txt"
npm ls -g --depth=0 > "$BK/00-inventory/packages/npm-globals.txt"
systemctl list-unit-files --state=enabled --no-pager > "$BK/00-inventory/packages/systemd-services.txt"
systemctl --user list-unit-files --state=enabled --no-pager > "$BK/00-inventory/packages/systemd-user-services.txt"

# home (split so games/music can be handled independently)
sudo tar -C /home \
  --exclude="carapace/Games" --exclude="carapace/games" --exclude="carapace/Music" \
  --exclude="carapace/.cache" --exclude='*/node_modules' --exclude='*/__pycache__' \
  --exclude='*/site-packages' --exclude='*/.venv' --exclude='*/venv' \
  --exclude="carapace/.npm" --exclude="carapace/.local/share/Trash" \
  -cf - carapace | zstd -T0 -3 > "$BK/10-home/home-main.tar.zst"
[ -d /home/carapace/Games ] && sudo tar -C /home -cf - carapace/Games | zstd -T0 -3 > "$BK/10-home/home-games.tar.zst"
[ -d /home/carapace/Music ] && sudo tar -C /home -cf - carapace/Music | zstd -T0 -3 > "$BK/10-home/home-music.tar.zst"

# /opt, /etc, Firefox (ALL profiles)
sudo tar -C / -cf - opt | zstd -T0 -3 > "$BK/20-opt/opt.tar.zst"
sudo tar -C / -cf - etc | zstd -T0 -3 > "$BK/30-etc/etc.tar.zst"
sudo tar -C /home -cf - carapace/.config/mozilla | zstd -T0 -3 > "$BK/50-firefox/firefox-profiles.tar.zst"

# checksums + integrity
( cd "$BK" && find . -maxdepth 2 -name '*.tar.zst' -exec sha256sum {} \; > SHA256SUMS.txt )
for a in "$BK"/10-home/*.tar.zst "$BK"/20-opt/*.tar.zst "$BK"/30-etc/*.tar.zst "$BK"/50-firefox/*.tar.zst; do zstd -tq "$a"; done
```

## Firefox: what to preserve

Profiles live under `~/.config/mozilla/firefox/` (NOT `~/.mozilla`) on this
machine. The important files per profile:

- `places.sqlite` — history + bookmarks
- `bookmarkbackups/*.jsonlz4` — bookmark snapshots
- `sessionstore-backups/` + `sessionstore.jsonlz4` — open tabs/session
- `prefs.js` — settings
- `xulstore.json` — pinned tabs/toolbar layout
- `logins.json` + `key4.db` — saved logins (key4.db is the encryption key)
- `cookies.sqlite` — cookies/logins
- `extensions/` — add-ons (e.g. `wallsflow@wallsflow.com.xpi`)

Close Firefox first. If you must back up while it runs, use
`sqlite3 <db> ".backup '<out>'"` for each SQLite file instead of a raw copy.

## Restore (short version)

```bash
cd <BK>
sha256sum -c SHA256SUMS.txt
zstd -t 10-home/*.tar.zst 20-opt/*.tar.zst 30-etc/*.tar.zst 50-firefox/*.tar.zst

# packages (names only)
sudo pacman -Syyu
yay -S --needed $(cat 00-inventory/packages/pacman-explicit.txt 00-inventory/packages/pacman-foreign-aur.txt)

# home
sudo tar -C /home --zstd -xpf 10-home/home-main.tar.zst
sudo chown -R carapace:carapace /home/carapace

# /opt, /etc (diff, do not overwrite)
sudo tar -C / --zstd -xpf 20-opt/opt.tar.zst
sudo mkdir -p /tmp/etc-ref && sudo tar -C /tmp/etc-ref --zstd -xpf 30-etc/etc.tar.zst
diff -r /tmp/etc-ref/etc /etc

# Firefox (closed)
sudo tar -C /home --zstd -xpf 50-firefox/firefox-profiles.tar.zst
sudo chown -R carapace:carapace /home/carapace/.config/mozilla
```

Full generated restore guide: `<BK>/RESTORE.md`.

## Reference: the original 2026-10-12 Nexus backup

- Host `Nexus`, EndeavourOS rolling, user `carapace`, btrfs `@/@home`.
- `10-home/home-no-games-music.tar.zst` 21.6G, `home-games-music.tar.zst` 4.06G,
  `20-opt/opt.tar.zst` 301M, `30-etc/etc.tar.zst` 2.9M,
  `50-firefox/firefox-profiles.tar.zst` 1.14G, inventory 111M.
- 295 explicit pacman packages, 17 AUR/foreign, 13 orphans.
- Firefox profiles: `ni922hgt.default-release` (active), `qokZjYL2.Profile 1`,
  `1v9b2kvs.default`.
- Excluded by design: `.cache` (13G), `node_modules`, Python envs, `.npm`,
  Trash; `~/Music` and `~/games` were deleted by the user before that backup.

If that old backup folder is about to be deleted: run this skill's script
first, verify with `verify-backup.sh`, and only then remove the old folder.
