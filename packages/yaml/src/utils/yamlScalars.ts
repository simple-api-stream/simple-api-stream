import {
  AliasEvent,
  EndMappingEvent,
  EndSequenceEvent,
  KeyEvent,
  ScalarEvent,
  StartMappingEvent,
  StartSequenceEvent,
} from "../event/index.js";
import type { SAYEventInterface, ScalarSAYEventInterface } from "../event-interface/index.js";

const INT_DEC_RE = /^[-+]?[0-9]+$/;
const INT_OCT_RE = /^0o[0-7]+$/;
const INT_HEX_RE = /^0x[0-9a-fA-F]+$/;
const FLOAT_RE = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;
const INF_POS_RE = /^[+]?\.(inf|Inf|INF)$/;
const INF_NEG_RE = /^-\.(inf|Inf|INF)$/;
const NAN_RE = /^\.(nan|NaN|NAN)$/;

/**
 * Resolves an unquoted YAML 1.2 Core Schema plain scalar into a typed `ScalarEvent`.
 */
export function resolvePlainScalar(
  raw: string,
  meta?: { anchor?: string, tag?: string },
): ScalarSAYEventInterface {
  if (meta?.tag === "!!str") {
    return new ScalarEvent("string", raw, { style: "plain", ...meta }).toInterface();
  }
  if (raw === "" || raw === "~" || raw === "null" || raw === "Null" || raw === "NULL") {
    return new ScalarEvent("null", null, { style: "plain", ...meta }).toInterface();
  }
  if (raw === "true" || raw === "True" || raw === "TRUE") {
    return new ScalarEvent("boolean", true, { style: "plain", ...meta }).toInterface();
  }
  if (raw === "false" || raw === "False" || raw === "FALSE") {
    return new ScalarEvent("boolean", false, { style: "plain", ...meta }).toInterface();
  }
  if (INT_DEC_RE.test(raw)) {
    return new ScalarEvent("number", Number(raw), { style: "plain", ...meta }).toInterface();
  }
  if (INT_OCT_RE.test(raw)) {
    return new ScalarEvent("number", Number.parseInt(raw.slice(2), 8), { style: "plain", ...meta }).toInterface();
  }
  if (INT_HEX_RE.test(raw)) {
    return new ScalarEvent("number", Number.parseInt(raw.slice(2), 16), { style: "plain", ...meta }).toInterface();
  }
  if (FLOAT_RE.test(raw)) {
    return new ScalarEvent("number", Number(raw), { style: "plain", ...meta }).toInterface();
  }
  if (INF_POS_RE.test(raw)) {
    return new ScalarEvent("number", Number.POSITIVE_INFINITY, { style: "plain", ...meta }).toInterface();
  }
  if (INF_NEG_RE.test(raw)) {
    return new ScalarEvent("number", Number.NEGATIVE_INFINITY, { style: "plain", ...meta }).toInterface();
  }
  if (NAN_RE.test(raw)) {
    return new ScalarEvent("number", Number.NaN, { style: "plain", ...meta }).toInterface();
  }
  return new ScalarEvent("string", raw, { style: "plain", ...meta }).toInterface();
}

function parseHexEscape(text: string, start: number, digits: number): string {
  const slice = text.slice(start, start + digits);
  if (slice.length !== digits || !/^[0-9a-fA-F]+$/.test(slice)) {
    throw new Error(`Invalid hex escape sequence: \\${slice}`);
  }
  return String.fromCodePoint(Number.parseInt(slice, 16));
}

/**
 * Parses a YAML double-quoted string starting at `start` (pointing to `"`).
 */
