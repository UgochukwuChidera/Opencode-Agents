---
name: wine-game-setup
description: Use when setting up an unpackaged Windows game on Linux using Wine. Covers Wine prefix isolation, winetricks dependency installation, DXVK for DirectX-to-Vulkan translation, launcher script creation, .desktop entry integration, and troubleshooting common game-specific issues.
---

# Wine Game Setup

## Prerequisites

Before starting, verify these are available:

```bash
# Check Wine is installed
wine --version

# Check winetricks is available
winetricks --version

# Check the game directory exists
ls -la "/path/to/game/directory"

# Optional but recommended: check Vulkan support (for DXVK)
vulkaninfo --summary 2>/dev/null | grep "Vulkan Instance"
```

**Minimum requirements:**
- Wine 8.0+ (9.0+ recommended for modern games)
- winetricks (any recent version)
- A Vulkan-capable GPU and driver (for DXVK; not strictly required but strongly recommended)

---

## Step-by-Step Process

### 1. Check Wine Version

```bash
wine --version
```

If Wine is not installed, install it:

| Distro | Command |
|--------|---------|
| Debian/Ubuntu | `sudo apt install wine wine32 wine64` |
| Fedora | `sudo dnf install wine` |
| Arch | `sudo pacman -S wine wine-gecko wine-mono` |
| openSUSE | `sudo zypper install wine` |

For the best experience on modern games, install **Wine-Staging** or use **Wine-GE-Custom** (GloriousEggroll) builds.

### 2. Create an Isolated Wine Prefix

Each game gets its own prefix under `~/.local/share/wineprefixes/`. Never use the default `~/.wine`.

```bash
export WINEPREFIX="$HOME/.local/share/wineprefixes/game-name"
export WINEARCH="win64"

# Create the prefix directory and initialize it
mkdir -p "$WINEPREFIX"
wineboot -u
```

**Key rules:**
- `WINEARCH=win64` for modern (64-bit) games
- `WINEARCH=win32` only for legacy 32-bit games that refuse to run in 64-bit mode
- Setting `WINEARCH` on an existing prefix is **not possible** — must be set on creation
- The `wineboot -u` step initializes the prefix (creates `drive_c`, registry, etc.)

### 3. Install Core Dependencies via Winetricks

```bash
# Essential: Visual C++ runtimes (most games need these)
winetricks vcrun2022

# Fallback for older games that haven't updated their VC++ dependency
winetricks vcrun2019

# Core fonts (fixes missing text, boxes instead of characters)
winetricks corefonts
```

**Tailor to the game:**
- **Older DirectX 9 games**: `winetricks d3dx9`
- **Games using XAudio**: `winetricks xact` or `winetricks xact_x64`
- **Games needing DirectPlay**: `winetricks directplay`
- **Games with .NET dependency**: `winetricks dotnet48` or `dotnet6` (only if needed — large downloads)
- **Games with PhysX**: `winetricks physx`
- **Games with XNA**: `winetricks xna40`

**Do NOT install what you don't need** — every unnecessary component bloats the prefix and can cause conflicts.

### 4. Install DXVK for Performance

DXVK translates DirectX 9/10/11 calls to Vulkan, giving massive performance improvements over Wine's built-in wined3d.

```bash
# Install the latest stable DXVK
winetricks dxvk
```

**What DXVK does:**
- DirectX 9, 10, 11 → Vulkan translation
- Near-native performance in many games
- Better shader compilation (compatible with vkd3d-proton for DirectX 12)

**If Vulkan is not available**, skip DXVK and Wine will fall back to its built-in `wined3d` (software-rendered DirectX). Performance will be significantly worse.

