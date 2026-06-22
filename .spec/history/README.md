# Session History Archive

This directory stores archived session records after multi-agent operations complete.

## Structure

Each session is archived as a JSON file named `{session_id}.json` containing:

```json
{
  "session_id": "uuid",
  "start_time": "ISO 8601",
  "end_time": "ISO 8601",
  "description": "What operation this session performed",
  "agent_count": 5,
  "agents": ["executor", "historian", "commit-crafter"],
  "files_created": 12,
  "packages_installed": ["react-router-dom"],
  "packages_removed": [],
  "space_freed_bytes": 409600,
  "status": "completed"
}
```

## Lifecycle

1. Coordinator creates the session record in `.spec/current.json`
2. After cleanup-agent completes post-publish cleanup, it archives the session here
3. Old session histories can be cleaned with `cleanup-agent --archive-max-age 30d`

## Note

This directory is in `.gitignore` — session histories are operational metadata,
not part of the source code. They survive as long as they exist on disk.
