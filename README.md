# n8n-nodes-ytdlp-transcript

An n8n node for extracting video transcripts using yt-dlp with support for cookies and multiple output formats.

## Features

- **Video Transcript Extraction**: Extract transcripts from YouTube and other video platforms
- **Multiple Cookie Sources**: Support for browser cookies, file-based cookies, and binary cookies
- **Language Selection**: Single language or comma-separated priority list (e.g., "en,es,fr")
- **Output Formats**: Clean text, timestamped text, structured JSON, or Markdown
- **Browser Cookie Support**: Direct integration with Chrome, Firefox, Safari, Edge, Opera, and Brave
- **Metadata Extraction**: Automatically retrieves video metadata alongside transcripts

## Installation

### Option 1: Local Development
1. Clone this repository
2. Run `npm run build`
3. Install in n8n: `npm install /path/to/n8n-nodes-ytdlp-transcript`

### Option 2: n8n Community Nodes
```bash
# Install in n8n custom nodes directory
cd ~/.n8n/nodes
npm install n8n-nodes-ytdlp-transcript
```

## Prerequisites

- **yt-dlp**: Must be installed and available in your system PATH
  ```bash
  # Install yt-dlp
  pip install yt-dlp
  # or
  brew install yt-dlp
  ```

## Usage

### Basic Usage
1. Add the "YT-DLP Transcript" node to your n8n workflow
2. Enter a video URL (YouTube, Vimeo, etc.)
3. Select desired language (default: "en")
4. Choose output format
5. Execute the workflow

### Cookie Authentication
For accessing private or age-restricted content:

#### Browser Cookies (Recommended)
1. Enable "Use Browser Cookies" in Additional Options
2. Select your browser (Chrome, Firefox, Safari, Edge, Opera, Brave)
3. The node will automatically extract cookies from your browser

#### File-based Cookies
1. Export cookies from your browser to Netscape format
2. Set "Cookies File" path in Additional Options

#### Binary Cookies
1. Pass cookies as binary data in your workflow
2. Enable "Use Cookies from Binary"
3. Specify the binary property name (default: "cookies")

### Language Selection
- **Single language**: `en` (English)
- **Priority list**: `en,es,fr` (tries English first, then Spanish, then French)
- **Available languages**: Depends on the video source

### Output Formats

#### Clean Text
Plain text transcript without timestamps:
```
Hello everyone, welcome to this tutorial about n8n workflows...
```

#### Text with Timestamps
Text with timestamp markers:
```
[00:00:00] Hello everyone, welcome to this tutorial about n8n workflows
[00:00:15] Today we'll be learning how to extract video transcripts
```

#### Structured JSON
Complete data structure with segments:
```json
{
  "segments": [
    {
      "start": "00:00:00",
      "end": "00:00:15",
      "text": "Hello everyone, welcome to this tutorial"
    }
  ],
  "fullText": "Hello everyone, welcome to this tutorial...",
  "duration": "00:15:30",
  "segmentCount": 45
}
```

#### Markdown
Markdown format with timestamps as headers:
```markdown
### 00:00:00
Hello everyone, welcome to this tutorial about n8n workflows

### 00:00:15
Today we'll be learning how to extract video transcripts
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| Video URL | String | URL of the video to extract transcript from |
| Language | String | Language code(s) for transcript (single or comma-separated) |
| Output Format | Options | Format of the output transcript |
| **Additional Options** | | |
| Cookies File | String | Path to cookies file (Netscape format) |
| Use Browser Cookies | Boolean | Extract cookies from installed browser |
| Browser Name | Options | Browser to extract cookies from |
| Use Cookies from Binary | Boolean | Use cookies from incoming binary data |
| Binary Property Name | String | Name of binary property containing cookies |
| Remove Duplicate Lines | Boolean | Remove duplicate subtitle lines (default: true) |
| Include Speaker Labels | Boolean | Include speaker labels if available |
| Proxy | String | Proxy server URL |
| User Agent | String | Custom user agent string |

## Output Data

The node outputs JSON with the following structure:
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=example",
  "language": "en",
  "transcript": "Extracted transcript text...",
  "format": "cleanText",
  "metadata": {
    "title": "Video Title",
    "description": "Video description",
    "duration": 1800,
    "uploader": "Channel Name",
    "upload_date": "20231201",
    "view_count": 10000,
    "like_count": 500,
    "channel": "Channel Name",
    "categories": ["Education"],
    "tags": ["tutorial", "n8n"],
    "thumbnail": "https://example.com/thumbnail.jpg"
  }
}
```

## Error Handling

The node includes comprehensive error handling:
- Invalid URLs
- Missing transcripts
- Authentication failures
- Network issues
- yt-dlp execution errors

Enable "Continue on Fail" to handle errors gracefully in your workflow.

## Examples

### Extract English Transcript
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "language": "en",
  "outputFormat": "cleanText"
}
```

### Multi-language with Browser Cookies
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=example",
  "language": "en,es,fr",
  "outputFormat": "structuredJson",
  "additionalOptions": {
    "useBrowserCookies": true,
    "browserName": "chrome"
  }
}
```

### Extract with Custom Settings
```json
{
  "videoUrl": "https://vimeo.com/123456789",
  "language": "en",
  "outputFormat": "markdown",
  "additionalOptions": {
    "cookiesFile": "/path/to/cookies.txt",
    "removeDuplicates": true,
    "includeSpeakerLabels": true,
    "proxy": "http://proxy.example.com:8080"
  }
}
```

## Troubleshooting

### Common Issues

1. **No transcript found**: Some videos may not have transcripts available
2. **yt-dlp not found**: Ensure yt-dlp is installed and in your PATH
3. **Cookie authentication**: For private content, use browser cookies or export cookies manually
4. **Rate limiting**: Some platforms may rate limit requests

### Debug Tips

- Check yt-dlp version: `yt-dlp --version`
- Test URL manually: `yt-dlp --list-subs "VIDEO_URL"`
- Verify cookies: `yt-dlp --cookies-from-browser chrome --list-subs "VIDEO_URL"`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Report issues: [GitHub Issues](https://github.com/RSRaven/n8n-nodes-ytdlp-transcript/issues)
- n8n Community: [n8n Community Forum](https://community.n8n.io)