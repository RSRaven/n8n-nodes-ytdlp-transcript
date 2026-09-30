// Runs the built node against a fake yt-dlp and checks that parameters reach it
// as literal arguments. Run with `npm run build && npm test`.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { YtDlpTranscript } = require('../dist/nodes/YtDlpTranscript/YtDlpTranscript.node.js');

const FAKE_YTDLP = `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_YTDLP_LOG, JSON.stringify(args) + '\\n');
if (args.includes('--dump-json')) {
	console.log(JSON.stringify({ title: 'fake' }));
} else {
	const output = args[args.indexOf('--output') + 1];
	fs.writeFileSync(output + '.en.vtt', 'WEBVTT\\n\\n00:00:00.000 --> 00:00:01.000\\nhello\\n');
}
`;

const HOSTILE = ['https://x/$(touch MARKER)', '"; touch MARKER; "', '`touch MARKER`', '-x'];

async function run(params) {
	const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlp-test-'));
	const bin = path.join(work, 'bin');
	const cwd = path.join(work, 'cwd');
	const log = path.join(work, 'calls.log');
	fs.mkdirSync(bin);
	fs.mkdirSync(cwd);
	fs.writeFileSync(path.join(bin, 'yt-dlp'), FAKE_YTDLP, { mode: 0o755 });

	const oldPath = process.env.PATH;
	const oldCwd = process.cwd();
	process.env.PATH = bin + path.delimiter + oldPath;
	process.env.FAKE_YTDLP_LOG = log;
	process.chdir(cwd);
	try {
		const context = {
			getInputData: () => [{ json: {} }],
			getNodeParameter: (name) => params[name],
			getNode: () => ({ name: 'test' }),
			continueOnFail: () => false,
		};
		const result = await new YtDlpTranscript().execute.call(context);
		const calls = fs.existsSync(log)
			? fs.readFileSync(log, 'utf-8').trim().split('\n').map((line) => JSON.parse(line))
			: [];
		return { result, calls, markerCreated: fs.existsSync(path.join(cwd, 'MARKER')) };
	} finally {
		process.chdir(oldCwd);
		process.env.PATH = oldPath;
		fs.rmSync(work, { recursive: true, force: true });
	}
}

for (const value of HOSTILE) {
	test(`video URL is passed as one literal argument: ${value}`, async () => {
		const { result, calls, markerCreated } = await run({
			videoUrl: value,
			language: 'en',
			outputFormat: 'cleanText',
			additionalOptions: {},
		});

		assert.strictEqual(markerCreated, false, 'MARKER file must not be created');
		assert.strictEqual(calls.length, 2, 'yt-dlp runs once for subtitles and once for metadata');
		for (const args of calls) {
			assert.deepStrictEqual(args.slice(-2), ['--', value]);
		}
		assert.strictEqual(result[0][0].json.transcript, 'hello');
		assert.strictEqual(result[0][0].json.metadata.title, 'fake');
	});

	test(`option values are passed as literal arguments: ${value}`, async () => {
		const { calls, markerCreated } = await run({
			videoUrl: 'https://example.com/video',
			language: value,
			outputFormat: 'cleanText',
			additionalOptions: { cookiesFile: value, proxy: value, userAgent: value },
		});

		assert.strictEqual(markerCreated, false, 'MARKER file must not be created');
		const [subtitles, metadata] = calls;
		for (const option of ['--sub-lang', '--cookies', '--proxy', '--user-agent']) {
			assert.strictEqual(subtitles[subtitles.indexOf(option) + 1], value, option);
		}
		assert.strictEqual(metadata[metadata.indexOf('--cookies') + 1], value);
	});
}

test('browser name is passed as a literal argument', async () => {
	const value = '$(touch MARKER)';
	const { calls, markerCreated } = await run({
		videoUrl: 'https://example.com/video',
		language: 'en',
		outputFormat: 'cleanText',
		additionalOptions: { useBrowserCookies: true, browserName: value },
	});

	assert.strictEqual(markerCreated, false, 'MARKER file must not be created');
	for (const args of calls) {
		assert.strictEqual(args[args.indexOf('--cookies-from-browser') + 1], value);
	}
});
