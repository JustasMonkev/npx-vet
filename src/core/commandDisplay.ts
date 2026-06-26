const SAFE_SHELL_TOKEN = /^[a-zA-Z0-9_./:=@%+-]+$/;
const ANSI_ESCAPE_PATTERN = /\x1B(?:\][^\x07]*(?:\x07|\x1B\\)|\[[0-?]*[ -/]*[@-~])/g;
const CONTROL_PATTERN = /[\x00-\x1F\x7F]/g;

export function sanitizeForTerminal(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(CONTROL_PATTERN, " ");
}

export function formatCommandForDisplay(command: string[]): string {
  return command.map((part) => quoteShellToken(sanitizeForTerminal(part))).join(" ");
}

function quoteShellToken(part: string): string {
  if (part.length > 0 && SAFE_SHELL_TOKEN.test(part)) {
    return part;
  }

  return `'${part.replaceAll("'", "'\\''")}'`;
}
