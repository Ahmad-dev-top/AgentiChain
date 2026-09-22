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
    "event_watcher": "All contract logs on local Anvil",
    "tvl_monitor": "Deposit / Withdraw logs on the local vault",
    "gas_spike_alert": "Local Anvil newHeads (not a public mempool)",
    "health_keeper": "paused() eth_call on local Anvil",
    "circuit_breaker": "Local contract logs; pause is explicit probe only",
}

TRIGGERS = {
    "event_watcher": "eth_subscribe logs on ws://127.0.0.1:8545, HTTP poll fallback",
    "tvl_monitor": "Local vault log on Anvil. Not a USD price feed.",
    "gas_spike_alert": "Anvil newHeads. Public gas oracles are not used.",
    "health_keeper": "paused() every few local blocks",
    "circuit_breaker": "Local log capture. Auto-pause is not broadcast.",
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
        id=f"bot-{stamp}",
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
        eventsCaptured=0,
        alertsFired=0,
        logs=[
            BotLog(timestamp=_now(), level="INFO", message="Keeper config saved. Attaching to local Anvil next."),
        ],
        createdAt=_now(),
        live=False,
        engine="anvil_keeper",
        note="Will watch local Anvil only. Not a public-chain WebSocket.",
    )