export function parseDoubleQuoted(text: string, start = 0): { value: string, endIndex: number } {
  let out = "";
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\"") {
      return { value: out, endIndex: i + 1 };
    }
    if (ch === "\\") {
      i++;
      if (i >= text.length) {
        throw new Error("Unterminated double-quoted string");
      }
      const esc = text[i];
      switch (esc) {
        case "0":
          out += "\0";
          break;
        case "a":
          out += "\x07";
          break;
        case "b":
          out += "\b";
          break;
        case "t":
        case "\t":
          out += "\t";
          break;
        case "n":
          out += "\n";
          break;
        case "v":
          out += "\v";
          break;
        case "f":
          out += "\f";
          break;
        case "r":
          out += "\r";
          break;
        case "e":
          out += "\x1B";
          break;
        case " ":
          out += " ";
          break;
        case "\"":
          out += "\"";
          break;
        case "/":
          out += "/";
          break;
        case "\\":
          out += "\\";
          break;
        case "x":
          out += parseHexEscape(text, i + 1, 2);
          i += 2;
          break;
        case "u":
          out += parseHexEscape(text, i + 1, 4);
          i += 4;
          break;
        case "U":
          out += parseHexEscape(text, i + 1, 8);
          i += 8;
          break;
        default:
          throw new Error(`Unknown escape sequence: \\${esc}`);
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  throw new Error("Unterminated double-quoted string");
}

/**
 * Parses a YAML single-quoted string starting at `start` (pointing to `'`).
 */
export function parseSingleQuoted(text: string, start = 0): { value: string, endIndex: number } {
  let out = "";
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      if (text[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, endIndex: i + 1 };
    }
    out += ch;
    i++;
  }
  throw new Error("Unterminated single-quoted string");
}

/**
 * Strips an unquoted trailing `# ...` comment (preceded by whitespace or at index 0) from a YAML line.
 */
export function stripTrailingComment(text: string): { content: string, comment?: string } {
  let quote: "\"" | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote === "\"") {
      if (ch === "\\") {
        i++;
      }
      else if (ch === "\"") {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        if (text[i + 1] === "'") {
          i++;
        }
        else {
          quote = null;
        }
      }
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
    }
    else if (ch === "#" && (i === 0 || text[i - 1] === " " || text[i - 1] === "\t")) {
      return {
        content: text.slice(0, i).trimEnd(),
        comment: text.slice(i + 1),
      };
    }
  }
  return { content: text.trimEnd() };
}

/**
 * Extracts optional leading `&anchor` and `!tag` properties from a YAML node string.
 */
export function extractNodeProperties(text: string): {
  rest: string
  anchor?: string
  tag?: string
} {
  let rest = text.trimStart();
  let anchor: string | undefined;
  let tag: string | undefined;

  while (rest.length > 0) {
    if (rest.startsWith("&") && anchor === undefined) {
      const m = /^&([^\s,[\]{}]+)(?:\s+|$)/.exec(rest);
      if (!m) throw new Error(`Invalid anchor syntax: ${rest}`);
      anchor = m[1];
      rest = rest.slice(m[0].length);
      continue;
    }
    if (rest.startsWith("!") && tag === undefined) {
      const m = /^(!\S*)(?:\s+|$)/.exec(rest);
      if (!m) throw new Error(`Invalid tag syntax: ${rest}`);
      tag = m[1];
      rest = rest.slice(m[0].length);
      continue;
    }
    break;
  }

  return {
    rest,
    ...(anchor !== undefined ? { anchor } : {}),
    ...(tag !== undefined ? { tag } : {}),
  };
}

/**
 * Computes net flow bracket/brace nesting balance (`[`/`{` minus `]`/`}`) outside quotes.
 */
export function computeFlowDepthDelta(text: string): number {
  let delta = 0;
  let quote: "\"" | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote === "\"") {
      if (ch === "\\") i++;
      else if (ch === "\"") quote = null;
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        if (text[i + 1] === "'") i++;
        else quote = null;
      }
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
    }
    else if (ch === "[" || ch === "{") {
      delta++;
    }
    else if (ch === "]" || ch === "}") {
      delta--;
    }
  }
  return delta;
}

/**
 * Parses a YAML flow node (`{ ... }`, `[ ... ]`, quoted scalar, alias, or plain scalar) into SAY events.
 */
