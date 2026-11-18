const DFA = require("dfa-variability");
const { generateSignal } = require("generate-fractal-signal");
const { resolveSeries, writeSeries, tempSeriesPath } = require("./series");

const MIN_POINTS = 16;
const MAX_POINTS = 65536;
const DEFAULT_MAX_INLINE = 1000;

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

/**
 * The four kinds of dynamics, ordered by DFA alpha:
 *   static (~0.5) < predictable (~0.75) < natural (~1) < too driven (~1.5)
 */
const DYNAMICS = {
	static: {
		verdict: "static",
		alpha: 0.5,
		meaning: "No memory: every value is independent of the ones before it, like white noise or a flat line with jitter.",
	},
	predictable: {
		verdict: "predictable",
		alpha: 0.75,
		meaning: "Short memory around a fixed mean: regular, controlled, lacks the long-range variation of living systems.",
	},
	natural: {
		verdict: "natural",
		alpha: 1,
		meaning: "Fractal (1/f, pink noise): self-similar across scales, balancing stability and change, typical of healthy natural systems.",
	},
	driven: {
		verdict: "too driven",
		alpha: 1.5,
		meaning: "Trends overpower short-term variation (Brownian-like): pushed by a force, drifting, losing flexibility.",
	},
};

/** Half-width of the band around alpha = 1 that counts as natural. */
const NATURAL_BAND = { relaxed: 0.2, moderate: 0.15, strict: 0.1 };

/** Below this alpha the series counts as static (no memory). */
const STATIC_MAX = 0.6;

function round(value, digits = 4) {
	if (typeof value !== "number" || !Number.isFinite(value)) return value === undefined ? undefined : null;
	const k = 10 ** digits;
	return Math.round(value * k) / k;
}

/** 1 at alpha = 1, falling linearly to 0 at alpha = 0 or 2. */
function naturalness(alpha) {
	if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;
	return round(Math.max(0, 1 - Math.abs(alpha - 1)), 3);
}

/** Classify one alpha value. Returns null when the exponent could not be measured. */
function classify(alpha, strictness = "moderate") {
	if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;
	const band = NATURAL_BAND[strictness] ?? NATURAL_BAND.moderate;
	let kind;
	if (alpha < STATIC_MAX) kind = DYNAMICS.static;
	else if (alpha < 1 - band) kind = DYNAMICS.predictable;
	else if (alpha <= 1 + band) kind = DYNAMICS.natural;
	else kind = DYNAMICS.driven;
	return {
		verdict: kind.verdict,
		alpha: round(alpha),
		naturalness: naturalness(alpha),
		distanceFromNatural: round(alpha - 1),
		meaning: kind.meaning,
	};
}

function advice(verdict) {
	switch (verdict) {
		case "static":
			return "To make it more natural, add memory: let each value depend on the recent past and add slower variations on top of fast ones.";
		case "predictable":
			return "To make it more natural, loosen control: allow larger, slower excursions away from the mean so variation spans several time scales.";
		case "natural":
			return "Already natural: variation is balanced across short and long time scales.";
		case "too driven":
			return "To make it more natural, release the drive: add short-term variation and let trends reverse instead of persisting.";
		default:
			return null;
	}
}

