import { ContractSpec, ContractFile, SecurityAuditReport, SimulationResult, DeploymentRecord, MonitoringBotRecord, AgentTraceItem } from "./types";

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  standard: any;
  targetChain: any;
  spec: ContractSpec;
  contracts: ContractFile[];
  audit: SecurityAuditReport;
  simulation: SimulationResult;
  deployment: DeploymentRecord;
  bots: MonitoringBotRecord[];
  traces: AgentTraceItem[];
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "erc4626-yield-vault",
    name: "AgentiVault ERC4626 Tokenized Yield Vault",
    description: "Production-grade ERC4626 Yield Vault with virtual shares (inflation attack defense), dynamic performance fee, timelock withdrawal queue, emergency pause circuit breaker, and Chainlink oracle sanity checks.",
    standard: "ERC4626",
    targetChain: "Base",
    spec: {
      name: "AgentiVault4626",
      title: "AgentiVault Yield Optimizing Tokenized Vault",
      description: "Autonomous yield vault adhering to EIP-4626 with OpenZeppelin v5.0 security primitives.",
      standard: "ERC4626",
      targetChain: "Base",
      solidityVersion: "0.8.24",
      features: {
        pausable: true,
        ownable2Step: true,
        accessControl: true,
        reentrancyGuard: true,
        erc4626VirtualShares: true,
        permit2EIP2612: true,
        flashLoanProtection: true,
        timelockQueue: true,
        oracleIntegration: true,
        feeOnTransferSupport: false,
        gasOptimizationPass: true,
      },
      roles: [
        {
          name: "DEFAULT_ADMIN_ROLE",
          identifier: "0x0000000000000000000000000000000000000000000000000000000000000000",
          description: "Super-admin role capable of granting/revoking subordinate roles and setting timelocks.",
          allowedFunctions: ["grantRole", "revokeRole", "setPerformanceFee", "setFeeRecipient"],
        },
        {
          name: "STRATEGIST_ROLE",
          identifier: "0x13af34fc2141fa69116e25447a16f6b5b542031a0db6da4821a361efd1396a84",
          description: "Authorized strategist managing yield harvesting and rebalancing across approved protocols.",
          allowedFunctions: ["harvestYield", "rebalanceStrategy"],
        },
        {
          name: "PAUSER_ROLE",
          identifier: "0x65d7884672e2887e2f437f649bcb0f466fe604e0e60742dff9a0e3c96c103b70",
          description: "Emergency operator capable of triggering circuit breaker pause when anomalies occur.",
          allowedFunctions: ["pause", "unpause"],
        },
      ],
      invariants: [
        {
          id: "INV-01",
          name: "Conservation of Assets",
          expression: "totalAssets() >= underlyingToken.balanceOf(address(this)) + investedAssets",
          description: "Vault internal accounting must strictly match or stay solvent relative to real asset reserves.",
          verificationLevel: "SMT",
        },
        {
          id: "INV-02",
          name: "Zero Inflation Attack Immunity",
          expression: "convertToShares(assets) > 0 for all assets >= minDeposit",
          description: "Virtual shares offset prevents dead-share inflation attacks on initial liquidity providers.",
          verificationLevel: "Foundry",
        },
        {
          id: "INV-03",
          name: "Fee Cap Compliance",
          expression: "performanceFeeBps <= MAX_FEE_BPS (1000 = 10%)",
          description: "Performance fee is strictly bounded and cannot exceed 1000 basis points under any circumstances.",
          verificationLevel: "Certora",
        },
      ],
      customErrors: [
        { name: "ZeroAmount", params: [], description: "Reverts when deposited or withdrawn amount is 0" },
        { name: "InvalidFeeRecipient", params: [], description: "Reverts when fee recipient is address(0)" },
        { name: "ExceedsMaxFee", params: [{ name: "requestedFee", type: "uint256" }, { name: "maxAllowed", type: "uint256" }], description: "Reverts when requested fee exceeds limit" },
        { name: "SlippageExceeded", params: [{ name: "expected", type: "uint256" }, { name: "actual", type: "uint256" }], description: "Reverts when share yield does not satisfy slippage" },
        { name: "VaultIsPaused", params: [], description: "Reverts when operations are paused by security circuit breaker" },
      ],
      events: [
        { name: "YieldHarvested", params: [{ name: "amount", type: "uint256", indexed: false }, { name: "feeDeducted", type: "uint256", indexed: false }], description: "Emitted on strategy harvest" },
        { name: "PerformanceFeeUpdated", params: [{ name: "oldFeeBps", type: "uint256", indexed: false }, { name: "newFeeBps", type: "uint256", indexed: false }], description: "Emitted when fee is modified" },
        { name: "EmergencyWithdrawExecuted", params: [{ name: "caller", type: "address", indexed: true }, { name: "assetsReturned", type: "uint256", indexed: false }], description: "Emitted during emergency exit" },
      ],
      functions: [
        {
          name: "deposit",
          visibility: "external",
          mutability: "nonpayable",
          params: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }],
          returns: [{ name: "shares", type: "uint256" }],
          modifiers: ["nonReentrant", "whenNotPaused"],
          description: "Deposits underlying assets and mints vault shares with virtual share inflation protection.",
          emitsEvents: ["Deposit"],
          revertsWithErrors: ["ZeroAmount", "VaultIsPaused"],
        },
        {
          name: "harvestYield",
          visibility: "external",
          mutability: "nonpayable",
          params: [{ name: "minYieldExpected", type: "uint256" }],
          returns: [{ name: "harvestedAmount", type: "uint256" }],
          modifiers: ["onlyRole(STRATEGIST_ROLE)", "nonReentrant"],
          description: "Harvests accrued yield from external yield strategy and distributes performance fee.",
          emitsEvents: ["YieldHarvested"],
          revertsWithErrors: ["SlippageExceeded"],
        },
      ],
      stateVariables: [
        { name: "performanceFeeBps", type: "uint256", visibility: "public", slotPackingNotes: "Slot 0 (lower 16 bits)" },
        { name: "feeRecipient", type: "address", visibility: "public", slotPackingNotes: "Slot 0 (160 bits, packed with fee)" },
        { name: "lastHarvestTimestamp", type: "uint64", visibility: "public", slotPackingNotes: "Slot 0 (64 bits, packed into Slot 0)" },
        { name: "TOTAL_VIRTUAL_OFFSET", type: "uint256", visibility: "public", isConstant: true },
      ],
    },
    contracts: [
      {
        id: "c1",
        projectId: "erc4626-yield-vault",
        name: "AgentiVault4626.sol",
        filePath: "src/AgentiVault4626.sol",
        contractType: "core",
        version: 2,
        code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title AgentiVault4626 - Production-Grade ERC4626 Yield Vault
/// @author AgentiChain Autonomous Agent Suite
/// @notice Implements inflation-attack resistant ERC4626 tokenized vault with performance fees and emergency pause
contract AgentiVault4626 is ERC4626, AccessControlDefaultAdminRules, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /*//////////////////////////////////////////////////////////////
                                 ROLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 public constant MAX_FEE_BPS = 1000; // 10.00% max fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 private constant _DECIMALS_OFFSET = 3; // Virtual shares offset to protect against inflation attack

    /*//////////////////////////////////////////////////////////////
                            STORAGE LAYOUT
    //////////////////////////////////////////////////////////////*/
    // Slot 0 packed layout (16 + 160 + 64 = 240 bits <= 256 bits)
    uint16 public performanceFeeBps;
    address public feeRecipient;
    uint64 public lastHarvestTimestamp;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error ZeroDepositAmount();
    error ZeroWithdrawAmount();
    error InvalidFeeRecipient();
    error ExceedsMaxFee(uint256 requested, uint256 maxAllowed);
    error InsufficientSharesReceived(uint256 received, uint256 minimumExpected);
    error SlippageExceeded(uint256 expected, uint256 actual);

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event YieldHarvested(uint256 grossProfit, uint256 feeDeducted, uint256 netToVault);
    event PerformanceFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
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
    {
        if (initialFeeRecipient_ == address(0)) revert InvalidFeeRecipient();
        if (initialFeeBps_ > MAX_FEE_BPS) revert ExceedsMaxFee(initialFeeBps_, MAX_FEE_BPS);

        feeRecipient = initialFeeRecipient_;
        performanceFeeBps = initialFeeBps_;
        lastHarvestTimestamp = uint64(block.timestamp);

        _grantRole(STRATEGIST_ROLE, initialAdmin_);
        _grantRole(PAUSER_ROLE, initialAdmin_);
    }

    /*//////////////////////////////////////////////////////////////
                           ERC4626 OVERRIDES
    //////////////////////////////////////////////////////////////*/
    function _decimalsOffset() internal pure virtual override returns (uint8) {
        return uint8(_DECIMALS_OFFSET);
    }

    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        if (assets == 0) revert ZeroDepositAmount();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override nonReentrant whenNotPaused returns (uint256) {
        if (shares == 0) revert ZeroDepositAmount();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroWithdrawAmount();
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroWithdrawAmount();
        return super.redeem(shares, receiver, owner);
    }

    /*//////////////////////////////////////////////////////////////
                            STRATEGY YIELD
    //////////////////////////////////////////////////////////////*/
    function harvestYield(uint256 grossYield, uint256 minYieldExpected)
        external
        onlyRole(STRATEGIST_ROLE)
        nonReentrant
        returns (uint256 netYield)
    {
        if (grossYield < minYieldExpected) {
            revert SlippageExceeded(minYieldExpected, grossYield);
        }

        uint256 feeAmount = (grossYield * performanceFeeBps) / BPS_DENOMINATOR;
        netYield = grossYield - feeAmount;

        if (feeAmount > 0) {
            IERC20(asset()).safeTransfer(feeRecipient, feeAmount);
        }

        lastHarvestTimestamp = uint64(block.timestamp);
        emit YieldHarvested(grossYield, feeAmount, netYield);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function setPerformanceFee(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > MAX_FEE_BPS) revert ExceedsMaxFee(newFeeBps, MAX_FEE_BPS);
        uint16 oldFee = performanceFeeBps;
        performanceFeeBps = newFeeBps;
        emit PerformanceFeeUpdated(oldFee, newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
`,
      },
      {
        id: "c2",
        projectId: "erc4626-yield-vault",
        name: "IAgentiVault.sol",
        filePath: "src/interfaces/IAgentiVault.sol",
        contractType: "interface",
        version: 1,
        code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IAgentiVault is IERC4626 {
    function performanceFeeBps() external view returns (uint16);
    function feeRecipient() external view returns (address);
    function harvestYield(uint256 grossYield, uint256 minYieldExpected) external returns (uint256 netYield);
    function setPerformanceFee(uint16 newFeeBps) external;
    function setFeeRecipient(address newRecipient) external;
    function pause() external;
    function unpause() external;
}
`,
      },
      {
        id: "c3",
        projectId: "erc4626-yield-vault",
        name: "AgentiVault.t.sol",
        filePath: "test/AgentiVault.t.sol",
        contractType: "test",
        version: 1,
        code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AgentiVault4626} from "../src/AgentiVault4626.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract AgentiVaultTest is Test {
    AgentiVault4626 public vault;
    ERC20Mock public assetToken;

    address public admin = makeAddr("admin");
    address public strategist = makeAddr("strategist");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        vm.startPrank(admin);
        assetToken = new ERC20Mock();
        vault = new AgentiVault4626(
            assetToken,
            "Agenti Yield Vault",
            "agvUSDC",
            admin,
            feeRecipient,
            200 // 2.00% initial fee
        );
        vault.grantRole(vault.STRATEGIST_ROLE(), strategist);
        vm.stopPrank();

        assetToken.mint(alice, 100_000e18);
        assetToken.mint(bob, 100_000e18);

        vm.prank(alice);
        assetToken.approve(address(vault), type(uint256).max);

        vm.prank(bob);
        assetToken.approve(address(vault), type(uint256).max);
    }

    function test_InitialDepositVirtualSharesOffset() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1000e18, alice);
        assertGt(shares, 0, "Shares should be minted with virtual offset");
        assertEq(vault.totalAssets(), 1000e18, "Total assets should match deposited amount");
    }

    function testFuzz_DepositAndWithdrawalSolvency(uint256 amount) public {
        amount = bound(amount, 1e18, 50_000e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(amount, alice);

        vm.prank(alice);
        uint256 assetsWithdrawn = vault.redeem(shares, alice, alice);

        assertApproxEqAbs(assetsWithdrawn, amount, 1e3, "Redeemed assets must equal deposited within precision");
    }

    function test_InflationAttackResistance() public {
        // Attacker deposits 1 wei
        address attacker = makeAddr("attacker");
        assetToken.mint(attacker, 10_000e18);
        vm.startPrank(attacker);
        assetToken.approve(address(vault), type(uint256).max);
        vault.deposit(1, attacker);
        // Attacker donates directly to vault to artificially pump share price
        assetToken.transfer(address(vault), 1000e18);
        vm.stopPrank();

        // Victim deposits standard amount
        vm.prank(bob);
        uint256 bobShares = vault.deposit(100e18, bob);

        // Under OZ v5 virtual shares offset (_DECIMALS_OFFSET = 3), bob receives valid shares instead of 0
        assertGt(bobShares, 0, "Virtual offset protects against zero-share inflation attack");
    }

    function test_RevertWhen_Paused() public {
        vm.prank(admin);
        vault.pause();

        vm.expectRevert();
        vm.prank(alice);
        vault.deposit(100e18, alice);
    }
}
`,
      },
      {
        id: "c4",
        projectId: "erc4626-yield-vault",
        name: "Deploy.s.sol",
        filePath: "script/Deploy.s.sol",
        contractType: "script",
        version: 1,
        code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentiVault4626} from "../src/AgentiVault4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployVaultScript is Script {
    function run() external returns (AgentiVault4626 vault) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address usdcBase = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base USDC address

        vm.startBroadcast(deployerPrivateKey);

        vault = new AgentiVault4626(
            IERC20(usdcBase),
            "Agenti USD Yield Vault",
            "agvUSDC",
            deployer,
            deployer,
            200 // 2%
        );

        console2.log("AgentiVault4626 Deployed at:", address(vault));
        vm.stopBroadcast();
    }
}
`,
      },
    ],
    audit: {
      id: "aud-01",
      projectId: "erc4626-yield-vault",
      totalIssues: 3,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 1,
      infoCount: 1,
      gasCount: 1,
      securityScore: 98,
      isPatched: true,
      auditReportMd: `# AgentiChain Autonomous Security Audit Report
**Target**: AgentiVault4626.sol
**Security Score**: 98 / 100 (Grade: A+)
**Status**: Formally Verified & Auto-Patched

### Executive Summary
AgentiChain's Security Auditor and Formal Verification agents performed static analysis (Slither & Mythril emulation) and symbolic execution over \`AgentiVault4626\`. 

- **Critical Vulnerabilities**: 0 detected (ERC4626 virtual shares offset active, preventing SWC-101 inflation attacks).
- **High Vulnerabilities**: 0 detected (ReentrancyGuard and AccessControlDefaultAdminRules enforced).
- **Auto-Patched**: Added strict \`InvalidFeeRecipient\` check for zero-address sanitization and packed storage slot variables.`,
      vulnerabilities: [
        {
          id: "v-01",
          title: "Missing address(0) Sanitization in setFeeRecipient",
          detectorId: "missing-zero-check",
          severity: "Medium",
          cwe: "CWE-20",
          swcId: "SWC-105",
          filePath: "src/AgentiVault4626.sol",
          lineNumbers: [136, 137],
          description: "Updating fee recipient without zero-address validation could route yield to 0x0 burning fees permanently.",
          impact: "Irreversible fee loss if administrator accidentally passes 0x0.",
          recommendation: "Enforce `if (newRecipient == address(0)) revert InvalidFeeRecipient();`",
          patchDiff: `@@ -136,2 +136,3 @@
     function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
+        if (newRecipient == address(0)) revert InvalidFeeRecipient();
         feeRecipient = newRecipient;`,
          status: "patched",
        },
        {
          id: "v-02",
          title: "Storage Packing Optimization in State Slot 0",
          detectorId: "custom-error-gas-inefficiency",
          severity: "Gas",
          cwe: "CWE-400",
          swcId: "SWC-GAS",
          filePath: "src/AgentiVault4626.sol",
          lineNumbers: [36, 37, 38],
          description: "Packing `uint16 performanceFeeBps`, `address feeRecipient`, and `uint64 lastHarvestTimestamp` saves 20,000 gas on SSTORE.",
          impact: "Reduces contract deployment and state modification gas.",
          recommendation: "Pack uint16 + address (160) + uint64 into single 256-bit EVM storage slot.",
          patchDiff: `@@ -36,3 +36,3 @@
-    uint256 public performanceFeeBps;
-    address public feeRecipient;
-    uint256 public lastHarvestTimestamp;
+    uint16 public performanceFeeBps;
+    address public feeRecipient;
+    uint64 public lastHarvestTimestamp;`,
          status: "patched",
        },
        {
          id: "v-03",
          title: "Explicit Decimals Offset for Virtual Shares",
          detectorId: "erc4626-inflation-vault",
          severity: "Informational",
          cwe: "CWE-682",
          swcId: "SWC-101",
          filePath: "src/AgentiVault4626.sol",
          lineNumbers: [75, 77],
          description: "Virtual offset of 3 decimal digits provides 1000 virtual shares defense against first-depositor griefing.",
          impact: "Immunity to inflation sandwich attacks.",
          recommendation: "Override `_decimalsOffset()` returning uint8(3).",
          patchDiff: `@@ -75,2 +75,4 @@
+    function _decimalsOffset() internal pure virtual override returns (uint8) {
+        return uint8(_DECIMALS_OFFSET);
+    }`,
          status: "patched",
        },
      ],
      createdAt: new Date().toISOString(),
    },
    simulation: {
      id: "sim-01",
      projectId: "erc4626-yield-vault",
      simType: "fork_test",
      networkFork: "Base Mainnet (RPC Fork)",
      blockNumber: 18500200,
      totalTests: 8,
      passedTests: 8,
      failedTests: 0,
      durationMs: 412,
      status: "passed",
      tests: [
        { name: "test_InitialDepositVirtualSharesOffset", suite: "AgentiVaultTest", status: "PASS", durationMs: 24, gasUsed: 46210 },
        { name: "testFuzz_DepositAndWithdrawalSolvency", suite: "AgentiVaultTest", status: "PASS", durationMs: 142, gasUsed: 52140, fuzzRuns: 10000 },
        { name: "test_InflationAttackResistance", suite: "AgentiVaultTest", status: "PASS", durationMs: 65, gasUsed: 78920 },
        { name: "test_RevertWhen_Paused", suite: "AgentiVaultTest", status: "PASS", durationMs: 18, gasUsed: 21300 },
        { name: "test_HarvestYieldDistributesPerformanceFee", suite: "AgentiVaultTest", status: "PASS", durationMs: 42, gasUsed: 64120 },
        { name: "test_AccessControlAdminTimelock", suite: "AgentiVaultTest", status: "PASS", durationMs: 38, gasUsed: 31200 },
        { name: "test_ZeroDepositRevertsCustomError", suite: "AgentiVaultTest", status: "PASS", durationMs: 15, gasUsed: 8400 },
        { name: "test_SlippageExceededReverts", suite: "AgentiVaultTest", status: "PASS", durationMs: 22, gasUsed: 12500 },
      ],
      gasBenchmarks: [
        { functionName: "deposit(uint256,address)", minGas: 42100, avgGas: 45800, maxGas: 51200, callsCount: 250, optimizedAvgGas: 38400, savingsPercentage: 16.1 },
        { functionName: "withdraw(uint256,address,address)", minGas: 39500, avgGas: 43200, maxGas: 48900, callsCount: 250, optimizedAvgGas: 36900, savingsPercentage: 14.5 },
        { functionName: "harvestYield(uint256,uint256)", minGas: 58200, avgGas: 64120, maxGas: 71000, callsCount: 50, optimizedAvgGas: 54200, savingsPercentage: 15.4 },
        { functionName: "setPerformanceFee(uint16)", minGas: 12400, avgGas: 14200, maxGas: 15100, callsCount: 10, optimizedAvgGas: 8900, savingsPercentage: 37.3 },
      ],
      traceLogs: [
        "[INFO] Initializing Foundry local EVM environment...",
        "[INFO] Forking Base Mainnet state at block 18,500,200 via Alchemy RPC",
        "[TRACE] AgentiVault4626.constructor() -> Gas used: 1,842,100",
        "[PASS] test_InitialDepositVirtualSharesOffset (gas: 46210)",
        "[PASS] testFuzz_DepositAndWithdrawalSolvency (runs: 10000, μ: 52140, ~: 51900)",
        "[PASS] test_InflationAttackResistance (gas: 78920) -> Virtual shares offset verified!",
        "[PASS] test_RevertWhen_Paused (gas: 21300)",
        "[SUMMARY] Test result: ok. 8 passed; 0 failed; 0 ignored; finished in 412.00ms",
      ],
      createdAt: new Date().toISOString(),
    },
    deployment: {
      id: "dep-01",
      projectId: "erc4626-yield-vault",
      contractName: "AgentiVault4626",
      network: "Base",
      chainId: 8453,
      contractAddress: "0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24",
      deployerAddress: "0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194",
      transactionHash: "0x7a819b165f128be48b783cb78129032189d20c58e1781290bbff812903ea2910",
      blockNumber: 18500215,
      gasUsed: "1,842,100 (0.000184 ETH)",
      verificationStatus: "verified",
      explorerUrl: "https://basescan.org/address/0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24#code",
      constructorArgs: {
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        name: "Agenti USD Yield Vault",
        symbol: "agvUSDC",
        initialAdmin: "0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194",
        initialFeeRecipient: "0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194",
        initialFeeBps: 200,
      },
      createdAt: new Date().toISOString(),
    },
    bots: [
      {
        id: "bot-01",
        projectId: "erc4626-yield-vault",
        deploymentId: "dep-01",
        name: "Vault TVL Anomaly & Flash Loan Watcher",
        botType: "tvl_monitor",
        contractAddress: "0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24",
        network: "Base",
        targetEvent: "Deposit(address,address,uint256,uint256)",
        triggerCondition: "TVL drop > 15% in single block OR withdrawal > 500,000 USDC",
        actionType: "send_alert",
        status: "active",
        lastCheckedAt: new Date().toISOString(),
        eventsCaptured: 1420,
        alertsFired: 0,
        logs: [
          { timestamp: new Date(Date.now() - 3600000).toISOString(), level: "INFO", message: "Deposit detected: 50,000 USDC from 0x3819...4b01 (shares: 49,998 agvUSDC)" },
          { timestamp: new Date(Date.now() - 1800000).toISOString(), level: "INFO", message: "Harvest executed: +1,240 USDC yield distributed (fee: 24.8 USDC)" },
          { timestamp: new Date(Date.now() - 300000).toISOString(), level: "INFO", message: "Health check passed. Solvency ratio: 100.00%. Invariants valid." },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: "bot-02",
        projectId: "erc4626-yield-vault",
        deploymentId: "dep-01",
        name: "Emergency Circuit Breaker Trigger",
        botType: "circuit_breaker",
        contractAddress: "0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24",
        network: "Base",
        targetEvent: "SecurityAnomalyDetected(bytes32,uint256)",
        triggerCondition: "Oracle deviation > 3.5% from Chainlink secondary feed",
        actionType: "execute_pause",
        status: "active",
        lastCheckedAt: new Date().toISOString(),
        eventsCaptured: 890,
        alertsFired: 0,
        logs: [
          { timestamp: new Date(Date.now() - 7200000).toISOString(), level: "INFO", message: "Oracle feed healthy. Delta: 0.04% (Base USDC/USD vs Chainlink)" },
          { timestamp: new Date(Date.now() - 600000).toISOString(), level: "INFO", message: "Keepalive tick OK. Next check in 30 seconds." },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    traces: [
      {
        id: "tr-01",
        agentName: "Protocol Architect",
        agentRole: "System Architecture",
        action: "Specification Synthesis & Standards Selection",
        thought: "User requested a production-grade tokenized yield vault with 2% performance fee and emergency pause. Applying EIP-4626 with OpenZeppelin v5 AccessControlDefaultAdminRules and 3-day timelock.",
        status: "success",
        tokensUsed: 840,
        latencyMs: 310,
        createdAt: new Date(Date.now() - 25000).toISOString(),
      },
      {
        id: "tr-02",
        agentName: "Lead Solidity Engineer",
        agentRole: "Solidity 0.8.24",
        action: "Synthesizing AgentiVault4626.sol & Interface",
        thought: "Implementing virtual shares offset (_decimalsOffset = 3) to render inflation attacks mathematically impossible. Structuring custom errors instead of strings to reduce bytecode and gas.",
        status: "success",
        tokensUsed: 2150,
        latencyMs: 780,
        createdAt: new Date(Date.now() - 20000).toISOString(),
      },
      {
        id: "tr-03",
        agentName: "Security Auditor",
        agentRole: "Slither & Static Analysis",
        action: "Static Analysis & Vulnerability Scan",
        thought: "Identified missing address(0) validation in fee recipient setter. Auto-patching unified diff generated and verified. Security score elevated to 98/100.",
        status: "success",
        tokensUsed: 1420,
        latencyMs: 540,
        createdAt: new Date(Date.now() - 15000).toISOString(),
      },
      {
        id: "tr-04",
        agentName: "Foundry Test Engineer",
        agentRole: "Forge & Invariant Testing",
        action: "Compiling Foundry Test Suite & Invariant Harness",
        thought: "Constructed 10,000-run fuzz test suite testFuzz_DepositAndWithdrawalSolvency and explicit inflation attack exploit harness test_InflationAttackResistance.",
        status: "success",
        tokensUsed: 1980,
        latencyMs: 620,
        createdAt: new Date(Date.now() - 10000).toISOString(),
      },
      {
        id: "tr-05",
        agentName: "Gas Optimizer",
        agentRole: "Opcode & Storage Optimization",
        action: "Storage Packing & Calldata Optimization",
        thought: "Packed uint16 fee, address recipient, and uint64 timestamp into Slot 0. Gas benchmark demonstrates 16.1% deposit gas savings.",
        status: "success",
        tokensUsed: 920,
        latencyMs: 390,
        createdAt: new Date(Date.now() - 5000).toISOString(),
      },
    ],
  },
  {
    id: "liquid-restaking-protocol",
    name: "StakeShield Liquid Restaking Token (LRT)",
    description: "Multi-operator liquid restaking protocol with EigenLayer AVS delegation, dynamic epoch rebalancing, slashing insurance reserve, and instant unbonding liquidity queue.",
    standard: "RESTAKING",
    targetChain: "Ethereum",
    spec: {
      name: "StakeShieldLRT",
      title: "StakeShield Liquid Restaking Protocol",
      description: "Restakes deposited ETH across EigenLayer operator pods with synthetic rsETH share distribution.",
      standard: "RESTAKING",
      targetChain: "Ethereum",
      solidityVersion: "0.8.24",
      features: {
        pausable: true,
        ownable2Step: true,
        accessControl: true,
        reentrancyGuard: true,
        erc4626VirtualShares: true,
        permit2EIP2612: true,
        flashLoanProtection: true,
        timelockQueue: true,
        oracleIntegration: true,
        feeOnTransferSupport: false,
        gasOptimizationPass: true,
      },
      roles: [
        { name: "DEFAULT_ADMIN_ROLE", identifier: "0x00", description: "Admin for protocol parameters", allowedFunctions: ["setReserveRatio", "setOperator"] },
        { name: "KEEPER_ROLE", identifier: "0x22", description: "Executes automated epoch rebalances", allowedFunctions: ["rebalanceEpoch", "harvestRewards"] },
      ],
      invariants: [
        { id: "LRT-01", name: "Exchange Rate Monotonicity", expression: "rsEthRate(t) >= rsEthRate(t-1) - slashingDelta", description: "Exchange rate never decreases unless slashed", verificationLevel: "SMT" },
      ],
      customErrors: [
        { name: "InsufficientLiquidity", params: [], description: "Queue has insufficient instant liquidity" },
        { name: "UnbondingPeriodNotMet", params: [], description: "Timelock on withdrawal has not elapsed" },
      ],
      events: [
        { name: "Restaked", params: [{ name: "user", type: "address", indexed: true }, { name: "ethAmount", type: "uint256", indexed: false }], description: "Deposit ETH" },
        { name: "RewardsCompounded", params: [{ name: "totalReward", type: "uint256", indexed: false }], description: "Epoch rewards" },
      ],
      functions: [
        { name: "restakeETH", visibility: "external", mutability: "payable", params: [], returns: [{ name: "rsTokens", type: "uint256" }], modifiers: ["nonReentrant"], description: "Restakes native ETH", emitsEvents: ["Restaked"], revertsWithErrors: [] },
      ],
      stateVariables: [
        { name: "totalDelegatedETH", type: "uint256", visibility: "public" },
        { name: "slashingReserveRatio", type: "uint16", visibility: "public" },
      ],
    },
    contracts: [
      {
        id: "lrt-1",
        projectId: "liquid-restaking-protocol",
        name: "StakeShieldLRT.sol",
        filePath: "src/StakeShieldLRT.sol",
        contractType: "core",
        version: 1,
        code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract StakeShieldLRT is ERC20, Ownable2Step, ReentrancyGuard {
    uint256 public totalStakedETH;
    uint256 public constant MIN_DEPOSIT = 0.01 ether;

    error DepositTooSmall();
    error TransferFailed();

    event Restaked(address indexed user, uint256 ethAmount, uint256 rsSharesMinted);
    event EpochHarvested(uint256 rewardAmount);

    constructor(address initialOwner) ERC20("StakeShield Restaked ETH", "rsETH") Ownable(initialOwner) {}

    function restakeETH() external payable nonReentrant returns (uint256 shares) {
        if (msg.value < MIN_DEPOSIT) revert DepositTooSmall();
        
        if (totalSupply() == 0 || totalStakedETH == 0) {
            shares = msg.value;
        } else {
            shares = (msg.value * totalSupply()) / totalStakedETH;
        }

        totalStakedETH += msg.value;
        _mint(msg.sender, shares);
        emit Restaked(msg.sender, msg.value, shares);
    }

    receive() external payable {
        totalStakedETH += msg.value;
        emit EpochHarvested(msg.value);
    }
}
`,
      },
    ],
    audit: {
      id: "aud-02",
      projectId: "liquid-restaking-protocol",
      totalIssues: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 1,
      infoCount: 0,
      gasCount: 0,
      securityScore: 99,
      isPatched: true,
      auditReportMd: `# StakeShield LRT Audit
Security Score: 99 / 100
Zero critical vulnerabilities found. State accounting verified.`,
      vulnerabilities: [],
      createdAt: new Date().toISOString(),
    },
    simulation: {
      id: "sim-02",
      projectId: "liquid-restaking-protocol",
      simType: "anvil_local",
      networkFork: "Ethereum Mainnet",
      blockNumber: 19800000,
      totalTests: 4,
      passedTests: 4,
      failedTests: 0,
      durationMs: 280,
      status: "passed",
      tests: [
        { name: "test_RestakeETHMintsProportionalrsETH", suite: "StakeShieldTest", status: "PASS", durationMs: 25, gasUsed: 42000 },
        { name: "test_RewardAccrualIncreasesShareValue", suite: "StakeShieldTest", status: "PASS", durationMs: 35, gasUsed: 38000 },
      ],
      gasBenchmarks: [
        { functionName: "restakeETH()", minGas: 38000, avgGas: 42000, maxGas: 45000, callsCount: 100, optimizedAvgGas: 38000, savingsPercentage: 9.5 },
      ],
      traceLogs: ["[INFO] Forking Ethereum Mainnet...", "[PASS] test_RestakeETHMintsProportionalrsETH (gas: 42000)"],
      createdAt: new Date().toISOString(),
    },
    deployment: {
      id: "dep-02",
      projectId: "liquid-restaking-protocol",
      contractName: "StakeShieldLRT",
      network: "Ethereum",
      chainId: 1,
      contractAddress: "0x33A57fC97E43194B71C8F529e3D1e217036A5792",
      deployerAddress: "0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194",
      transactionHash: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
      blockNumber: 19800010,
      gasUsed: "1,250,000",
      verificationStatus: "verified",
      explorerUrl: "https://etherscan.io/address/0x33A57fC97E43194B71C8F529e3D1e217036A5792#code",
      createdAt: new Date().toISOString(),
    },
    bots: [
      {
        id: "bot-03",
        projectId: "liquid-restaking-protocol",
        name: "Validator Epoch Slashing Watcher",
        botType: "health_keeper",
        contractAddress: "0x33A57fC97E43194B71C8F529e3D1e217036A5792",
        network: "Ethereum",
        targetEvent: "EpochHarvested(uint256)",
        triggerCondition: "Epoch reward distribution < 90% expected",
        actionType: "send_alert",
        status: "active",
        lastCheckedAt: new Date().toISOString(),
        eventsCaptured: 540,
        alertsFired: 0,
        logs: [{ timestamp: new Date().toISOString(), level: "INFO", message: "Epoch 812 processed with 14.8 ETH rewards compounded." }],
        createdAt: new Date().toISOString(),
      },
    ],
    traces: [
      {
        id: "tr-lrt-1",
        agentName: "Protocol Architect",
        agentRole: "System Architecture",
        action: "Designed LRT token mechanics",
        thought: "Engineered synthetic exchange rate model for liquid staking rewards without rebasing.",
        status: "success",
        tokensUsed: 620,
        latencyMs: 250,
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "governor-dao-executive",
    name: "Decentralized Governor DAO with Timelock",
    description: "Full-featured on-chain governance suite with GovernorCountingSimple, TimelockController, ERC20Votes token, proposal execution threshold, and cancellation veto guards.",
    standard: "GOVERNOR",
    targetChain: "Arbitrum One",
    spec: {
      name: "AgentiGovernorDAO",
      title: "Agenti DAO Governor",
      description: "On-chain decentralized governor with timelock control.",
      standard: "GOVERNOR",
      targetChain: "Arbitrum One",
      solidityVersion: "0.8.24",
      features: {
        pausable: false,
        ownable2Step: true,
        accessControl: true,
        reentrancyGuard: true,
        erc4626VirtualShares: false,
        permit2EIP2612: true,
        flashLoanProtection: true,
        timelockQueue: true,
        oracleIntegration: false,
        feeOnTransferSupport: false,
        gasOptimizationPass: true,
      },
      roles: [
        { name: "PROPOSER_ROLE", identifier: "0x01", description: "Can propose DAO votes", allowedFunctions: ["propose"] },
        { name: "EXECUTOR_ROLE", identifier: "0x02", description: "Can execute queued proposals", allowedFunctions: ["execute"] },
      ],
      invariants: [
        { id: "GOV-01", name: "Timelock Delay Enforcement", expression: "executionTime >= queueTime + minDelay", description: "Timelock minimum delay strictly enforced", verificationLevel: "SMT" },
      ],
      customErrors: [],
      events: [],
      functions: [],
      stateVariables: [],
    },
    contracts: [
      {
        id: "gov-1",
        projectId: "governor-dao-executive",
        name: "AgentiGovernor.sol",
        filePath: "src/AgentiGovernor.sol",
        contractType: "core",
        version: 1,
        code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

contract AgentiGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("AgentiGovernor")
        GovernorSettings(7200 /* 1 day voting delay */, 50400 /* 1 week voting period */, 100_000e18 /* proposal threshold */)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4 /* 4% quorum */)
        GovernorTimelockControl(_timelock)
    {}

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function _queueOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint48)
    {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
    {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
`,
      },
    ],
    audit: {
      id: "aud-03",
      projectId: "governor-dao-executive",
      totalIssues: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      gasCount: 0,
      securityScore: 100,
      isPatched: true,
      auditReportMd: `# Agenti DAO Governor Audit
Score: 100 / 100. OpenZeppelin v5.0 compliant with zero vulnerabilities.`,
      vulnerabilities: [],
      createdAt: new Date().toISOString(),
    },
    simulation: {
      id: "sim-03",
      projectId: "governor-dao-executive",
      simType: "fork_test",
      networkFork: "Arbitrum One",
      blockNumber: 154000000,
      totalTests: 3,
      passedTests: 3,
      failedTests: 0,
      durationMs: 310,
      status: "passed",
      tests: [
        { name: "test_ProposalCreationAndVoteTallying", suite: "GovernorTest", status: "PASS", durationMs: 40, gasUsed: 120000 },
        { name: "test_TimelockExecutionDelayEnforced", suite: "GovernorTest", status: "PASS", durationMs: 45, gasUsed: 89000 },
      ],
      gasBenchmarks: [
        { functionName: "propose(...)", minGas: 95000, avgGas: 102000, maxGas: 115000, callsCount: 20, optimizedAvgGas: 95000, savingsPercentage: 6.8 },
      ],
      traceLogs: ["[INFO] Testing Governor on Arbitrum One fork...", "[PASS] test_ProposalCreationAndVoteTallying (gas: 120000)"],
      createdAt: new Date().toISOString(),
    },
    deployment: {
      id: "dep-03",
      projectId: "governor-dao-executive",
      contractName: "AgentiGovernor",
      network: "Arbitrum One",
      chainId: 42161,
      contractAddress: "0x89Fe2b1c4b7A276bCd390B7520e54d6F385412A8",
      deployerAddress: "0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194",
      transactionHash: "0x5c4d3e2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d",
      blockNumber: 154000020,
      gasUsed: "2,410,000",
      verificationStatus: "verified",
      explorerUrl: "https://arbiscan.io/address/0x89Fe2b1c4b7A276bCd390B7520e54d6F385412A8#code",
      createdAt: new Date().toISOString(),
    },
    bots: [
      {
        id: "bot-04",
        projectId: "governor-dao-executive",
        name: "DAO Proposal Lifecycle & Execution Keeper",
        botType: "health_keeper",
        contractAddress: "0x89Fe2b1c4b7A276bCd390B7520e54d6F385412A8",
        network: "Arbitrum One",
        targetEvent: "ProposalQueued(uint256,uint256)",
        triggerCondition: "Timelock delay elapsed -> auto trigger execution",
        actionType: "trigger_keeper",
        status: "active",
        lastCheckedAt: new Date().toISOString(),
        eventsCaptured: 64,
        alertsFired: 0,
        logs: [{ timestamp: new Date().toISOString(), level: "INFO", message: "Listening for DAO proposals on Arbitrum." }],
        createdAt: new Date().toISOString(),
      },
    ],
    traces: [
      {
        id: "tr-gov-1",
        agentName: "Protocol Architect",
        agentRole: "System Architecture",
        action: "Configured TimelockController & Governor parameters",
        thought: "Constructed 4% quorum threshold with 3-day timelock delay for non-bypassable security.",
        status: "success",
        tokensUsed: 800,
        latencyMs: 290,
        createdAt: new Date().toISOString(),
      },
    ],
  },
];
