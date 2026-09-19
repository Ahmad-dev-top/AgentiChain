import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  contractStandard: text("contract_standard").notNull().default("ERC4626"),
  targetChain: text("target_chain").notNull().default("Base"),
  solidityVersion: text("solidity_version").notNull().default("0.8.24"),
  status: text("status").notNull().default("draft"),
  specJson: jsonb("spec_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  contractType: text("contract_type").notNull().default("core"), // core, interface, test, script, library
  code: text("code").notNull(),
  version: integer("version").notNull().default(1),
  abi: jsonb("abi"),
  bytecode: text("bytecode"),
  astJson: jsonb("ast_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSessions = pgTable("agent_sessions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sessionName: text("session_name").notNull(),
  currentStage: text("current_stage").notNull().default("intent_parsing"),
  status: text("status").notNull().default("idle"), // idle, running, completed, failed
  activeAgent: text("active_agent").default("Protocol Architect"),
  totalTokens: integer("total_tokens").notNull().default(0),
  totalLatencyMs: integer("total_latency_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentTraces = pgTable("agent_traces", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => agentSessions.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  agentRole: text("agent_role").notNull(),
  action: text("action").notNull(),
  thought: text("thought").notNull(),
  inputPayload: jsonb("input_payload"),
  outputPayload: jsonb("output_payload"),
  status: text("status").notNull().default("success"), // success, warning, error, in_progress
  tokensUsed: integer("tokens_used").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const securityAudits = pgTable("security_audits", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contractId: text("contract_id"),
  totalIssues: integer("total_issues").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  highCount: integer("high_count").notNull().default(0),
  mediumCount: integer("medium_count").notNull().default(0),
  lowCount: integer("low_count").notNull().default(0),
  infoCount: integer("info_count").notNull().default(0),
  gasCount: integer("gas_count").notNull().default(0),
  securityScore: integer("security_score").notNull().default(100),
  auditReportMd: text("audit_report_md"),
  isPatched: boolean("is_patched").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vulnerabilities = pgTable("vulnerabilities", {
  id: text("id").primaryKey(),
  auditId: text("audit_id").notNull().references(() => securityAudits.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detectorId: text("detector_id").notNull(),
  severity: text("severity").notNull(), // Critical, High, Medium, Low, Informational, Gas
  cwe: text("cwe"),
  swcId: text("swc_id"),
  filePath: text("file_path").notNull(),
  lineNumbers: jsonb("line_numbers"), // [45, 46]
  description: text("description").notNull(),
  impact: text("impact").notNull(),
  recommendation: text("recommendation").notNull(),
  patchDiff: text("patch_diff"),
  status: text("status").notNull().default("open"), // open, patched, suppressed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const simulations = pgTable("simulations", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  simType: text("sim_type").notNull().default("anvil_local"), // anvil_local, fork_test, fuzz_test, gas_benchmark
  networkFork: text("network_fork").default("Base Mainnet"),
  blockNumber: integer("block_number").default(18500200),
  totalTests: integer("total_tests").notNull().default(0),
  passedTests: integer("passed_tests").notNull().default(0),
  failedTests: integer("failed_tests").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  gasReport: jsonb("gas_report"),
  traceLogs: jsonb("trace_logs"),
  status: text("status").notNull().default("passed"), // passed, failed, running
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deployments = pgTable("deployments", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contractName: text("contract_name").notNull(),
  network: text("network").notNull(),
  chainId: integer("chain_id").notNull(),
  contractAddress: text("contract_address").notNull(),
  deployerAddress: text("deployer_address").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  blockNumber: integer("block_number").notNull(),
  gasUsed: text("gas_used").notNull(),
  verificationStatus: text("verification_status").notNull().default("verified"), // verified, pending, failed
  explorerUrl: text("explorer_url").notNull(),
  constructorArgs: jsonb("constructor_args"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monitoringBots = pgTable("monitoring_bots", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  deploymentId: text("deployment_id"),
  name: text("name").notNull(),
  botType: text("bot_type").notNull().default("event_watcher"), // event_watcher, tvl_monitor, gas_spike_alert, health_keeper, circuit_breaker
  contractAddress: text("contract_address").notNull(),
  network: text("network").notNull(),
  targetEvent: text("target_event").notNull(),
  triggerCondition: text("trigger_condition").notNull(),
  actionType: text("action_type").notNull().default("send_alert"), // send_alert, execute_pause, rebalance, trigger_keeper
  status: text("status").notNull().default("active"), // active, paused, triggered, error
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  eventsCaptured: integer("events_captured").notNull().default(0),
  alertsFired: integer("alerts_fired").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const telemetryLogs = pgTable("telemetry_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  category: text("category").notNull(), // agent, compiler, audit, simulation, deployment, bot, system
  level: text("level").notNull().default("info"), // info, warn, error, debug
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
