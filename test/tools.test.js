const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const tools = require("../src/tools");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "natural-dynamics-test-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test("classify maps alpha to the four verdicts", () => {
	assert.strictEqual(tools.classify(0.5).verdict, "static");
	assert.strictEqual(tools.classify(0.75).verdict, "predictable");
	assert.strictEqual(tools.classify(1.02).verdict, "natural");
	assert.strictEqual(tools.classify(1.5).verdict, "too driven");
	assert.strictEqual(tools.classify(1.18, "relaxed").verdict, "natural");
	assert.strictEqual(tools.classify(1.12, "strict").verdict, "too driven");
	assert.strictEqual(tools.classify(null), null);
	assert.strictEqual(tools.naturalness(1), 1);
	assert.strictEqual(tools.naturalness(0.5), 0.5);
	assert.strictEqual(tools.naturalness(2.4), 0);
});

test("generated dynamics get the verdict they were made for", () => {
	for (const [dynamics, verdict] of [
		["natural", "natural"],
		["predictable", "predictable"],
		["static", "static"],
		["driven", "too driven"],
	]) {
		const g = tools.generateNaturalDynamics({ length: 512, dynamics, seed: 3 });
		assert.strictEqual(g.verdict, verdict, `${dynamics}: alpha ${g.measuredAlpha}`);
		const a = tools.analyzeNaturalDynamics({ series: g.series });
		assert.strictEqual(a.verdict, verdict);
		assert.strictEqual(a.overall.alpha, g.measuredAlpha);
	}
});

test("generate defaults to natural values inside 0..100", () => {
	const g = tools.generateNaturalDynamics({ seed: 1 });
	assert.strictEqual(g.series.length, 256);
	assert.strictEqual(g.requested.targetAlpha, 1);
	assert.ok(g.series.every((v) => v >= 0 && v <= 100));
	assert.deepStrictEqual(tools.generateNaturalDynamics({ seed: 1 }).series, g.series);
});

test("generate honours range, integers, targetAlpha and files", () => {
	const file = path.join(tmp, "s.csv");
	const g = tools.generateNaturalDynamics({ length: 300, min: 600, max: 1200, integers: true, targetAlpha: 0.9, seed: 2, outputFile: file });
	assert.strictEqual(g.outputFile, file);
	assert.strictEqual(g.series, undefined);
	assert.strictEqual(g.requested.dynamics, "custom");
	const a = tools.analyzeNaturalDynamics({ filePath: file, column: "value" });
	assert.strictEqual(a.points, 300);
	assert.strictEqual(a.overall.alpha, g.measuredAlpha);

	const long = tools.generateNaturalDynamics({ length: 2048, seed: 1 });
	assert.ok(fs.existsSync(long.outputFile));
	fs.rmSync(long.outputFile);
});

test("analysis warns on short series and rejects bad input", () => {
	const g = tools.generateNaturalDynamics({ length: 32, seed: 1 });
	const a = tools.analyzeNaturalDynamics({ series: g.series });
	assert.strictEqual(a.longTerm, null);
	assert.ok(a.warnings.length === 2);
	assert.throws(() => tools.analyzeNaturalDynamics({ series: [1, 2, 3] }), /at least 16/);
	assert.throws(() => tools.generateNaturalDynamics({ length: 4 }), /length/);
	assert.throws(() => tools.generateNaturalDynamics({ min: 5, max: 1 }), /min/);
});
