from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from app.core.errors import ApiError
from app.models.schemas import BotLog, MonitoringBotRecord, ProjectDetail
from app.services.toolchain import (
    ANVIL_CHAIN_ID,
    ANVIL_RPC,
    PAUSED_SELECTOR,
    PAUSE_SELECTOR,
    UNPAUSE_SELECTOR,
    anvil_chain_id,
    ensure_anvil,
    rpc_block_number,
    rpc_call,
    rpc_get_logs,
    rpc_receipt,
    rpc_send_local,
)

ANVIL_WS = "ws://127.0.0.1:8545"
MAX_LOGS = 40


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log(level: str, message: str, payload=None) -> BotLog:
    return BotLog(timestamp=_now(), level=level, message=message, payload=payload)


class KeeperHub:
    def __init__(self) -> None:
        self.bots: dict[str, MonitoringBotRecord] = {}
        self.transport = "starting"
        self.status = "starting"
        self._task: Optional[asyncio.Task] = None
        self._last_block = 0
        self._lock = asyncio.Lock()

    def status_payload(self) -> dict:
        return {
            "status": self.status,
            "transport": self.transport,
            "bots": len(self.bots),
            "rpc": ANVIL_RPC,
            "chainId": ANVIL_CHAIN_ID,
            "note": "Keepers subscribe to local Anvil only. They do not watch public RPCs or auto-broadcast pause.",
        }

    def merge(self, bot: MonitoringBotRecord) -> MonitoringBotRecord:
        live = self.bots.get(bot.id)
        return live if live is not None else bot

    def overlay_project(self, project: ProjectDetail) -> ProjectDetail:
        project.bots = [self.merge(bot) for bot in project.bots]
        return project

    def register(self, bot: MonitoringBotRecord) -> MonitoringBotRecord:
        existing = self.bots.get(bot.id)
        if existing is not None:
            existing.contractAddress = bot.contractAddress or existing.contractAddress
            existing.live = True
            existing.engine = "anvil_keeper"
            existing.transport = self.transport
            existing.status = existing.status if existing.status != "error" else "active"
            return existing
        bot.eventsCaptured = bot.eventsCaptured or 0
        bot.alertsFired = bot.alertsFired or 0
        bot.live = True
        bot.engine = "anvil_keeper"
        bot.transport = self.transport
        bot.note = f"Watching local Anvil ({ANVIL_RPC}, chainId {ANVIL_CHAIN_ID}). Not connected to {bot.network} public RPC."
        bot.status = "active"
        bot.lastCheckedAt = _now()
        bot.logs = [
            _log("INFO", f"Keeper attached to local Anvil via {self.transport}."),
            _log("INFO", f"Filter address {bot.contractAddress}. Public mempool watchers are not enabled."),
            *list(bot.logs or []),
        ][:MAX_LOGS]
        self.bots[bot.id] = bot
        return bot

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="anvil-keeper")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self.status = "stopped"

    async def _run(self) -> None:
        while True:
            try:
                await asyncio.to_thread(ensure_anvil)
                chain = await asyncio.to_thread(anvil_chain_id)
                if chain != ANVIL_CHAIN_ID:
                    self.status = "wrong_chain"
                    self.transport = "blocked"
                    await asyncio.sleep(2)
                    continue
                self._last_block = await asyncio.to_thread(rpc_block_number)
                if await self._ws_loop():
                    continue
                await self._http_loop()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.status = "error"
                self.transport = "retry"
                self._append_all("WARN", f"Keeper loop retry: {exc}")
                await asyncio.sleep(2)

    async def _ws_loop(self) -> bool:
        try:
            import websockets
        except ImportError:
            return False
        try:
            async with websockets.connect(ANVIL_WS, open_timeout=5, close_timeout=2, ping_interval=None) as ws:
                self.transport = "anvil_ws"
                self.status = "live"
                self._touch_transport()
                await ws.send(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_subscribe", "params": ["logs", {}]}))
                await ws.send(json.dumps({"jsonrpc": "2.0", "id": 2, "method": "eth_subscribe", "params": ["newHeads"]}))
                async for raw in ws:
                    message = json.loads(raw)
                    params = message.get("params") or {}
                    result = params.get("result")
                    if not isinstance(result, dict):
                        continue
                    if "topics" in result and "address" in result:
                        await self._on_log(result)
                    elif "number" in result or "baseFeePerGas" in result:
                        await self._on_head(result)
            return True
        except asyncio.CancelledError:
            raise
        except Exception:
            return False

    async def _http_loop(self) -> None:
        self.transport = "anvil_poll"
        self.status = "live"
        self._touch_transport()
        while True:
            current = await asyncio.to_thread(rpc_block_number)
            if current > self._last_block:
                addresses = list({bot.contractAddress for bot in self.bots.values() if bot.contractAddress})
                logs = await asyncio.to_thread(rpc_get_logs, self._last_block + 1, current, addresses or None)
                for item in logs:
                    if isinstance(item, dict):
                        await self._on_log(item)
                await self._on_head({"number": hex(current)})
                self._last_block = current
            else:
                for bot in list(self.bots.values()):
                    bot.lastCheckedAt = _now()
                    bot.transport = self.transport
            await asyncio.sleep(0.4)

    def _touch_transport(self) -> None:
        for bot in self.bots.values():
            bot.transport = self.transport
            bot.engine = "anvil_keeper"
            bot.live = True
            bot.note = f"Watching local Anvil ({ANVIL_RPC}, chainId {ANVIL_CHAIN_ID}) over {self.transport}."

    def _append(self, bot: MonitoringBotRecord, level: str, message: str, payload=None) -> None:
        bot.logs = [_log(level, message, payload), *list(bot.logs or [])][:MAX_LOGS]
        bot.lastCheckedAt = _now()

    def _append_all(self, level: str, message: str) -> None:
        for bot in self.bots.values():
            self._append(bot, level, message)

    async def _on_log(self, log: dict) -> None:
        address = str(log.get("address") or "").lower()
        topics = [str(item).lower() for item in (log.get("topics") or [])]
        tx_hash = str(log.get("transactionHash") or "")
        async with self._lock:
            for bot in self.bots.values():
                if (bot.contractAddress or "").lower() != address:
                    continue
                if bot.botType in {"gas_spike_alert"}:
                    continue
                bot.eventsCaptured += 1
                bot.live = True
                self._append(bot, "INFO", f"Anvil log {tx_hash[:18] or address[:10]} topic0={(topics[0][:10] + '…') if topics else 'none'}", log)
                if bot.botType == "tvl_monitor":
                    bot.alertsFired += 1
                    self._append(bot, "WARN", "Local vault log captured. This is not a USD TVL feed.")
                if bot.botType == "circuit_breaker":
                    bot.alertsFired += 1
                    bot.status = "triggered"
                    self._append(bot, "WARN", "Circuit breaker noted a local log. Auto-pause is not broadcast; use the Anvil probe to pause explicitly.")

    async def _on_head(self, head: dict) -> None:
        number_hex = head.get("number")
        block_number = int(number_hex, 16) if isinstance(number_hex, str) else 0
        base_fee = head.get("baseFeePerGas")
        async with self._lock:
            for bot in self.bots.values():
                bot.lastCheckedAt = _now()
                bot.live = True
                if bot.botType == "gas_spike_alert":
                    bot.eventsCaptured += 1
                    self._append(bot, "INFO", f"Anvil new head {block_number} baseFee={base_fee or 'n/a'}. Not a public mempool feed.")
                if bot.botType == "health_keeper" and block_number and block_number % 5 == 0:
                    try:
                        paused = await asyncio.to_thread(rpc_call, bot.contractAddress, PAUSED_SELECTOR)
                        bot.eventsCaptured += 1
                        self._append(bot, "INFO", f"Health check paused()={paused[-1:] if paused else '?'}")
                    except Exception as exc:
                        self._append(bot, "ERROR", f"Health eth_call failed: {exc}")

    async def probe(self, project_id: str) -> tuple[str, list[MonitoringBotRecord]]:
        bots = [bot for bot in self.bots.values() if bot.projectId == project_id]
        if not bots:
            raise ApiError("No live keeper is registered for this project", 400, "missing_keeper")
        address = bots[0].contractAddress
        paused = await asyncio.to_thread(rpc_call, address, PAUSED_SELECTOR)
        selector = UNPAUSE_SELECTOR if paused.endswith("1") else PAUSE_SELECTOR
        tx_hash = await asyncio.to_thread(rpc_send_local, address, selector)
        for bot in bots:
            self._append(bot, "INFO", f"Local Anvil probe sent {selector} tx={tx_hash}")
        receipt = await asyncio.to_thread(rpc_receipt, tx_hash)
        block_hex = receipt.get("blockNumber") if isinstance(receipt, dict) else None
        if isinstance(block_hex, str):
            block = int(block_hex, 16)
            logs = await asyncio.to_thread(rpc_get_logs, block, block, [address])
            for item in logs:
                if isinstance(item, dict):
                    await self._on_log(item)
        else:
            await asyncio.sleep(0.8)
        return tx_hash, bots


keeper_hub = KeeperHub()
