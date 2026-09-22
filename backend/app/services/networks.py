from __future__ import annotations

CHAINS: dict[str, dict] = {
    "Base": {
        "chainId": 8453,
        "rpcUrl": "https://mainnet.base.org",
        "explorerUrl": "https://basescan.org",
        "nativeCurrency": "ETH",
    },
    "Base Sepolia": {
        "chainId": 84532,
        "rpcUrl": "https://sepolia.base.org",
        "explorerUrl": "https://sepolia.basescan.org",
        "nativeCurrency": "ETH",
    },
    "Ethereum": {
        "chainId": 1,
        "rpcUrl": "https://cloudflare-eth.com",
        "explorerUrl": "https://etherscan.io",
        "nativeCurrency": "ETH",
    },
    "Sepolia": {
        "chainId": 11155111,
        "rpcUrl": "https://rpc.sepolia.org",
        "explorerUrl": "https://sepolia.etherscan.io",
        "nativeCurrency": "SEP",
    },
    "Arbitrum One": {
        "chainId": 42161,
        "rpcUrl": "https://arb1.arbitrum.io/rpc",
        "explorerUrl": "https://arbiscan.io",
        "nativeCurrency": "ETH",
    },
    "Arbitrum Sepolia": {
        "chainId": 421614,
        "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
        "explorerUrl": "https://sepolia.arbiscan.io",
        "nativeCurrency": "ETH",
    },
    "Optimism": {
        "chainId": 10,
        "rpcUrl": "https://mainnet.optimism.io",
        "explorerUrl": "https://optimistic.etherscan.io",
        "nativeCurrency": "ETH",
    },
    "Optimism Sepolia": {
        "chainId": 11155420,
        "rpcUrl": "https://sepolia.optimism.io",
        "explorerUrl": "https://sepolia-optimism.etherscan.io",
        "nativeCurrency": "ETH",
    },
    "Polygon": {
        "chainId": 137,
        "rpcUrl": "https://polygon-rpc.com",
        "explorerUrl": "https://polygonscan.com",
        "nativeCurrency": "POL",
    },
    "Avalanche": {
        "chainId": 43114,
        "rpcUrl": "https://api.avax.network/ext/bc/C/rpc",
        "explorerUrl": "https://snowtrace.io",
        "nativeCurrency": "AVAX",
    },
    "BNB Chain": {
        "chainId": 56,
        "rpcUrl": "https://bsc-dataseed.binance.org",
        "explorerUrl": "https://bscscan.com",
        "nativeCurrency": "BNB",
    },
}

RPC_BY_CHAIN_ID = {int(meta["chainId"]): str(meta["rpcUrl"]) for meta in CHAINS.values()}
CHAIN_ID_BY_NAME = {name: int(meta["chainId"]) for name, meta in CHAINS.items()}

RPC_CANDIDATES: dict[int, list[str]] = {
    8453: ["https://mainnet.base.org", "https://base-rpc.publicnode.com"],
    84532: ["https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"],
    1: ["https://cloudflare-eth.com", "https://ethereum-rpc.publicnode.com"],
    11155111: ["https://ethereum-sepolia-rpc.publicnode.com", "https://rpc.sepolia.org"],
    42161: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"],
    421614: ["https://sepolia-rollup.arbitrum.io/rpc", "https://arbitrum-sepolia-rpc.publicnode.com"],
    10: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"],
    11155420: ["https://sepolia.optimism.io", "https://optimism-sepolia-rpc.publicnode.com"],
    137: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"],
    43114: ["https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com"],
    56: ["https://bsc-dataseed.binance.org", "https://bsc-rpc.publicnode.com"],
}
