import json
import urllib.request

BASE = "http://127.0.0.1:8000"


def req(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers=headers,
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        body = json.loads(response.read().decode())
        assert body.get("ok") or body.get("success"), body
        print(f"{method} {path} {response.status}")
        return body


health = req("GET", "/api/health")
print("health", health["ok"], health["dependencies"])
assert health["dependencies"].get("langgraph") == "ok", health.get("langgraph")
assert health["dependencies"].get("walletAuth") == "ok", health["dependencies"]
assert health["dependencies"].get("telemetry") == "live", health["dependencies"]
integ = req("GET", "/api/integrations")
print("integrations", {key: integ[key]["status"] for key in ("llmPlanner", "explorer", "publicChain", "walletConnect", "redis", "oracleCloud")})
assert integ["llmPlanner"]["status"] == "not_configured", integ["llmPlanner"]
assert integ["explorer"]["status"] == "not_configured", integ["explorer"]
assert integ["publicChain"]["status"] == "not_configured", integ["publicChain"]
assert integ["walletConnect"]["status"] == "not_configured", integ["walletConnect"]
assert integ["oracleCloud"]["status"] == "not_deployed", integ["oracleCloud"]
auth = req("POST", "/api/auth/anvil")
token = auth["session"]["token"]
print("auth", auth["session"]["address"][:10], auth["session"]["chainId"], auth["session"]["method"])
assert auth["session"]["chainId"] == 31337
me = req("GET", "/api/auth/me", token=token)
print("me", me["address"][:10], me["chainId"])
projects = req("GET", "/api/projects")
print("projects", [item["name"] for item in projects["projects"]])
intent = req("POST", "/api/parse-intent", {"prompt": "Create an ERC20 token with pause", "targetChain": "Base"})
print("intent", intent["result"]["detectedStandard"], intent["result"].get("llmPlanner", {}).get("status"))
assert intent["result"].get("llmPlanner", {}).get("status") == "not_configured"
pipeline = req(
    "POST",
    "/api/agent-pipeline",
    {"prompt": "Create an ERC4626 vault with pause and fee", "targetChain": "Base", "contractName": "SmokeVault"},
)
project = pipeline["project"]
print("pipeline", project["name"], len(project["contracts"]), project.get("orchestrationEngine"), project.get("nodePath"))
assert project.get("orchestrationEngine") == "langgraph", project.get("orchestrationEngine")
assert project.get("llmPlanner") is False, project.get("llmPlannerStatus")
assert project.get("nodePath") == ["architect", "solidity", "auditor", "foundry", "gas"], project.get("nodePath")
assert project.get("simulated") is False
code = project["contracts"][0]["code"]
audit = req("POST", "/api/audit", {"code": code, "filePath": "src/SmokeVault.sol", "autoPatch": True})
print("audit", audit["audit"]["securityScore"])
sim = req("POST", "/api/simulate", {"contractName": "SmokeVault", "networkFork": "Base Mainnet", "projectId": project["id"]})
print("simulate", sim["simulation"]["passedTests"])
deploy = req("POST", "/api/deploy", {"projectId": project["id"], "contractName": "SmokeVault", "network": "Base", "code": code}, token=token)
print(
    "deploy",
    deploy["deployment"].get("live"),
    deploy["deployment"].get("deploymentTarget"),
    deploy["deployment"].get("chainId"),
    deploy["deployment"]["verificationStatus"],
    deploy["deployment"]["contractAddress"][:12],
)
verify = req("POST", "/api/verify", {"projectId": project["id"], "contractName": "SmokeVault"}, token=token)
print(
    "verify",
    verify["deployment"]["verificationStatus"],
    verify["deployment"].get("verificationEngine"),
    verify["verificationPayload"].get("explorerSubmitted"),
    verify["deployment"].get("verificationNote", "")[:120],
)
assert verify["deployment"]["verificationStatus"] == "verified", verify
assert verify["verificationPayload"].get("explorerSubmitted") is False
bot = req(
    "POST",
    "/api/bots",
    {
        "projectId": project["id"],
        "contractAddress": deploy["deployment"]["contractAddress"],
        "network": "Base",
        "botType": "tvl_monitor",
        "name": "Smoke Bot",
    },
    token=token,
)
print("bot", bot["bot"]["name"], bot["bot"]["status"], bot["bot"].get("live"))
probe = req("POST", "/api/bots/probe", {"projectId": project["id"]}, token=token)
print("probe", probe.get("transactionHash", "")[:12], [(item.get("eventsCaptured"), item.get("live"), item.get("transport")) for item in probe["bots"]])
assert any(item.get("eventsCaptured", 0) >= 1 for item in probe["bots"]), probe
assert all(item.get("live") for item in probe["bots"]), probe
listed = req("GET", "/api/bots?projectId=" + project["id"])
print("keepers", listed.get("keeper"))
tel = req("GET", "/api/telemetry")
print("telemetry", tel.get("engine"), tel.get("live"), tel["probes"].get("walletAuth"), len(tel.get("requestLogs") or []))
assert tel.get("live") is True, tel
assert tel.get("engine") == "local_probes", tel
assert tel["probes"].get("walletAuth") == "ok", tel
assert "llmPlanner" not in tel.get("probes", {}), tel
assert "redis" not in tel.get("probes", {}), tel
assert isinstance(tel.get("requestLogs"), list) and tel["requestLogs"], tel
print("SMOKE_OK")
