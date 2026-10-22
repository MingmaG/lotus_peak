import 'server-only';

import type { ToolDefinition, WriteTool } from './operation';
import { CONTENT_TOOLS } from './tools/content';
import { DEPARTURE_TOOLS } from './tools/departures';
import { DESK_TOOLS } from './tools/desk';
import { TRIP_TOOLS } from './tools/trips';

/**
 * Every business tool this server offers, in the order a client lists them.
 *
 * The connection tools — `whoami`, `approval_status`, `approvals_list_mine` —
 * are not here: they are about the conversation rather than the company, take
 * no permission beyond the one that let the caller in, and are registered by
 * `server.ts` directly.
 *
 * About fifty tools, published in full to every connection. A client reads its
 * tool list once, when a conversation starts, and never again — so a tool that
 * is not in that list cannot be called in that conversation however it is
 * discovered later. At this size the whole list costs a few thousand tokens,
 * which is cheaper than any scheme for publishing part of it.
 */
export const TOOLS: ToolDefinition[] = [
  ...TRIP_TOOLS,
  ...DEPARTURE_TOOLS,
  ...CONTENT_TOOLS,
  ...DESK_TOOLS,
];

const BY_NAME = new Map<string, ToolDefinition>();
for (const tool of TOOLS) {
  /* Two tools with one name would publish whichever registered last, and
     approve the other one — fail at start-up instead. */
  if (BY_NAME.has(tool.name)) throw new Error(`Two MCP tools are called ${tool.name}.`);
  BY_NAME.set(tool.name, tool);
}

export function toolByName(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** The write a stored approval names, or undefined if it is no longer one. */
export function writeTool(name: string): WriteTool | undefined {
  const tool = BY_NAME.get(name);
  return tool?.kind === 'write' ? tool : undefined;
}
