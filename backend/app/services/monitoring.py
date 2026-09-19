import random
from datetime import datetime, timezone

from app.models.schemas import BotLog, MonitoringBotRecord

BOT_NAMES = {
    "event_watcher": "Real-time WebSocket Event Ingestion Bot",
    "tvl_monitor": "TVL Anomaly & Liquidity Outflow Watcher",
    "gas_spike_alert": "Gas Price Anomaly & Frontrunning Alert Bot",
    "health_keeper": "Autonomous State Keeper & Rebalancing Bot",
    "circuit_breaker": "Automated Emergency Pause Circuit Breaker",
}

TARGET_EVENTS = {
    "event_watcher": "All Emitted Protocol Events",
    "tvl_monitor": "Deposit(address,address,uint256,uint256) | Withdraw(address,address,address,uint256,uint256)",
    "gas_spike_alert": "Mempool Pending Transactions (Gas > 150 Gwei)",
    "health_keeper": "EpochHarvestNeeded() | RebalanceTriggered()",
    "circuit_breaker": "OracleAnomalyDetected() | HighSeverityInvariantRevert()",
}

TRIGGERS = {
    "event_watcher": "Continuous real-time block streaming via RPC WebSocket",
    "tvl_monitor": "Outflow > 100,000 USD OR single block TVL delta > 12%",
    "gas_spike_alert": "Gas fee spike > 200% above 24h rolling median",
    "health_keeper": "Harvest delta > 6 hours OR unharvested yield > $500",
    "circuit_breaker": "Oracle spot divergence > 3.0% from TWAP secondary feed",
}

ACTIONS = {
    "event_watcher": "send_alert",
    "tvl_monitor": "send_alert",
    "gas_spike_alert": "send_alert",
    "health_keeper": "trigger_keeper",
    "circuit_breaker": "execute_pause",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_autonomous_bot(
    project_id: str,
    deployment_id: str,
    contract_address: str,
    network: str,
    bot_type: str,
    name: str | None = None,
) -> MonitoringBotRecord:
    stamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    return MonitoringBotRecord(
        id=f"bot-{stamp}-{random.randint(0, 999)}",
        projectId=project_id,
        deploymentId=deployment_id,
        name=name or BOT_NAMES[bot_type],
        botType=bot_type,  # type: ignore[arg-type]
        contractAddress=contract_address,
        network=network,
        targetEvent=TARGET_EVENTS[bot_type],
        triggerCondition=TRIGGERS[bot_type],
        actionType=ACTIONS[bot_type],  # type: ignore[arg-type]
        status="active",
        lastCheckedAt=_now(),
        eventsCaptured=100 + random.randint(0, 500),
        alertsFired=0,
        logs=[
            BotLog(timestamp=_now(), level="INFO", message=f"Autonomous bot initialized and listening to {network} RPC."),
            BotLog(timestamp=_now(), level="INFO", message=f"Subscribed to filter on address: {contract_address}"),
        ],
        createdAt=_now(),
    )
