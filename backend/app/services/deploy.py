import random
from datetime import datetime, timezone

from app.models.schemas import DeploymentRecord, SupportedChain

CHAINS = {
    "Base": {"chainId": 8453, "explorerUrl": "https://basescan.org", "nativeCurrency": "ETH"},
    "Base Sepolia": {"chainId": 84532, "explorerUrl": "https://sepolia.basescan.org", "nativeCurrency": "ETH"},
    "Ethereum": {"chainId": 1, "explorerUrl": "https://etherscan.io", "nativeCurrency": "ETH"},
    "Sepolia": {"chainId": 11155111, "explorerUrl": "https://sepolia.etherscan.io", "nativeCurrency": "SEP"},
    "Arbitrum One": {"chainId": 42161, "explorerUrl": "https://arbiscan.io", "nativeCurrency": "ETH"},
    "Arbitrum Sepolia": {"chainId": 421614, "explorerUrl": "https://sepolia.arbiscan.io", "nativeCurrency": "ETH"},
    "Optimism": {"chainId": 10, "explorerUrl": "https://optimistic.etherscan.io", "nativeCurrency": "ETH"},
    "Polygon": {"chainId": 137, "explorerUrl": "https://polygonscan.com", "nativeCurrency": "POL"},
    "Avalanche": {"chainId": 43114, "explorerUrl": "https://snowtrace.io", "nativeCurrency": "AVAX"},
    "BNB Chain": {"chainId": 56, "explorerUrl": "https://bscscan.com", "nativeCurrency": "BNB"},
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def simulate_chain_deployment(
    project_id: str,
    contract_name: str,
    network: SupportedChain,
    constructor_args=None,
) -> DeploymentRecord:
    chain = CHAINS.get(network, CHAINS["Base"])
    rand_hex = f"{random.getrandbits(32):08x}{random.getrandbits(32):08x}"
    contract_address = f"0x{rand_hex}28d13f24{random.getrandbits(16):04x}"
    tx_hash = f"0x{random.getrandbits(128):032x}{random.getrandbits(128):032x}"
    block_number = 18000000 + random.randint(0, 900000)
    gas_used = f"{(1200000 + random.randint(0, 500000)):,} ({0.00018 + random.random() * 0.00005:.6f} {chain['nativeCurrency']})"
    explorer = f"{chain['explorerUrl']}/address/{contract_address}#code"
    return DeploymentRecord(
        id=f"dep-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        projectId=project_id,
        contractName=contract_name,
        network=network,
        chainId=chain["chainId"],
        contractAddress=contract_address,
        deployerAddress="0x4F92Ac9B71C8F529e3D1e217036A57fC97E43194",
        transactionHash=tx_hash,
        blockNumber=block_number,
        gasUsed=gas_used,
        verificationStatus="pending",
        explorerUrl=explorer,
        constructorArgs=constructor_args or {},
        createdAt=_now(),
        simulated=True,
    )


def generate_verification_payload(contract_name: str, solidity_code: str, compiler_version: str = "v0.8.24+commit.e11b9ed9") -> dict:
    return {
        "language": "Solidity",
        "sources": {f"src/{contract_name}.sol": {"content": solidity_code}},
        "settings": {
            "optimizer": {"enabled": True, "runs": 200},
            "evmVersion": "cancun",
            "outputSelection": {"*": {"*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]}},
        },
        "compilerVersion": compiler_version,
        "note": "Payload is assembled locally. Explorer verification is not submitted.",
    }
