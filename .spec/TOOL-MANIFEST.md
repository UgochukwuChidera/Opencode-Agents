# Tool Preference Manifest

This file maps bash commands to their preferred plugin tool equivalents.
There are **108 registered plugin tools** in this environment.

## Shell (2)
| Bash command | Use this tool |
|---|---|
| `sh`, `bash`, `zsh` (running commands) | `bash` |
| `powershell`, `pwsh` | `powershell` |

## Web (2)
| Bash command | Use this tool |
|---|---|
| `curl`, `wget` (fetching URLs) | `web-fetch` |
| web search | `web-search` |

## System (2)
| Bash command | Use this tool |
|---|---|
| `uname -a`, `system_profiler`, `lscpu` | `system-info`, `platform` |
| `echo $PATH`, `printenv`, `env` | `env` |

## Files (2)
| Bash command | Use this tool |
|---|---|
| `ls -la`, `ls -R` | `file-list` |
| `find . -name` | `file-search`, `glob` |

## Text Processing (24)
| Bash command | Use this tool |
|---|---|
| `cat` | `read` |
| `grep`, `rg`, `ack` | `grep` (built-in) |
| `head` | `head` |
| `tail` | `tail` |
| `wc`, `wc -l` | `wc` |
| `sort` | `sort` |
| `uniq` | `uniq` |
| `shuf`, `shuffle` | `shuffle` |
| `sed`, `sed -i` | `sed` |
| `tr`, `tolower`, `toupper` | `tr`, `case-convert` |
| `cut` | `cut` |
| `split` | `split` |
| `paste` | `paste` |
| `join` | `join` |
| `diff`, `cmp` | `diff` |
| `patch` | `patch` |
| `uuidgen` | `uuid` |
| `sha256sum`, `md5sum`, `shasum` | `hash` |
| `base64`, `base64 -d` | `base64` |
| `fortune`, `shuf -n1` | `shuffle`, `coin`, `dice`, `lottery` |
| `charcount`, `wordcount` | `text-stats` |
| `sed 's/foo/bar/g'` (regex) | `regex` |
| `slugify` | `slug` |
| `compress`, `decompress` | `compress` |

## Network (11)
| Bash command | Use this tool |
|---|---|
| `ping`, `ping6` | `ping` |
| `dig`, `nslookup`, `host` | `dig`, `dns` |
| `whois` | `whois` |
| `curl ifconfig.me`, `ip addr` | `ip` |
| `nc -zv host port` | `port-check` |
| `curl -I`, `wget --spider` | `headers`, `http-check` |
| `openssl s_client` | `ssl` |
| `traceroute`, `tracert` | `traceroute` |
| `curl -o /dev/null -s -w '%{http_code}'` | `http-status` |

## Data Formats (15)
| Bash command | Use this tool |
|---|---|
| `jq`, `python -c json` | `json` |
| `yq` | `yaml` |
| `xmlstarlet`, `xmllint` | `xml` |
| `column -t`, `columns` | `table` |
| `ascii bar chart` | `chart`, `progress` |
| `csvtool`, `csvkit` | `csv` |
| `tsv` processing | `tsv` |
| `jsontemplate`, `mustache` | `template` |
| `ini` parsing | `ini` |
| `toml` parsing | `toml` |
| `properties` files | `properties` |
| `plist` files | `plist` |
| `msgpack` | `msgpack` |
| `realpath`, `readlink -f` | `path-join`, `path-convert` |
| `dirname`, `basename` | `path-join` |

## Encoding (14)
| Bash command | Use this tool |
|---|---|
| `base58` | `base58` |
| `xxd`, `od` | `hex`, `binary` |
| `rot13` | `rot13` |
| `uuidparse` | `uuid-parse` |
| `quoted-printable` | `quoted-printable` |
| `idn`, `punycode` | `punycode` |
| `htmlentities`, `html-entities` | `html-entities` |
| `iconv` | `unicode` |
| `ascii85` | `ascii85` |
| `octal` dump | `octal` |
| `pem` parsing | `pem` |
| `openssl dgst -md4` | `ntlm` |
| `python -c pickle` | `pickle` |
| `python -c url` | `url` |

## Crypto & Web (6)
| Bash command | Use this tool |
|---|---|
| `python -c "import jwt"` | `jwt` |
| `npx semver` | `semver` |
| `npm search` | `web-search` |
| `git init` with template | `gitignore` |
| `license` lookups | `license` |
| `markdown` render | `markdown` |

## Media (7)
| Bash command | Use this tool |
|---|---|
| `image magick identify` | `image`, `mime` |
| `convert rgb to hsl` | `color` |
| `geolocation`, `distance` | `geo` |
| `qrencode` | `qr` |
| `emoji picker` | `emoji` |
| `wget xkcd.com` | `xkcd` |
| `file --mime-type` | `mime` |

## Cross-platform (4)
| Bash command | Use this tool |
|---|---|
| `realpath`, `readlink -f` | `path-convert` |
| `dirname`, `basename` | `path-join` |
| `echo $PATH`, `set` | `env` |
| `systeminfo`, `uname` | `win-sys`, `system-info` |

## Date/Time (9)
| Bash command | Use this tool |
|---|---|
| `date`, `date +%s` | `date` |
| `crontab -l`, cron format | `cron` |
| `sleep` | `wait` |
| `time` command | `timer` |
| `TZ=... date` | `clock` |
| `python -c timedelta` | `duration`, `age` |
| `countdown` | `countdown` |
| `business-days` calc | `business-days` |

## Math (7)
| Bash command | Use this tool |
|---|---|
| `bc`, `python -c "2+2"` | `math` |
| `units`, `convert` | `units` |
| `roman` numerals | `roman` |
| `coin flip` | `coin` |
| `dice roll` | `dice` |
| `pwgen`, `openssl rand` | `password` |
| `lottery` pick | `lottery` |

## AI (2)
| Bash command | Use this tool |
|---|---|
| AI content detection | `ai-detector` |
| Seniority estimation | `ai-senior` |

## Build/Plan (1)
| Bash command | Use this tool |
|---|---|
| Execute build plan | `plan-executor` |
