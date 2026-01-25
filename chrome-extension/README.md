# Article to Audio - Chrome Extension

Convert any article to natural-sounding audio with AI, directly from your browser.

## Features

- **📄 This Page Mode**: Automatically extract and convert the current page to audio
- **🔗 URL Mode**: Submit any article URL to scrape and convert
- **🎨 Beautiful UI**: Matches the main app's dark theme and design
- **⚡ Quick Actions**:
  - Add to library (save for later)
  - Generate audio now (opens voice selection)
- **🎵 Smart Content Extraction**: Intelligently finds article content on any page
- **⚙️ Configurable**: Set your own server URL (localhost or production)

## Installation

### Step 1: Generate Icons

1. Open `create-icons.html` in your browser
2. Right-click each canvas and save as:
   - `icons/icon-16.png`
   - `icons/icon-32.png`
   - `icons/icon-48.png`
   - `icons/icon-128.png`

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension icon should appear in your toolbar!

## Usage

### This Page Mode (Default)

1. Navigate to any article you want to convert
2. Click the extension icon
3. See the auto-detected page info (title, word count)
4. Choose:
   - **Add to Library**: Saves article for later
   - **Generate Audio Now**: Opens voice selection immediately

### URL Mode

1. Click the extension icon
2. Switch to "URL" tab
3. Paste any article URL
4. Choose to add to library or generate audio now

## Configuration

### Server URL

By default, the extension connects to `http://localhost:3000`. To change this:

1. Click the extension icon
2. Scroll to "Server URL" at the bottom
3. Enter your server URL (e.g., `https://your-app.vercel.app`)
4. The setting is saved automatically

## Development

### Files Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── scripts/
│   ├── popup.js          # Popup logic
│   ├── content.js        # Content extraction
│   └── background.js     # Background service worker
├── icons/                # Extension icons (16, 32, 48, 128)
├── create-icons.html     # Icon generator tool
└── README.md            # This file
```

### API Endpoints Used

- `POST /api/article/validate` - Save pasted/scraped content
- `POST /api/article/scrape` - Scrape content from URL
- `GET /api/voices` - Get available voices (for future features)

### Content Extraction Strategy

The extension tries multiple methods to find article content:

1. `<article>` tag
2. `<main>` or `[role="main"]`
3. Common content class names (`.article-content`, `.post-content`, etc.)
4. Fallback to body text

It also removes common noise elements:
- Navigation bars
- Headers/footers
- Sidebars
- Advertisements
- Comments sections

## Permissions Explained

- **activeTab**: Access the current tab's content
- **scripting**: Inject content extraction scripts
- **storage**: Save server URL preference
- **host_permissions**: Connect to your TTS server

## Troubleshooting

### Extension icon doesn't appear
- Make sure you loaded the extension in `chrome://extensions/`
- Check that Developer mode is enabled
- Try reloading the extension

### "Could not extract page info"
- Some pages (Chrome settings, new tab) cannot be accessed by extensions
- Try a regular article or blog post
- Check browser console for errors

### Connection failed
- Verify your server is running
- Check the server URL in settings
- Make sure CORS is enabled on your server

### Content extraction is poor
- Some sites have complex layouts that are hard to parse
- Try using URL mode instead of This Page mode
- Report problematic sites for future improvements

## Future Enhancements

- [ ] Keyboard shortcuts
- [ ] Right-click context menu integration
- [ ] Batch processing multiple URLs
- [ ] Offline queue when server is unavailable
- [ ] Direct voice selection in popup
- [ ] Progress notifications
- [ ] Reading history sync

## Support

For issues or feature requests, visit the main app repository.
