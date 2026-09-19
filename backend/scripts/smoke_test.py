import json
import urllib.request

BASE = "http://127.0.0.1:8000"


def req(method: str, path: str, payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        body = json.loads(response.read().decode())
        assert body.get("ok") or body.get("success"), body
        print(f"{method} {path} {response.status}")
        return body


health = req("GET", "/api/health")
print("health", health["ok"], health["dependencies"])
projects = req("GET", "/api/projects")
print("projects", [item["name"] for item in projects["projects"]])
intent = req("POST", "/api/parse-intent", {"prompt": "Create an ERC20 token with pause", "targetChain": "Base"})
print("intent", intent["result"]["detectedStandard"])
pipeline = req(
    "POST",
    "/api/agent-pipeline",
    {"prompt": "Create an ERC4626 vault with pause and fee", "targetChain": "Base", "contractName": "SmokeVault"},
)
project = pipeline["project"]
print("pipeline", project["name"], len(project["contracts"]))
code = project["contracts"][0]["code"]
audit = req("POST", "/api/audit", {"code": code, "filePath": "src/SmokeVault.sol", "autoPatch": True})
print("audit", audit["audit"]["securityScore"])
sim = req("POST", "/api/simulate", {"contractName": "SmokeVault", "networkFork": "Base Mainnet", "projectId": project["id"]})
print("simulate", sim["simulation"]["passedTests"])
deploy = req("POST", "/api/deploy", {"projectId": project["id"], "contractName": "SmokeVault", "network": "Base", "code": code})
print("deploy", deploy["deployment"]["simulated"], deploy["deployment"]["contractAddress"][:12])
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
)
print("bot", bot["bot"]["name"], bot["bot"]["status"])
print("SMOKE_OK")
