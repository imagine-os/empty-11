/**
 * MCP catalog reference (PAP-103 side of the PAP-210 contract).
 *
 * `mcpServers[]` on a character must name a server id from the catalog. Until PAP-210 lands the
 * generated `.claude/mcp-catalog.json`, the validator reads `mcp-catalog.stub.json` next to this
 * file and emits an `MCP_CATALOG_STUB` warning so the gap stays visible.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const McpCatalogRefSchema = z.object({
  stub: z.boolean().default(false),
  schemaVersion: z.number().int().positive(),
  servers: z.array(
    z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), description: z.string() }),
  ),
});
export type McpCatalogRef = z.output<typeof McpCatalogRefSchema>;

export const MCP_CATALOG_STUB_PATH = new URL('./mcp-catalog.stub.json', import.meta.url);

export function loadMcpCatalog(url: URL = MCP_CATALOG_STUB_PATH): McpCatalogRef {
  return McpCatalogRefSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
}

export const MCP_CATALOG_STUB: McpCatalogRef = loadMcpCatalog();
