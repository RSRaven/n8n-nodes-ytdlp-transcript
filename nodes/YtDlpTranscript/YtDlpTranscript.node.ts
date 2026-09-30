import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

export class YtDlpTranscript implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YT-DLP Transcript',
		name: 'ytDlpTranscript',
		icon: 'file:ytdlp.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["videoUrl"]}}',
		description: 'Extract video transcriptions using yt-dlp with support for cookies and language selection',
		defaults: {
			name: 'YT-DLP Transcript',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [],
		properties: [
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://www.youtube.com/watch?v=...',
				description: 'The URL of the video to extract transcript from',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: 'en',
				placeholder: 'en,es or en,fr,de',
				description: 'Language code(s) for the transcript. Single language (en) or comma-separated priority list (en,es,fr). First available language will be used.',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				default: 'cleanText',
				options: [
					{
						name: 'Clean Text',
						value: 'cleanText',
						description: 'Plain text without timestamps',
					},
					{
						name: 'Text with Timestamps',
						value: 'textWithTimestamps',
						description: 'Text with timestamp markers',
					},
					{
						name: 'Structured JSON',
						value: 'structuredJson',
						description: 'JSON with segments, timestamps, and text',
					},
					{
						name: 'Markdown',
						value: 'markdown',
						description: 'Markdown formatted with timestamps as headers',
					},
				],
				description: 'Format of the output transcript',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{   displayName: 'Omit language',
					    name: 'omitLang',
					    type: 'boolean',
					    default: false,
					    description: 'Whether to omit the language for videos that do not specify',
					},
					{
						displayName: 'Cookies File',
						name: 'cookiesFile',
						type: 'string',
						default: '',
						description: 'Path to cookies file for authenticated access (Netscape format)',
					},
					{
						displayName: 'Use Cookies from Binary',
						name: 'useBinaryCookies',
						type: 'boolean',
						default: false,
						description: 'Whether to use cookies from incoming binary data',
					},
					{
						displayName: 'Use Browser Cookies',
						name: 'useBrowserCookies',
						type: 'boolean',
						default: false,
						description: 'Whether to use cookies from installed browser',
					},
					{
						displayName: 'Browser Name',
						name: 'browserName',
						type: 'options',
						default: 'chrome',
						displayOptions: {
							show: {
								'useBrowserCookies': [true],
							},
						},
						options: [
							{
								name: 'Chrome',
								value: 'chrome',
							},
							{
								name: 'Firefox',
								value: 'firefox',
							},
							{
								name: 'Safari',
								value: 'safari',
							},
							{
								name: 'Edge',
								value: 'edge',
							},
							{
								name: 'Opera',
								value: 'opera',
							},
							{
								name: 'Brave',
								value: 'brave',
							},
						],
						description: 'Browser to extract cookies from',
					},
					{
						displayName: 'Binary Property Name',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'cookies',
						displayOptions: {
							show: {
								'useBinaryCookies': [true],
							},
						},
						description: 'Name of the binary property containing cookies',
					},
					{
						displayName: 'Remove Duplicate Lines',
						name: 'removeDuplicates',
						type: 'boolean',
						default: true,
						description: 'Whether to remove duplicate subtitle lines',
					},
					{
						displayName: 'Include Speaker Labels',
						name: 'includeSpeakerLabels',
						type: 'boolean',
						default: false,
						description: 'Whether to try to detect and include speaker labels if available',
					},
					{
						displayName: 'Proxy',
						name: 'proxy',
						type: 'string',
						default: '',
						placeholder: 'http://proxy.example.com:8080',
						description: 'Proxy server to use for downloading',
					},
					{
						displayName: 'User Agent',
						name: 'userAgent',
						type: 'string',
						default: '',
						description: 'Custom user agent string',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const videoUrl = this.getNodeParameter('videoUrl', itemIndex) as string;
				const language = this.getNodeParameter('language', itemIndex) as string;
				const outputFormat = this.getNodeParameter('outputFormat', itemIndex) as string;
				const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex) as any;

				// Validate URL
				if (!videoUrl) {
					throw new NodeOperationError(this.getNode(), 'Video URL is required');
				}

				// Prepare temporary directory
				const tempDir = path.join(os.tmpdir(), `n8n-ytdlp-${Date.now()}`);
				fs.mkdirSync(tempDir, { recursive: true });

				let cookiesPath: string | undefined;
				let useBrowserCookies = false;
				let browserName = '';

				// Handle cookies
				if (additionalOptions.useBinaryCookies) {
					const binaryPropertyName = additionalOptions.binaryPropertyName || 'cookies';
					const binaryData = items[itemIndex].binary?.[binaryPropertyName];
					
					if (binaryData) {
						cookiesPath = path.join(tempDir, 'cookies.txt');
						const cookiesContent = Buffer.from(binaryData.data, 'base64').toString('utf-8');
						await fsWriteFile(cookiesPath, cookiesContent);
					}
				} else if (additionalOptions.useBrowserCookies) {
					useBrowserCookies = true;
					browserName = additionalOptions.browserName || 'chrome';
				} else if (additionalOptions.cookiesFile) {
					cookiesPath = additionalOptions.cookiesFile;
				}

				// Build yt-dlp arguments (passed as an array, no shell involved)
				const outputPath = path.join(tempDir, 'subtitle');
				const args: string[] = [];
				
				// Add subtitle extraction flags
				if (!additionalOptions.omitLang) {
					args.push('--sub-lang', language);
				}
				
				args.push('--write-subs', '--write-auto-subs');
				args.push('--skip-download'); // Don't download the video
				args.push('--output', outputPath);
				args.push('--sub-format', 'vtt/srt/best');


				if (useBrowserCookies) {
					args.push('--cookies-from-browser', browserName);
				} else if (cookiesPath) {
					args.push('--cookies', cookiesPath);
				}

				if (additionalOptions.proxy) {
					args.push('--proxy', additionalOptions.proxy);
				}

				if (additionalOptions.userAgent) {
					args.push('--user-agent', additionalOptions.userAgent);
				}

				// '--' ends the options, so the URL is never read as an option
				args.push('--', videoUrl);

				// Execute yt-dlp
				await execFileAsync('yt-dlp', args, { shell: false });

				// Find the downloaded subtitle file
				const files = fs.readdirSync(tempDir);
				const languageCodes = language.split(',').map(lang => lang.trim());
				
				const subtitleFile = files.find(f => {
					if (f.includes('.vtt') || f.includes('.srt')) {
						// Check if any of the requested languages are in the filename
						return languageCodes.some(lang => f.includes(lang));
					}
					return false;
				}) || files.find(f => f.includes('.vtt') || f.includes('.srt')); // Fallback to any subtitle file

				if (!subtitleFile) {
					throw new NodeOperationError(
						this.getNode(),
						`No transcript found for language: ${language}. Available files: ${files.join(', ')}`
					);
				}

				// Read and parse the subtitle file
				const subtitlePath = path.join(tempDir, subtitleFile);
				const subtitleContent = await fsReadFile(subtitlePath, 'utf-8');

				// Parse VTT/SRT content
				const transcript = parseSubtitles(
					subtitleContent,
					outputFormat || 'cleanText',
					additionalOptions.removeDuplicates !== false
				);

				// Get metadata
				const metadata = await getVideoMetadata(videoUrl, cookiesPath, useBrowserCookies, browserName);

				// Clean up temporary files
				try {
					fs.rmSync(tempDir, { recursive: true, force: true });
				} catch (cleanupError) {
					console.error('Failed to clean up temp directory:', cleanupError);
				}

				// Prepare output
				const outputItem: INodeExecutionData = {
					json: {
						videoUrl,
						language,
						transcript: typeof transcript === 'string' ? transcript : JSON.stringify(transcript, null, 2),
						format: outputFormat || 'cleanText',
						metadata,
					},
				};

				// If structured output, add the parsed transcript as well
				if (outputFormat === 'structuredJson' && typeof transcript === 'object') {
					outputItem.json.transcriptData = transcript;
				}

				returnData.push(outputItem);

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : String(error),
							videoUrl: this.getNodeParameter('videoUrl', itemIndex) as string,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// Helper function to parse subtitles
function parseSubtitles(content: string, format: string, removeDuplicates: boolean): string | object {
	// Parse VTT format
	const lines = content.split('\n');
	const segments: Array<{ start: string; end: string; text: string }> = [];
	let currentSegment: any = {};
	let lastText = '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// Skip WEBVTT header and empty lines
		if (line === 'WEBVTT' || line === '' || line.startsWith('NOTE')) {
			continue;
		}

		// Check if it's a timestamp line
		if (line.includes('-->')) {
			const [start, end] = line.split('-->').map(t => t.trim().split(' ')[0]);
			currentSegment = { start, end, text: '' };
		} else if (line && !line.match(/^\d+$/)) {
			// It's a text line (skip cue numbers)
			const cleanText = cleanSubtitleText(line);
			
			if (removeDuplicates && cleanText === lastText) {
				continue;
			}

			if (currentSegment.start) {
				currentSegment.text = cleanText;
				segments.push({ ...currentSegment });
				lastText = cleanText;
				currentSegment = {};
			}
		}
	}

	// Format output based on requested format
	switch (format) {
		case 'cleanText':
			return segments.map(s => s.text).join(' ');

		case 'textWithTimestamps':
			return segments.map(s => `[${s.start}] ${s.text}`).join('\n');

		case 'markdown':
			return segments.map(s => `### ${s.start}\n${s.text}\n`).join('\n');

		case 'structuredJson':
			return {
				segments,
				fullText: segments.map(s => s.text).join(' '),
				duration: segments.length > 0 ? segments[segments.length - 1].end : '00:00:00',
				segmentCount: segments.length,
			};

		default:
			return segments.map(s => s.text).join(' ');
	}
}

// Helper function to clean subtitle text
function cleanSubtitleText(text: string): string {
	// Remove HTML tags
	text = text.replace(/<[^>]*>/g, '');
	
	// Remove speaker labels like [Music] or (Applause)
	text = text.replace(/\[[^\]]*\]/g, '');
	text = text.replace(/\([^)]*\)/g, '');
	
	// Remove multiple spaces
	text = text.replace(/\s+/g, ' ');
	
	// Trim
	return text.trim();
}

// Helper function to get video metadata
async function getVideoMetadata(videoUrl: string, cookiesPath?: string, useBrowserCookies?: boolean, browserName?: string): Promise<any> {
	try {
		const args: string[] = ['--dump-json', '--no-warnings'];
		
		if (useBrowserCookies && browserName) {
			args.push('--cookies-from-browser', browserName);
		} else if (cookiesPath) {
			args.push('--cookies', cookiesPath);
		}

		args.push('--', videoUrl);

		// --dump-json output can be larger than the 1 MB default buffer
		const { stdout } = await execFileAsync('yt-dlp', args, { shell: false, maxBuffer: 64 * 1024 * 1024 });
		const metadata = JSON.parse(stdout);

		// Return only relevant metadata
		return {
			title: metadata.title,
			description: metadata.description,
			duration: metadata.duration,
			uploader: metadata.uploader,
			upload_date: metadata.upload_date,
			view_count: metadata.view_count,
			like_count: metadata.like_count,
			channel: metadata.channel,
			categories: metadata.categories,
			tags: metadata.tags,
			thumbnail: metadata.thumbnail,
		};
	} catch (error) {
		console.error('Failed to get metadata:', error);
		return {};
	}
}
