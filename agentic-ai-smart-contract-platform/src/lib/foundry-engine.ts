import { ForgeTestResult, GasBenchmarkItem, SimulationResult } from "./types";

export function runFoundrySimulation(
  contractName: string,
  projectId: string = "proj-temp",
  networkFork: string = "Base Mainnet"
): SimulationResult {
  const tests: ForgeTestResult[] = [
    {
      name: "test_InitialDepositVirtualSharesOffset",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 18,
      gasUsed: 46210,
      trace: [
        {
          id: "t-1",
          contract: contractName,
          method: "deposit",
          args: ["1000000000000000000000", "0xAlice..."],
          returnValue: "1000000000000000000000",
          gasUsed: 46210,
          status: "success",
          depth: 1,
        },
      ],
    },
    {
      name: "testFuzz_DepositAndWithdrawalSolvency",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 145,
      gasUsed: 52140,
      fuzzRuns: 10000,
    },
    {
      name: "test_InflationAttackResistance",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 62,
      gasUsed: 78920,
    },
    {
      name: "test_RevertWhen_Paused",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 14,
      gasUsed: 21300,
    },
    {
      name: "test_AccessControlAdminTimelock",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 29,
      gasUsed: 31200,
    },
    {
      name: "test_ZeroDepositRevertsCustomError",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 12,
      gasUsed: 8400,
    },
    {
      name: "test_GasOptimizedStorageSlot0",
      suite: `${contractName}Test`,
      status: "PASS",
      durationMs: 19,
      gasUsed: 14200,
    },
  ];

  const gasBenchmarks: GasBenchmarkItem[] = [
    {
      functionName: "deposit(uint256,address)",
      minGas: 42100,
      avgGas: 45800,
      maxGas: 51200,
      callsCount: 500,
      optimizedAvgGas: 38400,
      savingsPercentage: 16.1,
    },
    {
      functionName: "withdraw(uint256,address,address)",
      minGas: 39500,
      avgGas: 43200,
      maxGas: 48900,
      callsCount: 500,
      optimizedAvgGas: 36900,
      savingsPercentage: 14.5,
    },
    {
      functionName: "harvestYield(uint256,uint256)",
      minGas: 58200,
      avgGas: 64120,
      maxGas: 71000,
      callsCount: 50,
      optimizedAvgGas: 54200,
      savingsPercentage: 15.4,
    },
    {
      functionName: "setPerformanceFee(uint16)",
      minGas: 12400,
      avgGas: 14200,
      maxGas: 15100,
      callsCount: 10,
      optimizedAvgGas: 8900,
      savingsPercentage: 37.3,
    },
  ];

  const traceLogs = [
    `[INFO] Bootstrapping Foundry Anvil local EVM runtime (v0.2.0)...`,
    `[INFO] Forking ${networkFork} state at block 18,500,200 via RPC provider`,
    `[COMPILER] Solc 0.8.24 compiling contracts with via-ir=true (optimizer_runs: 200)...`,
    `[TRACE] Deploying ${contractName} bytecode size: 4.82 KB (under 24KB Spurious Dragon limit)`,
    `[PASS] test_InitialDepositVirtualSharesOffset (gas: 46210)`,
    `[PASS] testFuzz_DepositAndWithdrawalSolvency (runs: 10000, μ: 52140, ~: 51900)`,
    `[PASS] test_InflationAttackResistance (gas: 78920) -> Virtual shares offset successfully defended initial liquidity!`,
    `[PASS] test_RevertWhen_Paused (gas: 21300)`,
    `[PASS] test_AccessControlAdminTimelock (gas: 31200)`,
    `[PASS] test_ZeroDepositRevertsCustomError (gas: 8400)`,
    `[PASS] test_GasOptimizedStorageSlot0 (gas: 14200)`,
    `[SUMMARY] Suite execution complete: 7 passed; 0 failed; 0 skipped. Gas benchmark saved 17.2% overall.`,
  ];

  return {
    id: `sim-${Date.now()}`,
    projectId,
    simType: "fork_test",
    networkFork,
    blockNumber: 18500200,
    totalTests: tests.length,
    passedTests: tests.length,
    failedTests: 0,
    durationMs: 380,
    status: "passed",
    tests,
    gasBenchmarks,
    traceLogs,
    createdAt: new Date().toISOString(),
  };
}
