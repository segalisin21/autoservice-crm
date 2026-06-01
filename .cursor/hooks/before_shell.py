import json
import re
import sys

raw = sys.stdin.read().strip()
payload = json.loads(raw) if raw else {}

cmd = str(payload.get("command", "")).strip()

blocked_patterns = [
    r"\brm\s+-rf\b",
    r"\bdel\s+/s\s+/q\b",
    r"\brd\s+/s\s+/q\b",
    r"\bformat\s+[a-z]:\b",
    r"\bcurl\b.*\|\s*sh\b",
    r"\bwget\b.*\|\s*sh\b",
    r"\bpowershell\b.*\bIEX\b",
]

is_blocked = any(re.search(p, cmd, flags=re.IGNORECASE) for p in blocked_patterns)

if is_blocked:
    msg = f"Blocked unsafe shell command: {cmd}"
    out = {
        "continue": False,
        "permission": "deny",
        "userMessage": msg,
        "agentMessage": msg
    }
    sys.stdout.write(json.dumps(out))
    sys.exit(0)

out = {"continue": True, "permission": "allow"}
sys.stdout.write(json.dumps(out))