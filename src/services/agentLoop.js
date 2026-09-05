const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// Thrown when Claude's response got cut off (hit max_tokens) instead of
// ending cleanly, instead of pushing it to history — a truncated assistant
// turn can contain a half-formed tool_use block with no way to resolve it,
// which corrupts every later call in the conversation. The loop only
// protects history; callers decide what to tell the user.
class ResponseTruncatedError extends Error {
  constructor() {
    super('Claude response was truncated (max_tokens)');
  }
}

// Runs one full exchange with Claude: pushes the user turn onto `history`,
// resolves any tool_use blocks via `executeTool` (every call wrapped in
// try/catch — a throwing tool becomes a {success:false} result Claude sees,
// instead of corrupting the conversation by leaving a tool_use without a
// matching tool_result), and returns the final assistant text.
//
// `executeTool(toolName, input)` — callers close over whatever extra
// context they need (session, psid, etc.); the loop itself only knows
// tool name + input.
// `onProgress(history)` — optional, called after each resolved batch of
// tool calls and once more before returning. Lets a caller persist partial
// progress mid-turn (e.g. adminAgent.js's saveSession) instead of only at
// the very end.
async function runAgentLoop({ history, userContent, systemPrompt, tools, model, maxTokens, executeTool, onProgress }) {
  history.push({ role: 'user', content: userContent });

  const request = () =>
    anthropic.messages.create({ model, max_tokens: maxTokens, system: systemPrompt, tools, messages: history });

  let response = await request();

  while (response.stop_reason === 'tool_use') {
    history.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      let result;
      try {
        result = await executeTool(block.name, block.input);
      } catch (err) {
        console.error(`Tool "${block.name}" failed:`, err);
        result = { success: false, reason: `internal error: ${err.message || 'unknown'}` };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
    }

    history.push({ role: 'user', content: toolResults });
    if (onProgress) onProgress(history);

    response = await request();
  }

  if (response.stop_reason === 'max_tokens') {
    throw new ResponseTruncatedError();
  }

  const finalText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  history.push({ role: 'assistant', content: response.content });
  if (onProgress) onProgress(history);

  return finalText;
}

module.exports = { runAgentLoop, ResponseTruncatedError };
