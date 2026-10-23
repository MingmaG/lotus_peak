import 'server-only';

import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import { z } from 'zod';

import { can } from '@/lib/auth/permissions';

import type { McpContext } from '../context';
import { McpToolError } from '../errors';
import type { ToolDefinition, WriteTool } from '../operation';
import { approvalRequired, type AiPolicy } from '../policy';
import { TOOLS, toolByAlias, toolByName } from '../registry';
import {
  DOMAINS,
  OPERATION_WORDS,
  SECTIONS,
  type Domain,
  type Section,
} from './taxonomy';

/**
 * Finding a capability: the map, the search, and the full description.
 *
 * No business tool is in a client's tool list. A client reads that list once,
 * when a conversation starts, and pays for every definition in it in every
 * conversation — so it holds the discovery core alone, and the catalogue
 * behind it can grow to hundreds of capabilities without costing a
 * conversation more than the handful it uses.
 *
 * The rule that makes a small surface safe is that **nothing is hidden**.
 * Search finds a capability whether or not the caller may use it, and says
 * which permission is missing. A model is better served by "this exists and
 * you lack `trips.publish`" than by silence, which it reads as "this panel
 * cannot do that" and works around.
 */

/* -------------------------------------------------------------------------- */
/*  What one capability looks like from outside                                */
/* -------------------------------------------------------------------------- */

/** The first sentence of a description: what a search result shows. */
export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

type Approval = 'never' | 'always' | 'when the record is live, or a price or date moves';

function approvalFor(tool: ToolDefinition, policy: AiPolicy): Approval {
  if (tool.kind === 'read') return 'never';
  if (approvalRequired(tool, policy).required) return 'always';
  return (tool as WriteTool).escalates ? 'when the record is live, or a price or date moves' : 'never';
}

function access(tool: ToolDefinition, ctx: McpContext) {
  const scope = tool.kind === 'read' ? 'mcp:read' : 'mcp:write';
  if (!ctx.scopes.includes(scope)) return { allowed: false, missing: `the ${scope} scope` };
  if (!can(ctx.actor.permissions, tool.permission)) return { allowed: false, missing: tool.permission };
  return { allowed: true as const };
}

export function summarise(tool: ToolDefinition, ctx: McpContext, policy: AiPolicy) {
  const reach = access(tool, ctx);
  return {
    capability: tool.name,
    title: tool.title,
    summary: firstSentence(tool.description),
    section: tool.discovery.section,
    operation: tool.discovery.operation,
    writes: tool.kind === 'write',
    approval: approvalFor(tool, policy),
    allowed: reach.allowed,
    ...(reach.allowed ? {} : { missing: reach.missing }),
  };
}

/* -------------------------------------------------------------------------- */
/*  The map                                                                    */
/* -------------------------------------------------------------------------- */

export function sectionsMap(ctx: McpContext) {
  const domains = (Object.keys(DOMAINS) as Domain[]).map((domain) => ({
    domain,
    label: DOMAINS[domain].label,
    description: DOMAINS[domain].description,
    sections: (Object.keys(SECTIONS) as Section[])
      .filter((section) => SECTIONS[section].domain === domain)
      .map((section) => {
        const tools = TOOLS.filter((tool) => tool.discovery.section === section);
        return {
          section,
          label: SECTIONS[section].label,
          description: SECTIONS[section].description,
          capabilities: tools.length,
          youMayUse: tools.filter((tool) => access(tool, ctx).allowed).length,
        };
      })
      .filter((section) => section.capabilities > 0),
  }));
  return {
    totalCapabilities: TOOLS.length,
    domains,
    next:
      'admin_search with plain words (or a `section`) finds capabilities; admin_describe gives ' +
      'one’s exact arguments; admin_call runs it.',
  };
}

export function sectionCapabilities(section: Section, ctx: McpContext, policy: AiPolicy) {
  return TOOLS.filter((tool) => tool.discovery.section === section).map((tool) =>
    summarise(tool, ctx, policy),
  );
}

/* -------------------------------------------------------------------------- */
/*  Search                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A ranked keyword search, built once when the module loads.
 *
 * Not embeddings, deliberately. The vocabulary is small and owned by this
 * file — names, aliases, tags, the taxonomy's keywords — so a weighted match
 * over it is predictable, explainable and free, and a result that surprises
 * somebody can be fixed by adding a word to a tool rather than by retraining
 * anything. Weights favour the most deliberate signals: a name or alias is
 * something somebody chose; a word in a description might be incidental.
 */

const STOP = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'and', 'or', 'in', 'on', 'at', 'is', 'it', 'its', 'my',
  'our', 'with', 'from', 'by', 'be', 'i', 'me', 'we', 'can', 'how', 'do', 'please', 'this',
  'that', 'what', 'one', 'some', 'into',
]);

/** Lower case, split, and a crude stem: "journeys" and "journey" are one word. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[_\-./]/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word));
}

/** Synonyms the office and a model both use, folded to the panel's own word. */
const SYNONYMS: Record<string, string> = {
  trip: 'journey',
  tour: 'journey',
  trek: 'journey',
  package: 'journey',
  blog: 'journal',
  post: 'journal',
  article: 'journal',
  destination: 'place',
  valley: 'place',
  region: 'place',
  inquiry: 'enquiry',
  lead: 'enquiry',
  image: 'photograph',
  photo: 'photograph',
  picture: 'photograph',
  cost: 'price',
  pricing: 'price',
  date: 'departure',
};

