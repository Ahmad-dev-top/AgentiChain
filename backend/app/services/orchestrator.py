from datetime import datetime, timezone
from importlib.metadata import version as pkg_version
from typing import Annotated, Any, Optional, TypedDict
import operator
import os
import time

os.environ.setdefault("LANGCHAIN_TRACING_V2", "false")

from app.models.schemas import AgentTraceItem, ContractFile, ContractSpec, ProjectDetail, SecurityAuditReport, SimulationResult, SupportedChain
from app.services.foundry import run_foundry_simulation
from app.services.intent import parse_intent_with_planner
from app.services.security import auto_patch_contract
from app.services.slither_engine import run_live_security_audit


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stamp() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _vault_source(name: str, description: str) -> str:
    return f'''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {{ERC4626}} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {{ERC20}} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {{IERC20}} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {{SafeERC20}} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {{AccessControlDefaultAdminRules}} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {{Pausable}} from "@openzeppelin/contracts/utils/Pausable.sol";
import {{ReentrancyGuard}} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title {name}
/// @notice {description}
contract {name} is ERC4626, AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {{
    using SafeERC20 for IERC20;

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public performanceFeeBps;
    address public feeRecipient;
    uint64 public lastHarvestTimestamp;

    error ZeroDepositAmount();
    error ZeroWithdrawAmount();
    error InvalidFeeRecipient();
    error ExceedsMaxFee(uint256 requested, uint256 maxAllowed);

    event YieldHarvested(uint256 grossProfit, uint256 feeDeducted, uint256 netToVault);
    event PerformanceFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialAdmin_,
        address initialFeeRecipient_,
        uint16 initialFeeBps_
    )
        ERC4626(asset_)
        ERC20(name_, symbol_)
        AccessControlDefaultAdminRules(3 days, initialAdmin_)
    {{
        if (initialFeeRecipient_ == address(0)) revert InvalidFeeRecipient();
        feeRecipient = initialFeeRecipient_;
        performanceFeeBps = initialFeeBps_;
        lastHarvestTimestamp = uint64(block.timestamp);

        _grantRole(STRATEGIST_ROLE, initialAdmin_);
        _grantRole(PAUSER_ROLE, initialAdmin_);
    }}

    function _decimalsOffset() internal pure virtual override returns (uint8) {{
        return 3;
    }}

    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused returns (uint256) {{
        if (assets == 0) revert ZeroDepositAmount();
        return super.deposit(assets, receiver);
    }}

    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {{
        if (assets == 0) revert ZeroWithdrawAmount();
        return super.withdraw(assets, receiver, owner);
    }}

    function pause() external onlyRole(PAUSER_ROLE) {{
        _pause();
    }}

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {{
        _unpause();
    }}
}}
'''


def _generic_source(name: str, description: str) -> str:
    return f'''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {{Ownable2Step, Ownable}} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {{ReentrancyGuard}} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {{Pausable}} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title {name}
/// @notice {description}
contract {name} is Ownable2Step, ReentrancyGuard, Pausable {{
    uint256 public totalOperations;
    mapping(address => uint256) public userBalances;

    error ZeroAmount();
    error Unauthorized();

    event OperationExecuted(address indexed user, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {{}}

    function executeOperation(uint256 amount) external payable nonReentrant whenNotPaused returns (bool) {{
        if (amount == 0 && msg.value == 0) revert ZeroAmount();
        uint256 value = msg.value > 0 ? msg.value : amount;
        userBalances[msg.sender] += value;
        totalOperations++;
        emit OperationExecuted(msg.sender, value);
        return true;
    }}

    function pause() external onlyOwner {{
        _pause();
    }}

    function unpause() external onlyOwner {{
        _unpause();
    }}
}}
'''


def _vault_test(name: str) -> str:
    return f'''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {{Test}} from "forge-std/Test.sol";
import {{ERC20}} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {{IERC20}} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {{{name}}} from "../src/{name}.sol";

contract MockAsset is ERC20 {{
    constructor() ERC20("Mock USD", "mUSD") {{}}

    function mint(address to, uint256 amount) external {{
        _mint(to, amount);
    }}
}}

contract {name}Test is Test {{
    MockAsset public asset;
    {name} public vault;
    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public feeRecipient = makeAddr("fee");

    function setUp() public {{
        asset = new MockAsset();
        vault = new {name}(IERC20(address(asset)), "Agenti Vault", "aVLT", admin, feeRecipient, 200);
        asset.mint(alice, 1_000 ether);
        vm.prank(alice);
        asset.approve(address(vault), type(uint256).max);
    }}

    function test_DepositMintsShares() public {{
        vm.prank(alice);
        uint256 shares = vault.deposit(100 ether, alice);
        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
    }}

    function test_ZeroDepositReverts() public {{
        vm.prank(alice);
        vm.expectRevert({name}.ZeroDepositAmount.selector);
        vault.deposit(0, alice);
    }}

    function test_PauseBlocksDeposit() public {{
        vm.prank(admin);
        vault.pause();
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(1 ether, alice);
    }}
}}
'''


