from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import (
    ContractSpec,
    ErrorParam,
    ErrorSpec,
    EventParam,
    EventSpec,
    FeatureFlags,
    FunctionParam,
    FunctionReturn,
    FunctionSpec,
    InvariantSpec,
    RoleSpec,
    StateVariable,
    SupportedChain,
)
from app.services.planner import ALLOWED_STANDARDS, run_llm_planner

ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000"
PAUSER_ROLE = "0x65d7884672e2887e2f437f649bcb0f466fe604e0e60742dff9a0e3c96c103b70"
STRATEGIST_ROLE = "0x13af34fc2141fa69116e25447a16f6b5b542031a0db6da4821a361efd1396a84"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_natural_language_intent(
    user_prompt: str,
    target_chain: SupportedChain = "Base",
    contract_name_override: Optional[str] = None,
    llm_plan: Optional[dict] = None,
) -> dict:
    prompt_lower = user_prompt.lower()
    standard = "CUSTOM"
    name = contract_name_override or "AgentiContract"
    title = "Custom Autonomous Smart Contract"

    if any(token in prompt_lower for token in ("vault", "4626", "yield", "deposit pool")):
        standard = "ERC4626"
        name = contract_name_override or "AgentiVault4626"
        title = "ERC4626 Tokenized Yield Vault"
    elif any(token in prompt_lower for token in ("restak", "liquid stak", "lrt", "eigenlayer")):
        standard = "RESTAKING"
        name = contract_name_override or "StakeShieldLRT"
        title = "Liquid Restaking Token Protocol"
    elif any(token in prompt_lower for token in ("staking", "stake", "reward")):
        standard = "STAKING"
        name = contract_name_override or "AgentiStakingRewards"
        title = "Multi-Reward Staking Pool"
    elif any(token in prompt_lower for token in ("governor", "dao", "voting", "proposal")):
        standard = "GOVERNOR"
        name = contract_name_override or "AgentiGovernorDAO"
        title = "Decentralized Autonomous Governor"
    elif any(token in prompt_lower for token in ("escrow", "multisig", "arbitration", "custody")):
        standard = "ESCROW"
        name = contract_name_override or "AgentiMultiSigEscrow"
        title = "Non-Custodial Multi-Party Escrow"
    elif any(token in prompt_lower for token in ("amm", "swap", "dex", "liquidity pool")):
        standard = "AMM"
        name = contract_name_override or "AgentiAMMConstantProduct"
        title = "Automated Market Maker Dynamic Pair"
    elif any(token in prompt_lower for token in ("nft", "erc721", "collection", "mint drop")):
        standard = "ERC721"
        name = contract_name_override or "AgentiNFTCollection"
        title = "Gas-Optimized ERC721 Collection"
    elif any(token in prompt_lower for token in ("erc20", "token", "coin")):
        standard = "ERC20"
        name = contract_name_override or "AgentiToken"
        title = "Standard ERC20 Token with Permit"

    if llm_plan:
        plan_standard = str(llm_plan.get("standard") or "").upper()
        if plan_standard in ALLOWED_STANDARDS:
            standard = plan_standard
        if llm_plan.get("contractName") and not contract_name_override:
            name = str(llm_plan["contractName"])
        if llm_plan.get("title"):
            title = str(llm_plan["title"])

    has_pause = any(token in prompt_lower for token in ("pause", "circuit breaker", "emergency stop"))
    has_timelock = any(token in prompt_lower for token in ("timelock", "delay", "queue"))
    has_oracle = any(token in prompt_lower for token in ("oracle", "chainlink", "price feed", "twap"))
    has_fee = any(token in prompt_lower for token in ("fee", "performance fee", "tax"))
    has_access = any(token in prompt_lower for token in ("role", "access control")) or standard in {
        "ERC4626",
        "GOVERNOR",
    }
    if llm_plan:
        has_pause = has_pause or bool(llm_plan.get("pausable"))
        has_timelock = has_timelock or bool(llm_plan.get("timelock"))
        has_oracle = has_oracle or bool(llm_plan.get("oracle"))
        has_fee = has_fee or bool(llm_plan.get("fee"))
        has_access = has_access or bool(llm_plan.get("accessControl"))

    roles = [
        RoleSpec(
            name="DEFAULT_ADMIN_ROLE",
            identifier=ADMIN_ROLE,
            description="Protocol administrator for parameter adjustments and privilege management",
            allowedFunctions=["grantRole", "revokeRole", "setParameters"],
        )
    ]
    if has_pause:
        roles.append(
            RoleSpec(
                name="PAUSER_ROLE",
                identifier=PAUSER_ROLE,
                description="Circuit breaker operator able to pause incoming user interactions",
                allowedFunctions=["pause", "unpause"],
            )
        )
    if standard in {"ERC4626", "RESTAKING"}:
        roles.append(
            RoleSpec(
                name="STRATEGIST_ROLE",
                identifier=STRATEGIST_ROLE,
                description="Authorized strategist managing yield compounding and strategy reallocations",
                allowedFunctions=["harvestYield", "rebalance"],
            )
        )

    invariants = [
        InvariantSpec(
            id="INV-01",
            name="Solvency Invariant",
            expression="vaultReserves >= userClaimsSum",
            description="The protocol balance must at all times cover or exceed total user liabilities.",
            verificationLevel="SMT",
        ),
        InvariantSpec(
            id="INV-02",
            name="Reentrancy Protection",
            expression="_status == NOT_ENTERED on external exit",
            description="Reentrancy guard status must always reset back to non-entered state.",
            verificationLevel="Foundry",
        ),
    ]
    if standard == "ERC4626":
        invariants.append(
            InvariantSpec(
                id="INV-03",
                name="Virtual Share Inflation Immunity",
                expression="convertToShares(assets) > 0",
                description="Virtual offset prevents dead share zero rounding exploits.",
                verificationLevel="Certora",
            )
        )

    errors = [
        ErrorSpec(name="ZeroAmount", params=[], description="Reverts when amount passed is zero"),
        ErrorSpec(
            name="UnauthorizedCaller",
            params=[ErrorParam(name="caller", type="address")],
            description="Reverts when caller lacks required role",
        ),
        ErrorSpec(
            name="InvalidParameter",
            params=[ErrorParam(name="reason", type="string")],
            description="Reverts when invalid configuration is supplied",
        ),
    ]
    if has_pause:
        errors.append(ErrorSpec(name="ProtocolPaused", params=[], description="Reverts when emergency pause is active"))

    events = [
        EventSpec(
            name="ParametersUpdated",
            params=[EventParam(name="operator", type="address", indexed=True)],
            description="Emitted when admin modifies system configurations",
        )
    ]
    if has_pause:
        events.append(
            EventSpec(
                name="EmergencyStateToggled",
                params=[
                    EventParam(name="isPaused", type="bool", indexed=False),
                    EventParam(name="operator", type="address", indexed=True),
                ],
                description="Emitted when circuit breaker is tripped or reset",
            )
        )

    primary_name = "deposit" if standard == "ERC4626" else "executeOperation"
    params = (
        [FunctionParam(name="assets", type="uint256"), FunctionParam(name="receiver", type="address")]
        if standard == "ERC4626"
        else [FunctionParam(name="amount", type="uint256")]
    )
    modifiers = ["nonReentrant"]
    if has_pause:
        modifiers.append("whenNotPaused")

    functions = [
        FunctionSpec(
            name=primary_name,
            visibility="external",
            mutability="nonpayable",
            params=params,
            returns=[FunctionReturn(name="result", type="uint256")],
            modifiers=modifiers,
            description="Primary protocol entrypoint with security checks and event emissions.",
            emitsEvents=["ParametersUpdated"],
            revertsWithErrors=["ZeroAmount"] + (["ProtocolPaused"] if has_pause else []),
        )
    ]

    state_vars = [StateVariable(name="isInitialized", type="bool", visibility="public", slotPackingNotes="Packed into Slot 0")]
    if has_fee:
        state_vars.append(
            StateVariable(name="feeBps", type="uint16", visibility="public", slotPackingNotes="Packed into Slot 0 (16 bits)")
        )

    spec = ContractSpec(
        name=name,
        title=title,
        description=user_prompt,
        standard=standard,  # type: ignore[arg-type]
        targetChain=target_chain,
        solidityVersion="0.8.24",
        features=FeatureFlags(
            pausable=has_pause,
            ownable2Step=True,
            accessControl=has_access,
            reentrancyGuard=True,
            erc4626VirtualShares=standard == "ERC4626",
            permit2EIP2612=True,
            flashLoanProtection=True,
            timelockQueue=has_timelock,
            oracleIntegration=has_oracle,
            feeOnTransferSupport=False,
            gasOptimizationPass=True,
        ),
        roles=roles,
        invariants=invariants,
        customErrors=errors,
        events=events,
        functions=functions,
        stateVariables=state_vars,
    )

    return {
        "spec": spec,
        "confidence": 0.96,
        "detectedStandard": standard,
        "reasoning": (
            f"Identified {title} on {target_chain}."
        ),
        "suggestedInvariants": [
            "Total pool reserves >= total minted claims",
            "Reentrancy state reverts on recursive call frame",
            "Timelock enforcement on privileged administrative functions",
        ],
    }


def parse_intent_with_planner(
    user_prompt: str,
    target_chain: SupportedChain = "Base",
    contract_name_override: Optional[str] = None,
) -> dict:
    plan, llm_meta = run_llm_planner(user_prompt, target_chain)
    parsed = parse_natural_language_intent(user_prompt, target_chain, contract_name_override, plan)
    parsed["llmPlanner"] = llm_meta
    parsed["confidence"] = 0.98 if plan else parsed.get("confidence", 0.96)
    return parsed
