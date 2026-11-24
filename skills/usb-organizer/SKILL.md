---
name: usb-organizer
description: Use when tidying a messy USB/external drive (Ventoy, exFAT, SD card) into six key folders — Pictures, Downloads, Documents, Desktop, Videos, Music — plus the only two allowed overflow folders, "To Be Organized" and "To Be Deleted". Move-only, duplicate-safe, no deletions. Trigger words: organize USB, tidy drive, Ventoy cleanup, sort files into folders, to be organized, to be deleted.
---

# USB organizer (six key folders + two overflow folders)

Sort everything at the **root** of the drive into exactly these eight
top-level folders, then leave it for human review:

```
Pictures   Downloads   Documents   Desktop   Videos   Music
To Be Organized   To Be Deleted
```

**Move-only.** Never `rm`. Duplicates/junk go to `To Be Deleted` so the owner
can review and delete them manually. Leave filesystem/system dirs alone:
`$RECYCLE.BIN`, `System Volume Information`, `.Trash-*`.

## Safety

- Mount read-write first (`udisksctl mount -b /dev/sdb1`; do not mount read-only).
- Do a dry run before applying. The script defaults to dry-run; `--apply` moves.
- Never overwrite: `mv -n` and skip when the destination name exists.
- Splitting a mixed folder is optional; if unsure, put the whole folder in
  `To Be Organized` for the owner to inspect.
- Keep a report at `To Be Organized/_ORGANIZE_REPORT.txt` listing every move.

## Quick start

```bash
# dry run
/home/carapace/Projects/Opencode-Agents/skills/usb-organizer/scripts/organize-usb.sh \
  /run/media/carapace/Ventoy

# apply
/home/carapace/Projects/Opencode-Agents/skills/usb-organizer/scripts/organize-usb.sh \
  /run/media/carapace/Ventoy --apply
```

## Classification rules

Loose files (by extension):

| Folder | Extensions |
| --- | --- |
| Pictures | jpg jpeg png gif webp bmp svg heic tif tiff avif |
| Videos | mp4 mkv webm avi mov m4v flv wmv mpg mpeg ts m2ts |
| Music | mp3 flac wav m4a aac ogg opus wma aiff alac |
| Documents | pdf doc docx ppt pptx xls xlsx odt ods odp md txt rtf epub mobi csv |
| Downloads | iso img zip 7z rar tar gz xz zst bz2 exe msi deb rpm AppImage apk dmg |
| To Be Organized | anything else |

Folders are moved whole when the name clearly maps:

- `*anime* *silo* *series* *season* *movie* *film* *episode*` → `Videos/`
- `*game* *games*` → `Downloads/`
- `*music* *song* *audio* *album*` → `Music/`
- `*picture* *photo* *image* *wallpaper* *artwork*` → `Pictures/`
- `*document* *project* *code* *notes* *paper* *school* *academic* *work* *career*` → `Documents/`
- `*download* *setup* *installer*` → `Downloads/`
- everything else → `To Be Organized/`

The owner may override (e.g. a system backup has no natural home → `To Be
Organized`; a game install → `Downloads/Games`; an OS ISO → `Downloads`).

## Mixed folders (optional deep sort)

If a folder contains several media types and you want to split it, keep the
source folder name under each category so provenance survives:

```bash
USB=/run/media/$USER/Ventoy; cd "$USB"
src="New folder"; dest="Videos/$src"; mkdir -p "$dest"
find "$src" -maxdepth 1 -type f -iname '*.mp4' -exec mv -n {} "$dest/" \;
# repeat for images -> Pictures/<src>, audio -> Music/<src>,
# docs -> Documents/<src>, archives/installers -> Downloads/<src>
# then move the now-empty source to "To Be Deleted/empty dirs/"
```

## Duplicate handling

A file is treated as a duplicate when it has the **same basename and same byte
size** as a file already in the destination tree. Duplicates are moved to
`To Be Deleted/duplicates/` (never deleted). This catches `- Copy` files and
repeated AMVs/episodes without hashing 100 GB.

## What the original run did (reference)

Source: 298 GB Ventoy USB, exFAT, 105 GB used.

- Root loose files → `Downloads` (ISO, zips, rufus, ventoy), `Music` (mp3s),
  `Videos` (mp4/mkv), `Documents` (PDF).
- `USB DISK/Anime` → `Videos/Anime`, `USB DISK/Silo` → `Videos/Silo`,
  `USB DISK/Among Us` → `Downloads/Games/Among Us`, loose media split into
  `Videos|Music|Pictures|Documents/USB DISK`.
- `New folder` split into `Pictures/library_image_batch_*`,
  `Videos/New folder`, `Music/New folder`, `Documents/New folder`.
- `New folder (3)` → `Documents/New folder (3)` (ID/work docs).
- `New folder (4)` → Dragon Ball GT → `Videos/Anime/Dragon Ball GT`,
  AMVs → `Videos/New folder (4)`, docs → `Documents/New folder (4)`.
- `Projects` → `Documents/Projects`; `download (1)` → `Documents/download (1)`;
  `Football Manager 26` → `Downloads/Games`.
- `backup/` (Nexus system backup) → `To Be Organized/backup` (no natural category).
- Exact duplicate AMVs/docs, WPS adware installers, and empty dirs →
  `To Be Deleted/{duplicates,junk,empty dirs}`.
- `$RECYCLE.BIN` and `System Volume Information` left untouched.
- Final: 105 GB preserved; nothing permanently deleted.

## Final check

```bash
cd /run/media/$USER/Ventoy
for d in Pictures Downloads Documents Desktop Videos Music "To Be Organized" "To Be Deleted"; do
  printf '%-18s files=%-5s size=%s\n' "$d" "$(find "$d" -type f | wc -l)" "$(du -sh "$d" | cut -f1)"
done
find . -maxdepth 1 -type f          # should be empty
du -sh .                            # should equal the pre-organize total
```
