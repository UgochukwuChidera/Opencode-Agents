# Opencode Agents

Custom agent definitions for [opencode](https://opencode.ai/), synchronized across Linux and Windows via symlinks.

## Agents

| Agent | Description |
|-------|-------------|
| commit-crafter | Stages files and writes conventional commits |
| creator | Creative implementor — fuses ideas into elegant code |
| debugger | Investigates runtime errors and test failures |
| dependency-auditor | Audits dependencies for updates and vulnerabilities |
| design | Dynamic orchestrator of soul, creator, and historian agents |
| executor | Implements code changes from specs |
| explorer | Read-only codebase research |
| historian | Critical quality guardian |
| oracle | Deep codebase understanding agent |
| orchestrator | Breaks down tasks and delegates |
| reviewer | Reviews code for bugs, security, and best practices |
| soul | Synthesizes project essence — architecture, conventions, domain model |
| test-writer | Writes tests covering edge cases and regressions |

## Setup

### Linux / macOS

```bash
git clone https://github.com/UgochukwuChidera/Opencode-Agents.git ~/code/Opencode-Agents
chmod +x ~/code/Opencode-Agents/setup.sh
~/code/Opencode-Agents/setup.sh
```

### Windows

```powershell
git clone https://github.com/UgochukwuChidera/Opencode-Agents.git $HOME\code\Opencode-Agents
.\setup.bat
```

## How it works

The `agents/` folder is the single source of truth. On Linux, a symlink points
`~/.config/opencode/agents/` to it. On Windows, a directory junction points
`%USERPROFILE%\.config\opencode\agents\` to it.

Edit agent files here, commit, push, and pull on the other machine — opencode
sees the changes instantly.

## Sync workflow

```bash
# After editing an agent
cd ~/code/Opencode-Agents
git add agents/<name>.md
git commit -m "Update <agent-name>"
git push

# On the other machine
cd ~/code/Opencode-Agents
git pull
```