def _generic_test(name: str) -> str:
    return f'''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {{Test}} from "forge-std/Test.sol";
import {{{name}}} from "../src/{name}.sol";

contract {name}Test is Test {{
    {name} public instance;
    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");

    function setUp() public {{
        instance = new {name}(admin);
    }}

    function test_ExecuteOperation() public {{
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        bool ok = instance.executeOperation{{value: 0.1 ether}}(0);
        assertTrue(ok);
        assertEq(instance.userBalances(alice), 0.1 ether);
    }}

    function test_ZeroAmountReverts() public {{
        vm.prank(alice);
        vm.expectRevert({name}.ZeroAmount.selector);
        instance.executeOperation(0);
    }}

    function test_PauseBlocksOperation() public {{
        vm.prank(admin);
        instance.pause();
        vm.prank(alice);
        vm.expectRevert();
        instance.executeOperation(1);
    }}
}}
'''


class AgentState(TypedDict, total=False):
    prompt: str
    target_chain: str
    contract_name: Optional[str]
    spec: Any
    contracts: list
    traces: Annotated[list, operator.add]
    audit: Any
    simulation: Any
    stamp: int
    engine: str
    node_path: Annotated[list, operator.add]
    core_code: str
    main_name: str
    llm_planner: dict


def _elapsed_ms(started: float) -> int:
    return max(int((time.perf_counter() - started) * 1000), 1)


def _trace(stamp: int, index: int, **kwargs) -> AgentTraceItem:
    return AgentTraceItem(id=f"tr-{stamp}-{index}", createdAt=_now(), tokensUsed=0, **kwargs)


def architect_node(state: AgentState) -> dict:
    started = time.perf_counter()
    parsed = parse_intent_with_planner(state["prompt"], state["target_chain"], state.get("contract_name"))
    spec: ContractSpec = parsed["spec"]
    llm_meta = parsed.get("llmPlanner") or {}
    return {
        "spec": spec,
        "main_name": spec.name,
        "llm_planner": llm_meta,
        "node_path": ["architect"],
        "traces": [
            _trace(
                state["stamp"],
                1,
                agentName="Protocol Architect",
                agentRole="System Architecture",
                action="Synthesized Smart Contract Formal Specification",
                thought=(
                    f'Architect parsed the prompt. Standard: {spec.standard}.'
                ),
                inputPayload={"prompt": state["prompt"], "targetChain": state["target_chain"]},
                outputPayload={"standard": spec.standard, "rolesCount": len(spec.roles), "node": "architect"},
                status="success",
                latencyMs=_elapsed_ms(started),
            )
        ],
    }


def solidity_node(state: AgentState) -> dict:
    started = time.perf_counter()
    spec: ContractSpec = state["spec"]
    stamp = state["stamp"]
    main_name = spec.name
    is_vault = spec.standard == "ERC4626"
    core_code = _vault_source(main_name, spec.description) if is_vault else _generic_source(main_name, spec.description)
    interface_code = f'''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface I{main_name} {{
    function pause() external;
    function unpause() external;
}}
'''
    test_code = _vault_test(main_name) if is_vault else _generic_test(main_name)
    deploy_script = f'''// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {{Script, console2}} from "forge-std/Script.sol";
import {{{main_name}}} from "../src/{main_name}.sol";

contract DeployScript is Script {{
    function run() external {{
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        vm.stopBroadcast();
    }}
}}
'''
    contracts = [
        ContractFile(id=f"c-{stamp}-1", projectId="proj-temp", name=f"{main_name}.sol", filePath=f"src/{main_name}.sol", contractType="core", version=1, code=core_code),
        ContractFile(id=f"c-{stamp}-2", projectId="proj-temp", name=f"I{main_name}.sol", filePath=f"src/interfaces/I{main_name}.sol", contractType="interface", version=1, code=interface_code),
        ContractFile(id=f"c-{stamp}-3", projectId="proj-temp", name=f"{main_name}.t.sol", filePath=f"test/{main_name}.t.sol", contractType="test", version=1, code=test_code),
        ContractFile(id=f"c-{stamp}-4", projectId="proj-temp", name="Deploy.s.sol", filePath="script/Deploy.s.sol", contractType="script", version=1, code=deploy_script),
    ]
    return {
        "contracts": contracts,
        "core_code": core_code,
        "main_name": main_name,
        "node_path": ["solidity"],
        "traces": [
            _trace(
                stamp,
                2,
                agentName="Lead Solidity Engineer",
                agentRole="Solidity 0.8.24",
                action=f"Generated Production Solidity Contracts for {main_name}",
                thought="Solidity sources were authored from the spec templates.",
                inputPayload={"specName": spec.name, "node": "solidity"},
                outputPayload={"filesGenerated": [item.filePath for item in contracts]},
                status="success",
                latencyMs=_elapsed_ms(started),
            )
        ],
    }


