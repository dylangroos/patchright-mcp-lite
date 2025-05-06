// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

// Import the Patchright library
// This is the Node.js version of Patchright which is a stealth browser automation tool
// based on Playwright but with anti-detection features
import { chromium, Browser, Page } from "patchright";

// Create temp directory for screenshots
const TEMP_DIR = path.join(os.tmpdir(), 'patchright-mcp');

// Ensure temp directory exists
(async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.error(`Temp directory created at: ${TEMP_DIR}`);
  } catch (error) {
    console.error(`Error creating temp directory: ${error}`);
  }
})();

// Keep track of browser instances and pages
interface BrowserInstance {
  browser: Browser;
  pages: Map<string, Page>;
}

const browserInstances = new Map<string, BrowserInstance>();

const server = new McpServer({
  name: "patchright-lite",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Tool 1: Browse - Launch browser and visit a URL
server.tool(
  "browse",
  "Browse to a URL and return the page title and visible text",
  {
    url: z.string().url().describe("The URL to navigate to"),
    headless: z.boolean().default(false).describe("Whether to run the browser in headless mode"),
    waitFor: z.number().default(1000).describe("Time to wait after page load (milliseconds)")
  },
  async ({ url, headless, waitFor }: { url: string; headless: boolean; waitFor: number }) => {
    try {
      // Generate unique IDs for tracking
      const browserId = randomUUID();
      const pageId = randomUUID();
      
      // Launch browser with stealth settings
      const browser = await chromium.launch({
        headless: headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      // Create a context and page
      const context = await browser.newContext({
        viewport: null // Avoid detection by not using default viewport
      });
      const page = await context.newPage();
      
      // Store browser and page references
      browserInstances.set(browserId, {
        browser,
        pages: new Map([[pageId, page]])
      });
      
      // Navigate to the URL using isolated context for stealth
      await page.goto(url);
      await page.waitForTimeout(waitFor);
      
      // Get page title
      const title = await page.title();
      
      // Extract visible text with stealth (isolated context)
      // This ensures the page doesn't detect us using Runtime.evaluate
      const visibleText = await page.evaluate(`
        Array.from(document.querySelectorAll('body, body *'))
          .filter(element => {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          })
          .map(element => element.textContent)
          .filter(text => text && text.trim().length > 0)
          .join('\\n')
      `) as string;
      
      // Take a screenshot
      const screenshotPath = path.join(TEMP_DIR, `screenshot-${pageId}.png`);
      await page.screenshot({ path: screenshotPath });
      
      // Return a formatted response for the AI model
      return {
        content: [
          {
            type: "text",
            text: `Successfully browsed to: ${url}\n\nPage Title: ${title}\n\nVisible Text Preview:\n${visibleText.substring(0, 1500)}${visibleText.length > 1500 ? '...' : ''}\n\nBrowser ID: ${browserId}\nPage ID: ${pageId}\nScreenshot saved to: ${screenshotPath}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to browse: ${error}`
          }
        ]
      };
    }
  }
);

// Tool 2: Interact - Perform simple interactions on a page
server.tool(
  "interact",
  "Perform simple interactions on a page",
  {
    browserId: z.string().describe("Browser ID from a previous browse operation"),
    pageId: z.string().describe("Page ID from a previous browse operation"),
    action: z.enum(["click", "fill", "select"]).describe("The type of interaction to perform"),
    selector: z.string().describe("CSS selector for the element to interact with"),
    value: z.string().optional().describe("Value for fill/select actions")
  },
  async ({ browserId, pageId, action, selector, value }: { 
    browserId: string; 
    pageId: string; 
    action: "click" | "fill" | "select"; 
    selector: string; 
    value?: string 
  }) => {
    try {
      // Get the browser instance and page
      const instance = browserInstances.get(browserId);
      if (!instance) {
        throw new Error(`Browser instance not found: ${browserId}`);
      }
      
      const page = instance.pages.get(pageId);
      if (!page) {
        throw new Error(`Page not found: ${pageId}`);
      }
      
      // Perform the requested action
      let actionResult = '';
      switch (action) {
        case "click":
          await page.click(selector);
          actionResult = `Clicked on element: ${selector}`;
          break;
        case "fill":
          if (!value) {
            throw new Error("Value is required for fill action");
          }
          await page.fill(selector, value);
          actionResult = `Filled element ${selector} with value: ${value}`;
          break;
        case "select":
          if (!value) {
            throw new Error("Value is required for select action");
          }
          await page.selectOption(selector, value);
          actionResult = `Selected option ${value} in element: ${selector}`;
          break;
      }
      
      // Wait a moment for any results of the interaction
      await page.waitForTimeout(1000);
      
      // Take a screenshot of the result
      const screenshotPath = path.join(TEMP_DIR, `screenshot-${pageId}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      
      // Get current URL after interaction
      const currentUrl = page.url();
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully performed action.\n\n${actionResult}\n\nCurrent URL: ${currentUrl}\n\nScreenshot saved to: ${screenshotPath}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to interact with page: ${error}`
          }
        ]
      };
    }
  }
);

// Tool 3: Extract - Get information from the current page
server.tool(
  "extract",
  "Extract information from the current page as text, html, or screenshot",
  {
    browserId: z.string().describe("Browser ID from a previous browse operation"),
    pageId: z.string().describe("Page ID from a previous browse operation"),
    type: z.enum(["text", "html", "screenshot"]).describe("Type of content to extract")
  },
  async ({ browserId, pageId, type }: { 
    browserId: string; 
    pageId: string; 
    type: "text" | "html" | "screenshot" 
  }) => {
    try {
      // Get the browser instance and page
      const instance = browserInstances.get(browserId);
      if (!instance) {
        throw new Error(`Browser instance not found: ${browserId}`);
      }
      
      const page = instance.pages.get(pageId);
      if (!page) {
        throw new Error(`Page not found: ${pageId}`);
      }
      
      let extractedContent = '';
      let screenshotPath = '';
      
      // Extract content based on requested type
      switch (type) {
        case "text":
          // Get visible text with stealth isolation
          extractedContent = await page.evaluate(`
            Array.from(document.querySelectorAll('body, body *'))
              .filter(element => {
                const style = window.getComputedStyle(element);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              })
              .map(element => element.textContent)
              .filter(text => text && text.trim().length > 0)
              .join('\\n')
          `) as string;
          break;
        case "html":
          // Get HTML content
          extractedContent = await page.content();
          break;
        case "screenshot":
          // Take a screenshot
          screenshotPath = path.join(TEMP_DIR, `screenshot-${pageId}-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath });
          extractedContent = `Screenshot saved to: ${screenshotPath}`;
          break;
      }
      
      return {
        content: [
          {
            type: "text",
            text: type === "text" || type === "screenshot" 
              ? extractedContent.substring(0, 2000) + (extractedContent.length > 2000 ? '...' : '')
              : `Extracted HTML content (${extractedContent.length} characters). First 100 characters:\n${extractedContent.substring(0, 100)}...`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to extract content: ${error}`
          }
        ]
      };
    }
  }
);

// Tool 4: Close - Close browser to free resources
server.tool(
  "close",
  "Close browser to free resources",
  {
    browserId: z.string().describe("Browser ID to close")
  },
  async ({ browserId }: { browserId: string }) => {
    try {
      // Get the browser instance
      const instance = browserInstances.get(browserId);
      if (!instance) {
        throw new Error(`Browser instance not found: ${browserId}`);
      }
      
      // Close the browser
      await instance.browser.close();
      
      // Remove from the map
      browserInstances.delete(browserId);
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully closed browser: ${browserId}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to close browser: ${error}`
          }
        ]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});