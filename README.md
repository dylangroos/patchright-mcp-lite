# Patchright Lite MCP Server

A streamlined Model Context Protocol (MCP) server that wraps the Patchright Node.js SDK to provide stealth browser automation capabilities to AI models. This lightweight server focuses on essential functionality to make it easier for simpler AI models to use.

## What is Patchright?

Patchright is an undetected version of the Playwright testing and automation framework. It's designed as a drop-in replacement for Playwright, but with advanced stealth capabilities to avoid detection by anti-bot systems. Patchright patches various detection techniques including:

- Runtime.enable leak
- Console.enable leak
- Command flags leaks
- General detection points
- Closed Shadow Root interactions

This MCP server wraps the Node.js version of Patchright to make its capabilities available to AI models through a simple, standardized protocol.

## Features

- **Simple Interface**: Focused on core functionality with just 4 essential tools
- **Stealth Automation**: Uses Patchright's stealth mode to avoid detection
- **MCP Standard**: Implements the Model Context Protocol for easy AI integration
- **Stdio Transport**: Uses standard input/output for seamless integration

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/patchright-lite-mcp-server.git
   cd patchright-lite-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

4. Install Chromium-Driver for Pathright:
   ```bash
  npx patchright install chromium
   ```


## Usage

Run the server with:

```bash
npm start
```

This will start the server with stdio transport, making it ready to integrate with AI tools that support MCP.

## Integrating with AI Models

### Claude Desktop

Add this to your `claude-desktop-config.json` file:

```json
{
  "mcpServers": {
    "patchright": {
      "command": "node",
      "args": ["path/to/patchright-lite-mcp-server/dist/index.js"]
    }
  }
}
```

### VS Code with GitHub Copilot

Use the VS Code CLI to add the MCP server:

```bash
code --add-mcp '{"name":"patchright","command":"node","args":["path/to/patchright-lite-mcp-server/dist/index.js"]}'
```

## Available Tools

The server provides just 4 essential tools:

### 1. browse

Launches a browser, navigates to a URL, and extracts content.

```
Tool: browse
Parameters: {
  "url": "https://example.com",
  "headless": true,
  "waitFor": 1000
}
```

Returns:
- Page title
- Visible text preview
- Browser ID (for subsequent operations)
- Page ID (for subsequent operations)
- Screenshot path

### 2. interact

Performs a simple interaction on a page.

```
Tool: interact
Parameters: {
  "browserId": "browser-id-from-browse",
  "pageId": "page-id-from-browse",
  "action": "click", // can be "click", "fill", or "select"
  "selector": "#submit-button",
  "value": "Hello World" // only needed for fill and select
}
```

Returns:
- Action result
- Current URL
- Screenshot path

### 3. extract

Extracts specific content from the current page.

```
Tool: extract
Parameters: {
  "browserId": "browser-id-from-browse",
  "pageId": "page-id-from-browse",
  "type": "text" // can be "text", "html", or "screenshot"
}
```

Returns:
- Extracted content based on the requested type

### 4. close

Closes a browser to free resources.

```
Tool: close
Parameters: {
  "browserId": "browser-id-from-browse"
}
```

## Example Usage Flow

1. Launch a browser and navigate to a site:
   ```
   Tool: browse
   Parameters: {
     "url": "https://example.com/login",
     "headless": false
   }
   ```

2. Fill in a login form:
   ```
   Tool: interact
   Parameters: {
     "browserId": "browser-id-from-step-1",
     "pageId": "page-id-from-step-1",
     "action": "fill",
     "selector": "#username",
     "value": "user@example.com"
   }
   ```

3. Fill in password:
   ```
   Tool: interact
   Parameters: {
     "browserId": "browser-id-from-step-1",
     "pageId": "page-id-from-step-1",
     "action": "fill",
     "selector": "#password",
     "value": "password123"
   }
   ```

4. Click the login button:
   ```
   Tool: interact
   Parameters: {
     "browserId": "browser-id-from-step-1",
     "pageId": "page-id-from-step-1",
     "action": "click",
     "selector": "#login-button"
   }
   ```

5. Extract text to verify login:
   ```
   Tool: extract
   Parameters: {
     "browserId": "browser-id-from-step-1",
     "pageId": "page-id-from-step-1",
     "type": "text"
   }
   ```

6. Close the browser:
   ```
   Tool: close
   Parameters: {
     "browserId": "browser-id-from-step-1"
   }
   ```

## Security Considerations

- This server provides powerful automation capabilities. Use it responsibly and ethically.
- Avoid automating actions that would violate websites' terms of service.
- Be mindful of rate limits and don't overload websites with requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Patchright-nodejs by Kaliiiiiiiiii-Vinyzu
- Model Context Protocol by modelcontextprotocol

## Docker Usage

You can run this server using Docker:

```bash
docker run -it --rm dylangroos/patchright-mcp
```

### Building the Docker Image Locally

Build the Docker image:

```bash
docker build -t patchright-mcp .
```

Run the container:

```bash
docker run -it --rm patchright-mcp
```

### Docker Hub

The image is automatically published to Docker Hub when changes are merged to the main branch.
You can find the latest image at: [dylangroos/patchright-mcp](https://hub.docker.com/r/dylangroos/patchright-mcp)