function summarySentence(overall, short, long) {
	if (!overall) return "Alpha could not be measured on this series.";
	let s = `The dynamics are ${overall.verdict} (alpha ${overall.alpha}, naturalness ${overall.naturalness}).`;
	if (short && long && short.verdict !== long.verdict) {
		s += ` Short-term (alpha1 ${short.alpha}) they look ${short.verdict}, long-term (alpha2 ${long.alpha}) ${long.verdict}.`;
	}
	return s;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function lengthWarnings(n) {
	const warnings = [];
	if (n < 64) warnings.push(`Only ${n} points: the verdict is a rough indication; 256+ points give a stable reading.`);
	if (n < 256) warnings.push(`The long-term verdict (alpha2) needs roughly 256+ points; this series has ${n}.`);
	return warnings;
}

function measure(values) {
	return new DFA(values).compute(4, 0.25, 2, 16, 16, 0.25, "moderate");
}

function analyzeDynamics(params) {
	const { values, source } = resolveSeries(params);
	if (values.length < MIN_POINTS) throw new Error(`The analysis needs at least ${MIN_POINTS} points; got ${values.length}.`);
	const strictness = params.strictness || "moderate";
	const r = measure(values);

	const overall = classify(r.alpha, strictness);
	const shortTerm = classify(r.alpha1, strictness);
	const longTerm = values.length >= 64 ? classify(r.alpha2, strictness) : null;

	return {
		source,
		points: values.length,
		verdict: overall ? overall.verdict : null,
		naturalness: overall ? overall.naturalness : null,
		summary: summarySentence(overall, shortTerm, longTerm),
		advice: overall ? advice(overall.verdict) : null,
		overall,
		shortTerm,
		longTerm,
		strictness,
		scale: {
			static: `alpha < ${STATIC_MAX} (around 0.5)`,
			predictable: `${STATIC_MAX} to ${round(1 - NATURAL_BAND[strictness])}`,
			natural: `${round(1 - NATURAL_BAND[strictness])} to ${round(1 + NATURAL_BAND[strictness])} (around 1)`,
			"too driven": `above ${round(1 + NATURAL_BAND[strictness])}`,
		},
		warnings: lengthWarnings(values.length),
	};
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const DYNAMICS_ALIASES = {
	natural: "natural",
	fractal: "natural",
	pink: "natural",
	predictable: "predictable",
	regular: "predictable",
	static: "static",
	random: "static",
	white: "static",
	driven: "driven",
	"too driven": "driven",
	trending: "driven",
	brown: "driven",
};

function resolveDynamics(name) {
	if (name === undefined || name === null) return "natural";
	const key = DYNAMICS_ALIASES[String(name).trim().toLowerCase()];
	if (!key) throw new Error(`Unknown dynamics "${name}". Use natural, predictable, static or driven.`);
	return key;
}

function generateNaturalDynamics(params = {}) {
	const length = params.length ?? 256;
	if (length < MIN_POINTS || length > MAX_POINTS) throw new Error(`length must be between ${MIN_POINTS} and ${MAX_POINTS}.`);
	const range = [params.min ?? 0, params.max ?? 100];
	if (!(range[0] < range[1])) throw new Error("min must be smaller than max.");

	const kind = resolveDynamics(params.dynamics);
	const targetAlpha = params.targetAlpha ?? DYNAMICS[kind].alpha;

	const config = {
		signalLength: length,
		signalRange: range,
		targetAlpha,
		generateIntegers: params.integers ?? false,
	};
	if (params.seed !== undefined) config.seed = params.seed;

	const r = generateSignal(config);
	const series = r.timeSeries;
	const check = classify(r.alpha);

	const result = {
		requested: { dynamics: params.targetAlpha !== undefined ? "custom" : DYNAMICS[kind].verdict, targetAlpha },
		verdict: check ? check.verdict : null,
		naturalness: check ? check.naturalness : null,
		measuredAlpha: round(r.alpha),
		meaning: check ? check.meaning : null,
		length: series.length,
		range,
		seed: r.seed,
		warnings: r.warnings,
	};

	const maxInline = params.maxInlinePoints ?? DEFAULT_MAX_INLINE;
	let outputFile = params.outputFile;
	if (!outputFile && series.length > maxInline) outputFile = tempSeriesPath();
	if (outputFile) result.outputFile = writeSeries(outputFile, series, { generatedWith: { ...result } });
	if (!outputFile || params.includeSeries) result.series = series;
	else result.note = `Series of ${series.length} points written to outputFile (inline limit: ${maxInline}).`;

	return result;
}

module.exports = {
	analyzeDynamics,
	generateNaturalDynamics,
	classify,
	naturalness,
	DYNAMICS,
	MIN_POINTS,
	MAX_POINTS,
};
