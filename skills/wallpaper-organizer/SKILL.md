---
name: wallpaper-organizer
description: Use when organizing, sorting, renaming, or unifying wallpaper image collections. Covers bulk dimension detection, dimension-based renaming with unique identifiers, moving/copying images from multiple subfolders into a single directory, and preserving excluded folders. All operations are move-based (source images are relocated, not copied).
---

# Wallpaper Organizer

## Prerequisites

- ImageMagick (`identify`) for dimension detection
- Python 3 for scripting

## Overview

Unify images from multiple source folders into a single target folder, renamed by their pixel dimensions. Images from excluded folders (e.g. `Specials/`, `Love is War/`) are left completely untouched.

**Naming convention:** `{width}x{height}_{counter:03d}.{ext}` — sorted by ascending pixel area, with a zero-padded counter per unique resolution to guarantee uniqueness.

## Step-by-Step Process

### 1. Scan Folder Structure

List the wallpaper folders:

```bash
ls -la /path/to/Pictures/Wallpapers/
```

Identify which folders to include vs exclude:
- **Include:** numbered wallpaper sets (e.g. `Wallpapers`, `Wallpapers 2`…`Wallpapers 8`), `Extra/`, external folders
- **Exclude:** `Specials/`, `Love is War/`, `Community-wallpapers/`, or any other folder the user wants preserved as-is

### 2. Get Dimensions of All Images

Use Python with ImageMagick's `identify` to read dimensions. Append `[0]` to each file path so multi-frame GIFs only report the first frame's canvas size:

```python
import subprocess, os

files = []  # populate with full paths
results = []
batch_size = 100

for i in range(0, len(files), batch_size):
    batch = files[i:i+batch_size]
    proc = subprocess.run(
        ["identify", "-format", "%w %h %f||%d/%f\n"] + [f + "[0]" for f in batch],
        capture_output=True, text=True, timeout=60
    )
    for line in proc.stdout.strip().split('\n'):
        if '||' in line:
            dims, fpath = line.split('||', 1)
            w, h = dims.split()[:2]
            results.append((fpath.strip(), int(w), int(h)))

# Sort by pixel area (ascending)
results.sort(key=lambda x: x[1] * x[2])
```

### 3. Generate Unique Names

Group by dimensions and assign sequential counters:

```python
from collections import defaultdict
dim_counts = defaultdict(int)

for fp, w, h in sorted_results:
    dim_counts[(w, h)] += 1
    counter = dim_counts[(w, h)]
    ext = os.path.splitext(fp)[1].lower()
    new_name = f"{w}x{h}_{counter:03d}{ext}"
    new_path = os.path.join(target_dir, new_name)
    # queue the move/rename
```

### 4. Move & Rename

```python
import shutil

for src, dst in plan:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(src, dst)
```

### 5. Clean Up Empty Source Folders

```python
for d in source_dirs:
    if os.path.isdir(d):
        try:
            os.rmdir(d)
        except OSError:
            pass  # folder still has files or subdirs
```

## Edge Cases

| Situation | Handling |
|-----------|----------|
| **Multi-frame GIFs** | Use `identify` with `[0]` suffix to get only the first frame's dimensions |
| **Duplicate filenames across folders** | Counter per unique resolution ensures no collisions (e.g. `1920x1080_001.jpg`, `1920x1080_002.jpg`) |
| **Corrupted images** | `identify` will fail — catch stderr and report for manual inspection |
| **Excluded folders** | Never included in the file list at all; left in place with no modifications |
| **Source contains the target dir** | When source = target, perform an in-place rename instead of a move |
| **Empty external folder** | The script gracefully handles zero files |

## Quick Reference — Full Script

```python
import os, subprocess, shutil
from collections import defaultdict

TARGET = "/path/to/Pictures/Wallpapers/Wallpapers"
SOURCE_DIRS = [
    "/path/to/Pictures/Wallpapers/Wallpapers",
    "/path/to/Pictures/Wallpapers/Wallpapers 2",
    # ...
]
EXCLUDE_DIRS = ["Specials", "Love is War"]
EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')

# Collect files
files = []
for d in SOURCE_DIRS:
    if os.path.isdir(d):
        for root, _, filenames in os.walk(d):
            if any(excl in root for excl in EXCLUDE_DIRS):
                continue
            for f in filenames:
                if f.lower().endswith(EXTS):
                    files.append(os.path.join(root, f))

# Get dimensions
results = []
for i in range(0, len(files), 100):
    batch = files[i:i+100]
    proc = subprocess.run(
        ["identify", "-format", "%w %h %f||%d/%f\n"] + [f + "[0]" for f in batch],
        capture_output=True, text=True, timeout=60
    )
    for line in proc.stdout.strip().split('\n'):
        if '||' not in line:
            continue
        dims, fpath = line.split('||', 1)
        w, h = map(int, dims.split()[:2])
        results.append((fpath.strip(), w, h))

results.sort(key=lambda x: x[1] * x[2])

# Rename & move
dim_counts = defaultdict(int)
for fp, w, h in results:
    dim_counts[(w, h)] += 1
    ext = os.path.splitext(fp)[1].lower()
    new_name = f"{w}x{h}_{dim_counts[(w, h)]:03d}{ext}"
    dst = os.path.join(TARGET, new_name)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(fp, dst)

# Cleanup
for d in SOURCE_DIRS:
    if os.path.isdir(d) and d != TARGET:
        try:
            os.rmdir(d)
        except OSError:
            pass
```

## What NOT to Do

| ❌ Mistake | ✅ Correct |
|-----------|-----------|
| Rename in-place without deduplication checks | Use a counter per resolution to guarantee unique names |
| Copy instead of move | This workflow uses `shutil.move` — source folders become empty |
| Use per-frame GIF dimensions | Use `[0]` to get the canvas size |
| Process images in a random order | Always sort by ascending pixel area first |
