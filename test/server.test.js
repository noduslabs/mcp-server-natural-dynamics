const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");
const { createServer } = require("../src/server");

const parse = (result) => JSON.parse(result.content[0].text);

test("generate then analyze over MCP", async () => {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const server = createServer();
	const client = new Client({ name: "test", version: "0.0.0" });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

	const { tools } = await client.listTools();
	assert.deepStrictEqual(tools.map((t) => t.name).sort(), ["analyze_natural_dynamics", "generate_natural_dynamics"]);

	const g = parse(await client.callTool({ name: "generate_natural_dynamics", arguments: { length: 256, seed: 11 } }));
	assert.strictEqual(g.verdict, "natural");
	const a = parse(await client.callTool({ name: "analyze_natural_dynamics", arguments: { series: g.series } }));
	assert.strictEqual(a.verdict, "natural");

	const bad = await client.callTool({ name: "analyze_natural_dynamics", arguments: {} });
	assert.strictEqual(bad.isError, true);
	await Promise.all([client.close(), server.close()]);
});

test("stdio binary starts and answers", async () => {
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [path.join(__dirname, "..", "bin", "natural-dynamics-mcp.js")],
	});
	const client = new Client({ name: "test", version: "0.0.0" });
	await client.connect(transport);
	const { tools } = await client.listTools();
	assert.strictEqual(tools.length, 2);
	await client.close();
});
