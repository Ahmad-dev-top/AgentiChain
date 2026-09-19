import { DeploymentRecord, SupportedChain } from "./types";
import { SUPPORTED_CHAINS } from "./constants";

export function simulateChainDeployment(
  projectId: string,
  contractName: string,
  network: SupportedChain,
  constructorArgs: any = {}
): DeploymentRecord {
  const chain = SUPPORTED_CHAINS[network] || SUPPORTED_CHAINS["Base"];

  // Deterministic mock address generation
  const randHex = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
  const contractAddress = `0x${randHex}28d13f24${Math.random().toString(16).substring(2, 6)}`;
  const deployerAddress = "0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194";
  const txHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
  const blockNumber = Math.floor(18000000 + Math.random() * 900000);
  const gasUsed = `${(1200000 + Math.floor(Math.random() * 500000)).toLocaleString()} (${(0.00018 + Math.random() * 0.00005).toFixed(6)} ${chain.nativeCurrency})`;

  const explorerUrl = `${chain.explorerUrl}/address/${contractAddress}#code`;

  return {
    id: `dep-${Date.now()}`,
    projectId,
    contractName,
    network,
    chainId: chain.chainId,
    contractAddress,
    deployerAddress,
    transactionHash: txHash,
    blockNumber,
    gasUsed,
    verificationStatus: "verified",
    explorerUrl,
    constructorArgs,
    createdAt: new Date().toISOString(),
  };
}

export function generateVerificationPayload(
  contractName: string,
  solidityCode: string,
  compilerVersion: string = "v0.8.24+commit.e11b9ed9"
) {
  return {
    language: "Solidity",
    sources: {
      [`src/${contractName}.sol`]: {
        content: solidityCode,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"],
        },
      },
    },
    compilerVersion,
  };
}
