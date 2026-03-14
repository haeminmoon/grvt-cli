// Suppress noisy SDK console.info logs
const _origInfo = console.info;
console.info = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.startsWith('Cookie') || msg.startsWith('cookie')) return;
  _origInfo(...args);
};

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerMarketTools } from './mcp/tools/market';
import { registerOrderTools } from './mcp/tools/order';
import { registerPositionTools } from './mcp/tools/position';
import { registerAccountTools } from './mcp/tools/account';
import { registerFundingTools } from './mcp/tools/funding';
import { registerAuthTools } from './mcp/tools/auth';

const server = new McpServer({
  name: 'grvt',
  version: '0.1.1',
});

// Register all tool groups
registerMarketTools(server);
registerOrderTools(server);
registerPositionTools(server);
registerAccountTools(server);
registerFundingTools(server);
registerAuthTools(server);

// Start stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${err}\n`);
  process.exit(1);
});