**DXVK versions:** The version bundled with `winetricks dxvk` is the latest stable release. For bleeding-edge builds, see [github.com/doitsujin/dxvk/releases](https://github.com/doitsujin/dxvk/releases) and install manually by copying `d3d9.dll`, `d3d10.dll`, `d3d10_1.dll`, `d3d10core.dll`, and `d3d11.dll` to the game's directory.

### 5. Create a Launcher Script

Create a dedicated launcher script for the game so you never need to re-type the environment variables.

```bash
#!/bin/bash
# Launcher for Game Name

export WINEPREFIX="$HOME/.local/share/wineprefixes/game-name"
export WINEARCH="win64"

# Change to the game directory (some games need this for relative paths)
cd "/path/to/game/directory" || exit 1

# Run the game executable
wine "GameExecutable.exe" "$@"
```

Save it as `~/games/game-name-launcher.sh` and make it executable:

```bash
chmod +x ~/games/game-name-launcher.sh
```

**Game-specific flags:**
- Some games need `-dx11` or `-dx12` command-line flags
- Some need fullscreen flags: `-fullscreen -w 1920 -h 1080`
- Check the game's WineDB page or launch options

 ### 6. Create a .desktop Entry

For app launcher integration (GNOME, KDE, etc.):

> **Important:** If the path contains spaces, use the `\s` escape sequence (per the freedesktop.org spec). Backslash-space (`\ `) or double quotes may not be handled correctly by all desktop environments.

```ini
[Desktop Entry]
Name=Game Name
Comment=Play Game Name on Linux
Exec=/home/username/games/game-name-launcher.sh
Icon=game-name-icon
Terminal=false
Type=Application
Categories=Game;
StartupNotify=true
```

Place it at `~/.local/share/applications/game-name.desktop`:

```bash
mkdir -p ~/.local/share/applications
cp game-name.desktop ~/.local/share/applications/
update-desktop-database ~/.local/share/applications/
```

### 7. Extract Game Icon

If the game's `.exe` contains an embedded icon, extract it:

```bash
# Using wrestool (part of icoutils)
wrestool -x -t 14 "GameExecutable.exe" > game-name-icon.ico

# Convert to PNG (using ImageMagick)
convert game-name-icon.ico game-name-icon.png

# Alternative: find a PNG in the game directory
find /path/to/game -name "*.png" -o -name "*.ico" 2>/dev/null
```

If none are available, use a generic game icon or skip — the `.desktop` entry still works without one.

### 8. Test Run

Verify the game starts correctly:

```bash
# Use a 10-second timeout — if the game window appears, it's working
timeout 10 ./game-name-launcher.sh 2>&1 | tail -20
```

**What to check:**
- Does a window appear?
- Are there missing DLL errors in the output?
- Does the game crash immediately?
- Are fonts rendering correctly?

### 9. Shut Down the Wine Server

When done testing, kill the Wine server to release resources:

```bash
wineserver -k
```

This is important because a leftover `wineserver` process holds onto the prefix and can consume memory.

---

## Edge Cases & What to Watch For

### Cracked / Repacked Games (CODEX, FitGirl, etc.)

- These come **pre-configured** with their own steam emulator DLLs (e.g., `steam_api64.dll`, `CODEX.dll`, `cream_api.ini`)
- **Do not modify or replace these DLLs** — they are part of the crack
- Simply run the main game executable via Wine
- The steam emulator handles DRM bypass automatically
- If the executable is a `setup.exe` repack, run that first to extract, then launch the game

### Games with Separate Installers

Some games ship as an `setup.exe` installer:

```bash
# Step 1: Run the installer in the Wine prefix
export WINEPREFIX="$HOME/.local/share/wineprefixes/game-name"
export WINEARCH="win64"
wine setup.exe

# Step 2: Find where it installed (usually in drive_c/Program Files/)
ls "$WINEPREFIX/drive_c/Program Files/GamePublisher/"

# Step 3: Launch the installed executable
wine "$WINEPREFIX/drive_c/Program Files/GamePublisher/GameExecutable.exe"
```

### Steam Games

- **Do not use this process for Steam games**
- Use Steam's built-in **Proton** (which is Wine + DXVK + additional patches)
- Right-click the game in Steam → Properties → Compatibility → Force the use of a specific Steam Play compatibility tool → Select Proton version
- If the game isn't on Steam, this skill applies normally

### 32-bit vs 64-bit

| Game type | WINEARCH | Notes |
|-----------|----------|-------|
| Modern 64-bit game | `win64` | Most games from ~2015+ |
| Legacy 32-bit game | `win32` | Only if it refuses to run in win64 |
| 32-bit game in win64 prefix | `win64` | Usually works fine — Wine handles WoW64 |

**Detection:** Check the game directory — if there's a `GameExecutable_x64.exe` or similar, it's likely 64-bit. Use `file GameExecutable.exe` to check the binary type.

### Prefix Isolation Rules

| Do | Don't |
|----|-------|
| Create a new prefix per game | Share a prefix between multiple games |
| Use descriptive names (`witcher3`, `fm2023`) | Use generic names (`game1`, `prefix1`) |
| Store under `~/.local/share/wineprefixes/` | Store in the game directory itself |
| Set WINEPREFIX explicitly on every run | Rely on the default `~/.wine` |

### Common Dependencies at a Glance

```
vcrun2022   → Modern C++ runtime (most Unity/Unreal games)
vcrun2019   → Older C++ runtime (fallback)
corefonts   → Fixes missing/corrupted text
dxvk        → DirectX 9/10/11 → Vulkan (essential for performance)
d3dx9       → DirectX 9 runtime (older games)
xact/xact_x64 → XAudio audio engine
directplay  → Legacy networking API (very old games)
dotnet48    → .NET Framework (only if needed — huge download)
physx       → PhysX physics engine
```

### Vulkan / DXVK Fallback

If Vulkan is not available (no GPU driver, VM, etc.):

```bash
# Uninstall DXVK (fall back to Wine's built-in wined3d)
rm -f "$WINEPREFIX/drive_c/windows/system32/d3d9.dll"
rm -f "$WINEPREFIX/drive_c/windows/system32/d3d10*.dll"
rm -f "$WINEPREFIX/drive_c/windows/system32/d3d11.dll"
rm -f "$WINEPREFIX/drive_c/windows/system32/dxgi.dll"
# Also remove from syswow64 for 32-bit games
```

Performance will be poor (wined3d is software-emulated). Consider using **Gallium Nine** (Direct 9 over Mesa) if you have an AMD GPU and open-source drivers.

### DXVK Version Selection

- `winetricks dxvk` installs the **latest stable** version — this is correct for almost all games
- Bleeding-edge versions can fix issues in recently released titles but may introduce regressions
- For experimental builds: [github.com/doitsujin/dxvk/releases/tag/ci](https://github.com/doitsujin/dxvk/releases/tag/ci)
- DXVK 2.x+ supports DirectX 8/9/10/11; older DXVK 1.x only supports 10/11

---

## What NOT to Do

| ❌ Mistake | ✅ Correct |
|-----------|-----------|
| Share prefixes between games | One prefix per game |
| Install every dependency "just in case" | Only install what the game needs |
| Force `WINEARCH=win32` for modern games | Use `win64` unless the game is 32-bit only |
| Use `sudo wine ...` | Wine runs as the current user — `sudo` breaks permissions |
| Run the exe from `~/.wine` | Always use a custom `WINEPREFIX` per game |
| Install wine-gecko/mono unless needed | Only install if the game requires web rendering or .NET |
| Expect every game to work perfectly | Check WineDB first — some games just don't work |
| Delete the game directory before removing the prefix | Clean up the prefix first with `wineserver -k` |
| Set `WINEPREFIX` globally in `~/.bashrc` | Set it per-launcher-script so each game uses its own |

### WineDB: Always Check First

Before spending time on setup, check the game on **Wine Application Database**:
- https://appdb.winehq.org/
- Search for the game title
- Check the **rating** (Platinum/Gold/Silver/Bronze/Garbage)
- Read the **test results** for specific distro/Wine version combinations
- Note any **special instructions** in the comments

**Rating guide:**
| Rating | Meaning |
|--------|---------|
| Platinum | Works perfectly out of the box |
| Gold | Works with minor tweaks |
| Silver | Works but has significant issues |
| Bronze | Works but is very buggy |
| Garbage | Does not work |

---

## Troubleshooting

### Missing DLL Errors

```
0034:err:module:import_dll Loading library XINPUT1_3.dll (which is needed by...)
0034:err:module:import_dll Loading library D3DX9_43.dll (which is needed by...)
```

**Fix:** Install the corresponding winetricks package:

| Missing DLL | Fix |
|-------------|-----|
| `XINPUT1_3.dll` / `X3DAudio1_7.dll` / `XAPOFX1_5.dll` | `winetricks xact` or `winetricks xact_x64` |
| `D3DX9_*.dll` / `D3DX10_*.dll` | `winetricks d3dx9` |
| `D3DX11_*.dll` | `winetricks dxvk` (also covers D3D11) |
| `MSVCP140.dll` / `VCRUNTIME140.dll` | `winetricks vcrun2022` |
| `DPLAYX.dll` / `DPNET.dll` | `winetricks directplay` |
| `MFPlat.dll` / `MF.dll` / `MFReadWrite.dll` | `winetricks mf` (media foundation — tricky) |
| `FAudio.dll` | `winetricks faudio` |

### Using Winetricks GUI

For interactive exploration of what's available:

```bash
export WINEPREFIX="$HOME/.local/share/wineprefixes/game-name"
export WINEARCH="win64"
winetricks --gui
```

This opens a graphical interface where you can:
- Select/deselect components to install
- See descriptions of what each package provides
- Browse by category (dlls, fonts, games, etc.)

### Game Hangs or Crashes at Launch

1. **Check Wine output** — run from terminal and look for error messages
2. **Try different renderer** — some games need `wine Game.exe -windowed` or `-opengl`
3. **Disable DXVK temporarily** — to test if DXVK is the problem:
   ```bash
   export WINEDLLOVERRIDES="d3d9,d3d10,d3d11,dxgi=n,b"
   ```
4. **Check CPU core count** — some older games crash with more than 4 cores:
   ```bash
   export WINEDEBUG=-all
   export STAGING_AUDIO_PERIOD=100
   ```
5. **Try Wine-Staging** — has additional patches that can fix game-specific issues

### Audio Problems

- Crackling audio → `winetricks faudio`
- No audio → check if `pulseaudio` or `pipewire` is running; try `winetricks xact`
- Audio desync → set `STAGING_AUDIO_PERIOD=100` or higher

### Fullscreen Issues

- Game launches in windowed mode → try `wine Game.exe -fullscreen`
- Game doesn't capture mouse → press `Alt+Enter` to toggle fullscreen
- Black screen but audio works → try `wine Game.exe -dx11` or remove DXVK
- Screen resolution wrong → set a virtual desktop:
  ```bash
  winetricks settings=vd=1920x1080
  ```

### Fonts / Text Rendering

- Boxes instead of text → `winetricks corefonts`
- Chinese/Japanese characters missing → `winetricks cjkfonts`
- Tiny or unreadable text → set DPI:
  ```bash
  winetricks settings=dpi=144
  ```

### Checking Logs

```bash
# Increase Wine debug output
export WINEDEBUG=+loaddll,+seh,+tid
wine Game.exe 2>&1 | tee wine-debug.log

# View only errors
grep -i "err:" wine-debug.log

# Check for specific DLL issues
grep -i "import_dll\|module:" wine-debug.log
```

### Prefix Corrupted or Misconfigured

If a prefix becomes unusable (wrong architecture, broken registry, etc.):

```bash
# Kill wineserver
wineserver -k

# Delete the broken prefix
rm -rf "$HOME/.local/share/wineprefixes/broken-game"

# Start fresh
mkdir -p "$HOME/.local/share/wineprefixes/broken-game"
export WINEPREFIX="$HOME/.local/share/wineprefixes/broken-game"
export WINEARCH="win64"
wineboot -u
```

It is faster and safer to delete and recreate a prefix than to try to fix a broken one.

---

## Quick Reference — Full Setup Script

```bash
#!/bin/bash
# ============================================================
# Full Wine game setup — run once after extracting the game
# ============================================================
set -euo pipefail

GAME_NAME="Game Name"
GAME_DIR="/path/to/game/directory"
GAME_EXE="GameExecutable.exe"
PREFIX_DIR="$HOME/.local/share/wineprefixes/$(echo "$GAME_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

echo "=== Setting up $GAME_NAME ==="

# 1. Create prefix
export WINEPREFIX="$PREFIX_DIR"
export WINEARCH="win64"
mkdir -p "$WINEPREFIX"
wineboot -u

echo "=== Installing VC++ 2022 ==="
winetricks -q vcrun2022

echo "=== Installing core fonts ==="
winetricks -q corefonts

echo "=== Installing DXVK ==="
winetricks -q dxvk

# 2. Create launcher
LAUNCHER="$HOME/games/$(echo "$GAME_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')-launcher.sh"
mkdir -p "$HOME/games"

cat > "$LAUNCHER" << LAUNCHER_EOF
#!/bin/bash
export WINEPREFIX="$PREFIX_DIR"
export WINEARCH="$WINEARCH"
cd "$GAME_DIR" || exit 1
wine "$GAME_EXE" "\$@"
LAUNCHER_EOF
chmod +x "$LAUNCHER"

echo "=== Done ==="
echo "Run: $LAUNCHER"
```

---

## Architecture Summary

```
Game data: /path/to/game/directory/
  ├── GameExecutable.exe        ← The game binary
  ├── steam_api64.dll           ← Steam emulator (if cracked)
  └── ... other game files

Wine prefix: ~/.local/share/wineprefixes/game-name/
  ├── drive_c/                  ← C: drive (contains installed components)
  ├── dosdevices/               ← Drive mappings
  └── user.reg                  ← Registry (per-user)

Launcher: ~/games/game-name-launcher.sh
Desktop:  ~/.local/share/applications/game-name.desktop
Icon:     ~/games/game-name-icon.png
```