export function parseFlowNode(
  input: string,
  initialMeta?: { anchor?: string, tag?: string },
): SAYEventInterface[] {
  const events: SAYEventInterface[] = [];
  let pos = 0;

  const skipWs = (): void => {
    while (pos < input.length && (input[pos] === " " || input[pos] === "\t" || input[pos] === "\n" || input[pos] === "\r")) {
      pos++;
    }
  };

  const readProperties = (inherited?: { anchor?: string, tag?: string }): { anchor?: string, tag?: string } => {
    let anchor = inherited?.anchor;
    let tag = inherited?.tag;
    while (pos < input.length) {
      skipWs();
      if (input[pos] === "&" && anchor === undefined) {
        const rest = input.slice(pos);
        const m = /^&([^\s,[\]{}]+)/.exec(rest);
        if (!m) throw new Error("Invalid anchor in flow node");
        anchor = m[1];
        pos += m[0].length;
        continue;
      }
      if (input[pos] === "!" && tag === undefined) {
        const rest = input.slice(pos);
        const m = /^(!\S*)/.exec(rest);
        if (!m) throw new Error("Invalid tag in flow node");
        tag = m[1];
        pos += m[0].length;
        continue;
      }
      break;
    }
    return {
      ...(anchor !== undefined ? { anchor } : {}),
      ...(tag !== undefined ? { tag } : {}),
    };
  };

  const parseValue = (inherited?: { anchor?: string, tag?: string }): void => {
    skipWs();
    const meta = readProperties(inherited);
    skipWs();
    if (pos >= input.length) {
      events.push(new ScalarEvent("null", null, { style: "plain", ...meta }).toInterface());
      return;
    }
    const ch = input[pos];
    if (ch === "[") {
      pos++;
      events.push(new StartSequenceEvent({ flow: true, ...meta }));
      skipWs();
      while (pos < input.length && input[pos] !== "]") {
        parseValue();
        skipWs();
        if (input[pos] === ",") {
          pos++;
          skipWs();
        }
        else if (input[pos] !== "]") {
          throw new Error(`Expected ',' or ']' in flow sequence at position ${pos}`);
        }
      }
      if (input[pos] !== "]") {
        throw new Error("Unterminated flow sequence");
      }
      pos++;
      events.push(new EndSequenceEvent());
      return;
    }
    if (ch === "{") {
      pos++;
      events.push(new StartMappingEvent({ flow: true, ...meta }));
      skipWs();
      while (pos < input.length && input[pos] !== "}") {
        const key = parseFlowKey();
        events.push(new KeyEvent(key));
        skipWs();
        if (input[pos] === ":") {
          pos++;
          skipWs();
          if (input[pos] === "," || input[pos] === "}") {
            events.push(new ScalarEvent("null", null, { style: "plain" }).toInterface());
          }
          else {
            parseValue();
          }
        }
        else {
          events.push(new ScalarEvent("null", null, { style: "plain" }).toInterface());
        }
        skipWs();
        if (input[pos] === ",") {
          pos++;
          skipWs();
        }
        else if (input[pos] !== "}") {
          throw new Error(`Expected ',' or '}' in flow mapping at position ${pos}`);
        }
      }
      if (input[pos] !== "}") {
        throw new Error("Unterminated flow mapping");
      }
      pos++;
      events.push(new EndMappingEvent());
      return;
    }
    if (ch === "\"") {
      const parsed = parseDoubleQuoted(input, pos);
      pos = parsed.endIndex;
      events.push(new ScalarEvent("string", parsed.value, { style: "double", ...meta }).toInterface());
      return;
    }
    if (ch === "'") {
      const parsed = parseSingleQuoted(input, pos);
      pos = parsed.endIndex;
      events.push(new ScalarEvent("string", parsed.value, { style: "single", ...meta }).toInterface());
      return;
    }
    if (ch === "*") {
      const rest = input.slice(pos);
      const m = /^\*([^\s,[\]{}]+)/.exec(rest);
      if (!m) throw new Error("Invalid alias in flow node");
      pos += m[0].length;
      events.push(new AliasEvent(m[1]));
      return;
    }
    const start = pos;
    while (pos < input.length && input[pos] !== "," && input[pos] !== "]" && input[pos] !== "}") {
      pos++;
    }
    const raw = input.slice(start, pos).trim();
    events.push(resolvePlainScalar(raw, meta));
  };

  const parseFlowKey = (): string => {
    skipWs();
    const ch = input[pos];
    if (ch === "\"") {
      const parsed = parseDoubleQuoted(input, pos);
      pos = parsed.endIndex;
      return parsed.value;
    }
    if (ch === "'") {
      const parsed = parseSingleQuoted(input, pos);
      pos = parsed.endIndex;
      return parsed.value;
    }
    const start = pos;
    while (pos < input.length && input[pos] !== ":" && input[pos] !== "," && input[pos] !== "}") {
      pos++;
    }
    const key = input.slice(start, pos).trim();
    if (key.length === 0) {
      throw new Error(`Empty key in flow mapping at position ${pos}`);
    }
    return key;
  };

  parseValue(initialMeta);
  skipWs();
  if (pos < input.length) {
    throw new Error(`Unexpected trailing characters in flow node: ${input.slice(pos)}`);
  }
  return events;
}