const fold = (word: string) => SYNONYMS[word] ?? word;

interface Indexed {
  tool: ToolDefinition;
  fields: { weight: number; words: Set<string>; phrases: string[] }[];
}

function field(weight: number, texts: string[]): Indexed['fields'][number] {
  return {
    weight,
    words: new Set(texts.flatMap(words).map(fold)),
    phrases: texts.map((text) => text.toLowerCase()).filter((text) => text.includes(' ')),
  };
}

const INDEX: Indexed[] = TOOLS.map((tool) => {
  const section = SECTIONS[tool.discovery.section];
  return {
    tool,
    fields: [
      field(6, [tool.name]),
      field(5, tool.discovery.aliases ?? []),
      field(4, [tool.title]),
      field(3, tool.discovery.tags ?? []),
      field(3, OPERATION_WORDS[tool.discovery.operation]),
      field(2, [section.label, ...section.keywords]),
      field(1, [tool.description]),
    ],
  };
});

export function searchCapabilities(
  query: string,
  ctx: McpContext,
  policy: AiPolicy,
  options: { section?: Section; limit: number; onlyAllowed?: boolean },
) {
  const asked = [...new Set(words(query).map(fold))];
  const lowered = query.toLowerCase();

  const scored = INDEX.filter((entry) => !options.section || entry.tool.discovery.section === options.section)
    .map((entry) => {
      let score = 0;
      let matched = 0;
      for (const word of asked) {
        const best = Math.max(0, ...entry.fields.filter((f) => f.words.has(word)).map((f) => f.weight));
        if (best > 0) matched += 1;
        score += best;
      }
      for (const f of entry.fields) {
        for (const phrase of f.phrases) if (lowered.includes(phrase)) score += f.weight + 2;
      }
      /* Covering more of what was asked beats one strong match: "journey faq"
         should rank the FAQ tool over every other journey tool. */
      if (asked.length > 1) score *= 0.5 + matched / asked.length;
      if (lowered.trim() === entry.tool.name) score += 100;
      return { entry, score };
    })
    .filter(({ score }) => score > 0 || asked.length === 0)
    .sort((a, b) => b.score - a.score || a.entry.tool.name.localeCompare(b.entry.tool.name));

  const results = scored
    .map(({ entry }) => summarise(entry.tool, ctx, policy))
    .filter((result) => !options.onlyAllowed || result.allowed)
    .slice(0, options.limit);

  return {
    query,
    results,
    ...(results.length === 0
      ? {
          note:
            'Nothing matched. Try other words, or admin_sections for the map. If the panel ' +
            'really has no capability for this, say so — do not use a different tool to ' +
            'approximate it.',
        }
      : { next: 'admin_describe gives a capability’s exact arguments; admin_call runs it.' }),
  };
}

/** The real names nearest to one that does not exist. */
export function closestNames(name: string, limit = 5): string[] {
  const asked = new Set(words(name).map(fold));
  return INDEX.map((entry) => {
    const own = new Set([...words(entry.tool.name), ...(entry.tool.discovery.aliases ?? []).flatMap(words)].map(fold));
    let overlap = 0;
    for (const word of asked) if (own.has(word)) overlap += 1;
    return { name: entry.tool.name, overlap };
  })
    .filter((row) => row.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((row) => row.name);
}

/* -------------------------------------------------------------------------- */
/*  Describe                                                                   */
/* -------------------------------------------------------------------------- */

/** The two arguments every write takes on top of its own. */
export const envelopeShape = {
  dryRun: z
    .boolean()
    .optional()
    .describe('Preview: return the exact change and whether it needs approval, and change nothing.'),
  expectedVersion: z
    .string()
    .optional()
    .describe('The `version` from your read. The write is refused if the record has changed since.'),
};

export function resolveCapability(name: string): ToolDefinition {
  const tool = toolByName(name.trim());
  if (tool) return tool;

  /* An alias is somebody's reasonable guess at a name, so it resolves — and
     the answer says what the real name is. */
  const byAlias = toolByAlias(name.trim());
  if (byAlias) return byAlias;

  const closest = closestNames(name);
  throw new McpToolError(
    'CAPABILITY_NOT_FOUND',
    `There is no capability called “${name}”. ` +
      (closest.length ? `The nearest are: ${closest.join(', ')}. ` : '') +
      'Use admin_search to find the right one. Do not substitute a capability that only sounds similar.',
    { closest },
  );
}

export function describeCapability(name: string, ctx: McpContext, policy: AiPolicy) {
  const tool = resolveCapability(name);
  const schema = tool.kind === 'write' ? tool.schema.extend(envelopeShape) : tool.schema;
  const related = TOOLS.filter(
    (other) => other.discovery.section === tool.discovery.section && other.name !== tool.name,
  ).map((other) => other.name);

  return {
    ...summarise(tool, ctx, policy),
    ...(tool.name !== name.trim() ? { note: `“${name}” is another name for ${tool.name}.` } : {}),
    description: tool.description,
    permission: tool.permission,
    risk: tool.kind === 'write' ? tool.risk : 'LOW',
    inputSchema: toJsonSchemaCompat(schema, { strictUnions: true, pipeStrategy: 'input' }),
    howToCall: { tool: 'admin_call', arguments: { capability: tool.name, arguments: '{ … as inputSchema }' } },
    sameSection: related,
  };
}
