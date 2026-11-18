# natural-dynamics-mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI assistants (Claude, Cursor, etc.) **check how natural a time series is** and **generate natural dynamics** on demand.

"Natural" here means fractal, 1/f variation: the way a healthy heartbeat, a walking gait or a forest canopy varies. Stable enough to hold together and variable enough to adapt. The server measures this with the DFA scaling exponent α and reads it on one scale:

| α | Verdict | What it means |
| --- | --- | --- |
| below 0.6 (around 0.5) | **static** | No memory: each value independent of the last, like white noise. |
| 0.6 to 0.85 | **predictable** | Short memory around a fixed mean: regular, over-controlled. |
| 0.85 to 1.15 (around 1) | **natural** | Fractal / 1/f: self-similar across time scales. |
| above 1.15 | **too driven** | Trends overpower short-term variation: pushed by a force, drifting. |

The natural band is ±0.15 by default; `strictness` widens it to ±0.2 (`relaxed`) or narrows it to ±0.1 (`strict`). Every result also has a `naturalness` score, `1 − |α − 1|`, from 0 to 1.

It is built on [dfa-variability](https://github.com/deemeetree/dfa) and [generate-fractal-signal](https://github.com/noduslabs/generate-fractal-signal), the same libraries behind [mcp-fractality](https://github.com/noduslabs/mcp-fractality). Use mcp-fractality when you need the full DFA/MFDFA toolkit; use this one when you want a plain verdict and natural-looking numbers.

## Run it

Requires Node.js 18+. The server runs locally over stdio, so you don't start it yourself: you register the command with your AI client and the client launches it.

### From this folder (local clone)

```sh
cd natural-dynamics-mcp
npm install
npm test                     # optional: 7 tests, should all pass
claude mcp add natural-dynamics -- node "$(pwd)/bin/natural-dynamics-mcp.js"
```

Then check it is connected with `claude mcp list`, or `/mcp` inside Claude Code. Add `--scope user` to `claude mcp add` to make it available in every project, not only the current one.

### Claude Desktop, Cursor and other clients

Add this to `claude_desktop_config.json`, `.cursor/mcp.json` or your client's MCP config, with the absolute path to your clone:

```json
{
	"mcpServers": {
		"natural-dynamics": {
			"command": "node",
			"args": ["/absolute/path/to/natural-dynamics-mcp/bin/natural-dynamics-mcp.js"]
		}
	}
}
```

Restart the client after editing the file.

### Once published to npm

```sh
claude mcp add natural-dynamics -- npx -y natural-dynamics-mcp
```

or `"command": "npx", "args": ["-y", "natural-dynamics-mcp"]` in a JSON config.

### Try it without a client

```sh
npx @modelcontextprotocol/inspector node bin/natural-dynamics-mcp.js
```

opens the MCP Inspector in the browser, where you can call both tools by hand. `npm start` runs the bare stdio server (it waits silently for an MCP client on stdin).

## Tools

### `analyze_natural_dynamics`

Gives a verdict on any series of numbers: heart rate or RR intervals, steps, prices, sensor readings, traffic.

| Input | |
| --- | --- |
| `series` | Array of numbers, **or** |
| `filePath` | JSON array / `{ "timeSeries": [...] }`, CSV/TSV, or one number per line |
| `column` | Column name or 0-based index when the file has several columns |
| `strictness` | `relaxed`, `moderate` (default) or `strict` |

Returns `verdict`, `naturalness`, a one-line `summary`, `advice` on how to move toward natural, and the details for the whole series (`overall`), short time scales (`shortTerm`, α₁, windows 4–16) and long ones (`longTerm`, α₂, needs about 256+ points). It warns when the series is too short for a stable reading.

```json
{
	"verdict": "too driven",
	"naturalness": 0.519,
	"summary": "The dynamics are too driven (alpha 1.4814, naturalness 0.519).",
	"advice": "To make it more natural, release the drive: add short-term variation and let trends reverse instead of persisting.",
	"overall": { "verdict": "too driven", "alpha": 1.4814, "naturalness": 0.519, "distanceFromNatural": 0.4814, "meaning": "..." },
	"shortTerm": { "...": "..." },
	"longTerm": { "...": "..." }
}
```

### `generate_natural_dynamics`

Makes a sequence that varies the way natural systems do: for organic animation timing, breathing and rhythm patterns, music, haptics, simulations or test data.

| Input | |
| --- | --- |
| `length` | Number of values, 16–65536 (default 256) |
| `min`, `max` | Value range (default 0–100) |
| `dynamics` | `natural` (default, α 1), `predictable` (0.75), `static` (0.5) or `driven` (1.5) |
| `targetAlpha` | Exact α from 0.2 to 1.7; overrides `dynamics` |
| `integers` | Round to whole numbers (default false) |
| `seed` | Same seed, same series |
| `outputFile` | Write to `.csv`, `.json` or `.txt` |
| `includeSeries`, `maxInlinePoints` | Series up to 1000 points come back inline; longer ones go to a file (a temp file if no `outputFile`) |

Each generated series is measured before it is returned, so the result carries its `measuredAlpha`, `verdict` and `naturalness`.

## Example prompts

- "Is the data in `heart-rate.csv` natural? Use the `rr` column."
- "Generate 120 natural breathing durations between 3 and 6 seconds."
- "Make a predictable and a natural version of 500 values between 0 and 1 and show me how they differ."
- "Here are my daily step counts for the last year: how natural is that rhythm?"

## Development

```sh
npm install
npm test     # node --test: verdicts, generation, file I/O, MCP over memory and stdio
npm start    # run the stdio server
```

## License

AGPL-3.0-or-later, same as generate-fractal-signal. Contact: [support.noduslabs.com](https://support.noduslabs.com)
