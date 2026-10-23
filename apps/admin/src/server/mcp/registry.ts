import 'server-only';

import type { ToolDefinition, WriteTool } from './operation';
import { CONTENT_TOOLS } from './tools/content';
import { DEPARTURE_TOOLS } from './tools/departures';
import { DESK_TOOLS } from './tools/desk';
import { TRIP_TOOLS } from './tools/trips';

/**
 * Every capability the panel offers an AI client.
 *
 * None of these is in a client's tool list. They are found with
 * `admin_search`, described with `admin_describe` and run with `admin_call`,
 * so this list can grow to hundreds without costing a conversation anything
 * it does not use — see `buildMcpServer`. The discovery and conversation
 * tools themselves are registered by `server.ts`.
 *
 * Adding a capability is one definition in a file under `tools/`, added to
 * that file's list. Its discovery metadata is compulsory, and the checks
 * below run when this module loads, so a capability that would be ambiguous
 * to find stops the server starting rather than misrouting a call.
 */
export const TOOLS: ToolDefinition[] = [
  ...TRIP_TOOLS,
  ...DEPARTURE_TOOLS,
  ...CONTENT_TOOLS,
  ...DESK_TOOLS,
];

const BY_NAME = new Map<string, ToolDefinition>();
const ALIASES = new Map<string, string>();

for (const tool of TOOLS) {
  /* Two capabilities with one name would run whichever registered last and
     approve the other one. */
  if (BY_NAME.has(tool.name)) throw new Error(`Two MCP capabilities are called ${tool.name}.`);
  if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) throw new Error(`${tool.name} is not a snake_case name.`);
  if (!tool.description.trim()) throw new Error(`${tool.name} has no description to search.`);
  BY_NAME.set(tool.name, tool);
}

for (const tool of TOOLS) {
  for (const alias of tool.discovery.aliases ?? []) {
    /* An alias resolves in `admin_call`, so one shared by two capabilities, or
       one that is another capability's real name, would run the wrong one. */
    if (BY_NAME.has(alias)) throw new Error(`${tool.name}'s alias ${alias} is another capability's name.`);
    const owner = ALIASES.get(alias);
    if (owner && owner !== tool.name) {
      throw new Error(`${alias} is an alias of both ${owner} and ${tool.name}.`);
    }
    ALIASES.set(alias, tool.name);
  }
}

export function toolByName(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** The capability an alias stands for — somebody's reasonable guess at a name. */
export function toolByAlias(alias: string): ToolDefinition | undefined {
  const name = ALIASES.get(alias);
  return name ? BY_NAME.get(name) : undefined;
}

/** The write a stored approval names, or undefined if it is no longer one. */
export function writeTool(name: string): WriteTool | undefined {
  const tool = BY_NAME.get(name);
  return tool?.kind === 'write' ? tool : undefined;
}
