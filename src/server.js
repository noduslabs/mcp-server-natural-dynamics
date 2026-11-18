const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const tools = require("./tools");
const { version } = require("../package.json");

function asResult(payload) {
	const text = JSON.stringify(payload, null, 2);
	// round-trip so structuredContent carries exactly what the text shows (no undefined keys)
	return { content: [{ type: "text", text }], structuredContent: JSON.parse(text) };
}

function createServer() {
	const server = new McpServer({ name: "natural-dynamics-mcp", version });

	server.registerTool(
		"analyze_dynamics",
		{
			title: "How natural is this time series?",
			description:
				"Check how natural the dynamics of a time series are: heart rate, movement, prices, sensor readings, traffic, any sequence of numbers. " +
				"Measures the fractal scaling exponent alpha (DFA) and gives a verdict: " +
				"\"natural\" (alpha around 1, fractal / 1/f, healthy balance of stability and change), " +
				"\"predictable\" (below 1, regular, over-controlled), " +
				"\"static\" (around 0.5, no memory, white noise), or " +
				"\"too driven\" (above 1, trends dominate, pushed by a force). " +
				"Returns the verdict, a 0–1 naturalness score, short-term and long-term verdicts and advice on how to make it more natural. " +
				"Pass the numbers as `series` or a file as `filePath`. 256+ points give a stable reading.",
			inputSchema: {
				series: z.array(z.number()).optional().describe("The time series as an array of numbers."),
				filePath: z
					.string()
					.optional()
					.describe("Path to a file with the series instead: JSON array / {timeSeries: [...]}, CSV/TSV, or one number per line."),
				column: z
					.union([z.string(), z.number().int().min(0)])
					.optional()
					.describe("Column name or 0-based index when the file has several columns."),
				strictness: z
					.enum(["relaxed", "moderate", "strict"])
					.optional()
					.describe("How close to alpha 1 counts as natural: relaxed ±0.2, moderate ±0.15 (default), strict ±0.1."),
			},
			annotations: { readOnlyHint: true, openWorldHint: false },
		},
		async (params) => asResult(tools.analyzeDynamics(params))
	);

	server.registerTool(
		"generate_natural_dynamics",
		{
			title: "Generate natural dynamics",
			description:
				"Generate a sequence of numbers that varies the way natural systems do (fractal, 1/f, alpha ≈ 1): " +
				"use it for organic-feeling animation timing, breathing or rhythm patterns, music, haptics, test data, simulations, " +
				"or anywhere a value should change over time without being random or mechanical. " +
				"Set `length` and the `min` / `max` of the values. " +
				"For comparison it can also make the other kinds: `dynamics: \"predictable\"`, `\"static\"` or `\"driven\"`, or any `targetAlpha`. " +
				"The result is checked and comes with its measured alpha and verdict. Long series are written to a file.",
			inputSchema: {
				length: z.number().int().min(tools.MIN_POINTS).max(tools.MAX_POINTS).optional().describe("Number of values (default 256)."),
				min: z.number().optional().describe("Smallest output value (default 0)."),
				max: z.number().optional().describe("Largest output value (default 100)."),
				dynamics: z
					.enum(["natural", "predictable", "static", "driven"])
					.optional()
					.describe("Kind of dynamics (default natural, alpha 1). predictable = 0.75, static = 0.5, driven = 1.5."),
				targetAlpha: z.number().min(0.2).max(1.7).optional().describe("Exact alpha to aim for; overrides `dynamics`."),
				integers: z.boolean().optional().describe("Round values to whole numbers (default false)."),
				seed: z.number().int().optional().describe("Integer seed to get the same series again."),
				outputFile: z.string().optional().describe("Write the series to this path (.csv, .json or .txt)."),
				includeSeries: z.boolean().optional().describe("Also return the series inline when it is written to a file."),
				maxInlinePoints: z
					.number()
					.int()
					.min(0)
					.optional()
					.describe("Longest series returned inline (default 1000); longer ones go to outputFile or a temp file."),
			},
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		},
		async (params) => asResult(tools.generateNaturalDynamics(params))
	);

	return server;
}

module.exports = { createServer };