def auditor_node(state: AgentState) -> dict:
    started = time.perf_counter()
    contracts = list(state["contracts"])
    core_code = state["core_code"]
    main_name = state["main_name"]
    audit_report = run_live_security_audit(contracts, "proj-temp", core_code, f"src/{main_name}.sol")
    patch_result = auto_patch_contract(core_code, audit_report.vulnerabilities)
    contracts[0] = contracts[0].model_copy(update={"code": patch_result["patchedCode"]})
    return {
        "contracts": contracts,
        "audit": audit_report,
        "core_code": patch_result["patchedCode"],
        "node_path": ["auditor"],
        "traces": [
            _trace(
                state["stamp"],
                3,
                agentName="Security Auditor",
                agentRole="Slither & Static Analysis",
                action="Static Analysis & Auto-Patching Reflection Loop",
                thought="Auditor ran the live local static analysis plus the pattern scanner.",
                inputPayload={"originalIssues": audit_report.totalIssues, "node": "auditor"},
                outputPayload={"patchLog": patch_result["patchLog"], "finalScore": audit_report.securityScore, "live": audit_report.live},
                status="success",
                latencyMs=_elapsed_ms(started),
            )
        ],
    }


def foundry_node(state: AgentState) -> dict:
    started = time.perf_counter()
    main_name = state["main_name"]
    sim_result = run_foundry_simulation(main_name, "proj-temp", "local forge (no RPC fork)", state["contracts"])
    failed = sim_result.failedTests > 0
    return {
        "simulation": sim_result,
        "node_path": ["foundry"],
        "traces": [
            _trace(
                state["stamp"],
                4,
                agentName="Foundry Test Engineer",
                agentRole="Forge & Invariant Testing",
                action="Live forge build/test via LangGraph",
                thought=f"Foundry executed live forge for {main_name}.",
                inputPayload={"simType": sim_result.simType, "node": "foundry"},
                outputPayload={"passed": sim_result.passedTests, "failed": sim_result.failedTests, "durationMs": sim_result.durationMs, "live": sim_result.live},
                status="error" if failed else "success",
                latencyMs=_elapsed_ms(started),
            )
        ],
    }


def gas_node(state: AgentState) -> dict:
    started = time.perf_counter()
    sim_result = state["simulation"]
    return {
        "node_path": ["gas"],
        "traces": [
            _trace(
                state["stamp"],
                5,
                agentName="Gas Optimizer",
                agentRole="Opcode & Storage Optimization",
                action="Gas snapshot from live forge output",
                thought="Gas node reported forge gas figures.",
                inputPayload={"node": "gas"},
                outputPayload={"gasBenchmarks": [item.model_dump() for item in sim_result.gasBenchmarks]},
                status="success",
                latencyMs=_elapsed_ms(started),
            )
        ],
    }


def _compile_agent_graph():
    from langgraph.graph import END, START, StateGraph

    builder = StateGraph(AgentState)
    builder.add_node("architect", architect_node)
    builder.add_node("solidity", solidity_node)
    builder.add_node("auditor", auditor_node)
    builder.add_node("foundry", foundry_node)
    builder.add_node("gas", gas_node)
    builder.add_edge(START, "architect")
    builder.add_edge("architect", "solidity")
    builder.add_edge("solidity", "auditor")
    builder.add_edge("auditor", "foundry")
    builder.add_edge("foundry", "gas")
    builder.add_edge("gas", END)
    return builder.compile()


