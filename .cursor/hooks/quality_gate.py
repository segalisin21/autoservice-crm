import json
import os
import subprocess
import sys

def run(cmd: str):
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    out = (p.stdout or "") + (p.stderr or "")
    return p.returncode == 0, out

cfg_path = os.path.join(".cursor", "project-commands.json")
try:
    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
except FileNotFoundError:
    msg = f"[hooks] Missing {cfg_path}. Skipping quality gate."
    sys.stdout.write(json.dumps({"continue": True, "permission": "allow", "userMessage": msg, "agentMessage": msg}))
    sys.exit(0)

active = cfg.get("active_profile", "python_fastapi_ci")
profiles = cfg.get("profiles", {})
profile = profiles.get(active, {})
test_cmd = str(profile.get("test", "")).strip()

if not test_cmd:
    msg = f"[hooks] No test command configured for profile: {active}"
    sys.stdout.write(json.dumps({"continue": True, "permission": "allow", "userMessage": msg, "agentMessage": msg}))
    sys.exit(0)

ok, out = run(test_cmd)
tail = out[-4000:]

if not ok:
    user_msg = "Quality gate FAILED: pytest failed. See agent message for details."
    agent_msg = f"[hooks] Command: {test_cmd}\n\n[hooks] Output tail:\n{tail}"
    sys.stdout.write(json.dumps({"continue": True, "permission": "allow", "userMessage": user_msg, "agentMessage": agent_msg}))
else:
    user_msg = "Quality gate passed: pytest tests/ -v --tb=short"
    agent_msg = f"[hooks] Command: {test_cmd}\n\n[hooks] OK"
    sys.stdout.write(json.dumps({"continue": True, "permission": "allow", "userMessage": user_msg, "agentMessage": agent_msg}))