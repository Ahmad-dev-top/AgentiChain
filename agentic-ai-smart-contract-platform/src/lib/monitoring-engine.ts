import { MonitoringBotRecord } from "./types";

export function createAutonomousBot(
  projectId: string,
  deploymentId: string,
  contractAddress: string,
  network: string,
  botType: "event_watcher" | "tvl_monitor" | "gas_spike_alert" | "health_keeper" | "circuit_breaker",
  name?: string
): MonitoringBotRecord {
  const botNames = {
    event_watcher: "Real-time WebSocket Event Ingestion Bot",
    tvl_monitor: "TVL Anomaly & Liquidity Outflow Watcher",
    gas_spike_alert: "Gas Price Anomaly & Frontrunning Alert Bot",
    health_keeper: "Autonomous State Keeper & Rebalancing Bot",
    circuit_breaker: "Automated Emergency Pause Circuit Breaker",
  };

  const targetEvents = {
    event_watcher: "All Emitted Protocol Events",
    tvl_monitor: "Deposit(address,address,uint256,uint256) | Withdraw(address,address,address,uint256,uint256)",
    gas_spike_alert: "Mempool Pending Transactions (Gas > 150 Gwei)",
    health_keeper: "EpochHarvestNeeded() | RebalanceTriggered()",
    circuit_breaker: "OracleAnomalyDetected() | HighSeverityInvariantRevert()",
  };

  const triggerConditions = {
    event_watcher: "Continuous real-time block streaming via RPC WebSocket",
    tvl_monitor: "Outflow > 100,000 USD OR single block TVL delta > 12%",
    gas_spike_alert: "Gas fee spike > 200% above 24h rolling median",
    health_keeper: "Harvest delta > 6 hours OR unharvested yield > $500",
    circuit_breaker: "Oracle spot divergence > 3.0% from TWAP secondary feed",
  };

  const actionTypes: Record<string, "send_alert" | "execute_pause" | "rebalance" | "trigger_keeper"> = {
    event_watcher: "send_alert",
    tvl_monitor: "send_alert",
    gas_spike_alert: "send_alert",
    health_keeper: "trigger_keeper",
    circuit_breaker: "execute_pause",
  };

  return {
    id: `bot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    projectId,
    deploymentId,
    name: name || botNames[botType],
    botType,
    contractAddress,
    network,
    targetEvent: targetEvents[botType],
    triggerCondition: triggerConditions[botType],
    actionType: actionTypes[botType],
    status: "active",
    lastCheckedAt: new Date().toISOString(),
    eventsCaptured: Math.floor(100 + Math.random() * 500),
    alertsFired: 0,
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Autonomous bot initialized and listening to ${network} RPC.`,
      },
      {
        timestamp: new Date(Date.now() + 500).toISOString(),
        level: "INFO",
        message: `Subscribed to filter on address: ${contractAddress}`,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}
