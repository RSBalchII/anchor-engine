(function () {
  let extractedContent = [];
  const seenContent = new Set();

  // Selectors
  const allMessageContainersSelector = "user-query, model-response";
  const thinkingProcessSelector = '[data-test-id="thoughts-content"] .markdown';
  const thinkingButtonSelector =
    'button[data-test-id="thoughts-header-button"]';

  const selectorsToRemove = [
    "message-actions",
    "response-container-header",
    ".response-footer",
    "bard-avatar",
    ".bot-name",
    ".tooltip-anchor-point",
    ".query-content button",
    "tts-control",
    ".restart-chat-button-scroll-placeholder",
  ];

  // Click all "Show thinking" buttons
  const thoughtButtons = document.querySelectorAll(thinkingButtonSelector);
  thoughtButtons.forEach((button) => {
    if (!button.closest(".thoughts-content-expanded")) {
      button.click();
    }
  });

  setTimeout(() => {
    document
      .querySelectorAll(allMessageContainersSelector)
      .forEach((container) => {
        const type = container.matches("user-query") ? "User" : "Coda C-001";
        const clone = container.cloneNode(true);

        // Remove unwanted elements
        selectorsToRemove.forEach((selector) => {
          clone.querySelectorAll(selector).forEach((el) => el.remove());
        });

        // Base message structure
        let structuredContent = {
          type: type,
          timestamp: new Date().toISOString(),
          response_content: "",
          thinking_content: "",
        };

        if (type === "Coda C-001") {
          // First extract thinking content from original container
          const thinkingEl = container.querySelector(thinkingProcessSelector);
          if (thinkingEl) {
            structuredContent.thinking_content = thinkingEl.textContent
              .trim()
              .replace(/\s\s+/g, " ")
              .replace(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*):/g, "### $1:\n")
              .replace(/(\.)([A-Z])/g, "$1\n\n$2");
          }

          // Remove ALL thinking-related elements from the response clone
          clone
            .querySelectorAll('[data-test-id^="thoughts-"]')
            .forEach((el) => el.remove());
        }

        // Get clean response text after all processing
        structuredContent.response_content = clone.textContent
          .trim()
          .replace(/\s\s+/g, " ")
          .replace(/Show\s?thinking/g, "")
          .replace(structuredContent.thinking_content, ""); // Remove any thinking content that might have leaked

        // Clean up any leftover artifacts
        structuredContent.response_content = structuredContent.response_content
          .replace(/^\s+/, "")
          .replace(/\s+$/, "");

        // Deduplication check
        const contentKey = `${type}:${structuredContent.response_content}:${structuredContent.thinking_content}`;
        if (
          structuredContent.response_content ||
          structuredContent.thinking_content
        ) {
          if (!seenContent.has(contentKey)) {
            seenContent.add(contentKey);
            extractedContent.push(structuredContent);
          }
        }
      });

    // YAML conversion helper
    const toYamlBlock = (text) => {
      if (!text) return '""';
      // Use block scalar |-, indent lines by 4 spaces
      return `|-\n    ${text.replace(/\n/g, '\n    ')}`;
    };

    const yamlOutput = extractedContent.map(entry => {
      return `- type: ${JSON.stringify(entry.type)}
  timestamp: ${JSON.stringify(entry.timestamp)}
  response_content: ${toYamlBlock(entry.response_content)}
  thinking_content: ${toYamlBlock(entry.thinking_content)}`;
    }).join('\n\n');

    console.log(yamlOutput);
    navigator.clipboard
      .writeText(yamlOutput)
      .then(() => console.log("YAML copied to clipboard!"))
      .catch((err) => console.error("Failed to copy:", err));
  }, 1000); // Increased delay for better results
})();