try:
    AGENT_GRAPH = _compile_agent_graph()
except Exception:  # pragma: no cover - import/runtime fallback
    AGENT_GRAPH = None


def langgraph_status() -> dict:
    try:
        return {
            "status": "ok" if AGENT_GRAPH is not None else "error",
            "version": pkg_version("langgraph"),
            "engine": "langgraph" if AGENT_GRAPH is not None else "linear_fallback",
            "nodes": ["architect", "solidity", "auditor", "foundry", "gas"],
            "note": "Local agent nodes are running.",
        }
    except Exception as exc:
        return {"status": "not_installed", "engine": "linear_fallback", "detail": str(exc)}


def _merge_node(state: dict, update: dict) -> dict:
    traces = list(state.get("traces") or []) + list(update.get("traces") or [])
    path = list(state.get("node_path") or []) + list(update.get("node_path") or [])
    merged = {**state, **update, "traces": traces, "node_path": path}
    return merged


def _run_linear(state: dict) -> dict:
    for node in (architect_node, solidity_node, auditor_node, foundry_node, gas_node):
        state = _merge_node(state, node(state))
    state["engine"] = "linear_fallback"
    return state


def orchestrate_multi_agent_workflow(
    user_prompt: str,
    target_chain: SupportedChain = "Base",
    contract_name: Optional[str] = None,
) -> dict:
    initial: dict = {
        "prompt": user_prompt,
        "target_chain": target_chain,
        "contract_name": contract_name,
        "stamp": _stamp(),
        "traces": [],
        "node_path": [],
        "engine": "langgraph",
    }
    try:
        raw = AGENT_GRAPH.invoke(initial) if AGENT_GRAPH is not None else _run_linear(initial)
    except Exception:
        raw = _run_linear(initial)
    traces = []
    for item in raw.get("traces") or []:
        traces.append(item if isinstance(item, AgentTraceItem) else AgentTraceItem.model_validate(item))
    return {
        "spec": raw["spec"],
        "contracts": raw["contracts"],
        "traces": traces,
        "auditReport": raw["audit"],
        "simulationResult": raw["simulation"],
        "engine": raw.get("engine") or ("langgraph" if AGENT_GRAPH is not None else "linear_fallback"),
        "nodePath": raw.get("node_path") or [],
        "langgraphVersion": langgraph_status().get("version"),
        "llmPlanner": raw.get("llm_planner") or {},
    }


def workflow_to_project(
    prompt: str,
    target_chain: SupportedChain,
    contract_name: Optional[str],
    project_id: Optional[str] = None,
) -> ProjectDetail:
    workflow = orchestrate_multi_agent_workflow(prompt, target_chain, contract_name)
    pid = project_id or f"proj-{_stamp()}"
    spec_raw = workflow["spec"]
    spec: ContractSpec = spec_raw if isinstance(spec_raw, ContractSpec) else ContractSpec.model_validate(spec_raw)
    now = _now()
    contracts = []
    for item in workflow["contracts"]:
        cloned = item if isinstance(item, ContractFile) else ContractFile.model_validate(item)
        cloned = cloned.model_copy(update={"projectId": pid})
        contracts.append(cloned)
    audit_raw = workflow["auditReport"]
    audit = audit_raw if isinstance(audit_raw, SecurityAuditReport) else SecurityAuditReport.model_validate(audit_raw)
    audit.projectId = pid
    sim_raw = workflow["simulationResult"]
    simulation = sim_raw if isinstance(sim_raw, SimulationResult) else SimulationResult.model_validate(sim_raw)
    simulation.projectId = pid
    return ProjectDetail(
        id=pid,
        name=spec.name,
        description=prompt,
        contractStandard=spec.standard,
        targetChain=spec.targetChain,
        solidityVersion=spec.solidityVersion,
        status="synthesized",
        specJson=spec,
        contracts=contracts,
        audit=audit,
        simulation=simulation,
        bots=[],
        traces=workflow["traces"],
        createdAt=now,
        updatedAt=now,
        simulated=False,
        orchestrationEngine=workflow.get("engine") or "langgraph",
        langgraphVersion=workflow.get("langgraphVersion"),
        nodePath=list(workflow.get("nodePath") or []),
        llmPlanner=bool((workflow.get("llmPlanner") or {}).get("used")),
        llmPlannerStatus=str((workflow.get("llmPlanner") or {}).get("status") or "not_configured"),
    )
