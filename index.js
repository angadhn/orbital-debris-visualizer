import { CursorAgent } from "@cursor-ai/january";

// Get API key from environment variable
const apiKey = process.env.CURSOR_API_KEY;

if (!apiKey) {
  console.error("Error: CURSOR_API_KEY environment variable is not set.");
  console.error("Please set it using:");
  console.error("  macOS/Linux: export CURSOR_API_KEY='your_api_key'");
  console.error("  Windows PowerShell: $env:CURSOR_API_KEY='your_api_key'");
  process.exit(1);
}

// Create agent with local working directory
const agent = new CursorAgent({
  apiKey: apiKey,
  model: "gpt-4o",
  workingLocation: {
    type: "local",
    localDirectory: process.cwd(),
  },
});

// Example: Submit a simple message
async function main() {
  console.log("Starting Cursor Agent...\n");

  try {
    // Submit a message and stream the results
    const { stream, conversation } = agent.submit({
      message: "Hello! Can you help me understand what this project does?",
    });

    // Stream deltas in real-time
    console.log("Streaming updates:\n");
    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        // Print text deltas as they come in
        process.stdout.write(delta.text);
      } else if (delta.type === "tool-call-started") {
        console.log(`\n[Tool call started: ${delta.toolCall.name}]`);
      } else if (delta.type === "tool-call-completed") {
        console.log(`[Tool call completed: ${delta.toolCall.name}]`);
      }
    }

    // Wait for conversation to complete
    const turns = await conversation;
    console.log("\n\nConversation completed!");
    console.log(`Total turns: ${turns.length}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();

