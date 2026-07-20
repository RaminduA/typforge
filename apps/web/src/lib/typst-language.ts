import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  syntaxHighlighting,
  type StreamParser
} from "@codemirror/language";

import {
  autocompletion,
  closeBrackets,
  type Completion,
  type CompletionContext
} from "@codemirror/autocomplete";

import type { Extension } from "@codemirror/state";

import { tags as t } from "@lezer/highlight";

type TypstMode = "markup" | "code" | "math" | "raw";

interface TypstState {
  mode: TypstMode;
  blockComment: boolean;
  rawFence: string | null;
  codeDepth: number;
  codeLineMode: boolean;
}

const codeKeywords = new Set([
  "let", "set", "show", "if", "else", "for", "in", "while", "break",
  "continue", "return", "import", "include", "as", "context"
]);

const codeLineKeywords = new Set([
  "let", "set", "show", "if", "else", "for",
  "while", "import", "include", "context"
]);

const atoms = new Set(["true", "false", "none", "auto"]);

const standardFunctions = new Set([
  "align", "arguments", "array", "assert", "bibliography", "block", "box",
  "bytes", "calc", "circle", "cite", "columns", "counter", "datetime",
  "decimal", "dictionary", "duration", "emoji", "enum", "eval", "figure",
  "float", "grid", "heading", "highlight", "image", "int", "label", "layout",
  "line", "link", "list", "locate", "lorem", "lower", "math", "metadata",
  "move", "numbering", "outline", "overline", "pad", "page", "panic", "par",
  "path", "place", "plugin", "polygon", "query", "quote", "raw", "read",
  "rect", "ref", "regex", "repeat", "repr", "rotate", "scale", "selector",
  "skew", "smartquote", "square", "stack", "state", "strike", "str", "style",
  "table", "terms", "text", "type", "underline", "upper", "version", "v", "h"
]);

const mathWords = new Set([
  "abs", "accent", "acute", "angle", "arrow", "bar", "binom", "cases",
  "cancel", "ceil", "circle", "class", "cos", "degree", "dot", "equation",
  "floor", "frac", "grave", "hat", "integral", "lr", "mat", "matrix",
  "op", "overbrace", "overbracket", "overline", "overset", "primes",
  "product", "root", "round", "sin", "sqrt", "sum", "tan", "tilde",
  "underbrace", "underbracket", "underline", "underset", "vec"
]);

function isIdentifierStart(char: string | undefined) {
  return Boolean(char && /[\p{L}_]/u.test(char));
}

function isIdentifierContinue(char: string | undefined) {
  return Boolean(char && /[\p{L}\p{N}_-]/u.test(char));
}

function eatIdentifier(stream: StringStreamLike) {
  if (!isIdentifierStart(stream.peek())) {
    return "";
  }

  let value = "";

  while (!stream.eol() && isIdentifierContinue(stream.peek())) {
    value += nextChar(stream);
  }

  return value;
}

function eatBackticks(stream: StringStreamLike) {
  let count = 0;

  while (stream.peek() === "`") {
    stream.next();
    count += 1;
  }

  return "`".repeat(count);
}

function tokenBlockComment(stream: StringStreamLike, state: TypstState) {
  while (!stream.eol()) {
    if (stream.match("*/")) {
      state.blockComment = false;
      break;
    }

    stream.next();
  }

  return "comment";
}

function tokenString(stream: StringStreamLike) {
  stream.next();

  while (!stream.eol()) {
    const char = nextChar(stream);

    if (char === "\\") {
      stream.next();
      continue;
    }

    if (char === "\"") {
      break;
    }
  }

  return "string";
}

function tokenRaw(stream: StringStreamLike, state: TypstState) {
  const fence = state.rawFence;

  if (!fence) {
    state.mode = "markup";
    return null;
  }

  while (!stream.eol()) {
    if (stream.match(fence)) {
      state.rawFence = null;
      state.mode = "markup";
      break;
    }

    stream.next();
  }

  return "raw";
}

function tokenRawStart(stream: StringStreamLike, state: TypstState) {
  const fence = eatBackticks(stream);

  if (fence.length === 0) {
    return null;
  }

  if (fence.length < 3) {
    while (!stream.eol()) {
      if (stream.match(fence)) {
        break;
      }

      stream.next();
    }

    return "raw";
  }

  while (!stream.eol()) {
    if (stream.match(fence)) {
      return "raw";
    }

    stream.next();
  }

  state.mode = "raw";
  state.rawFence = fence;

  return "raw";
}

function tokenMarkup(stream: StringStreamLike, state: TypstState) {
  if (state.blockComment) {
    return tokenBlockComment(stream, state);
  }

  if (stream.eatSpace()) {
    return null;
  }

  if (stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }

  if (stream.match("/*")) {
    state.blockComment = true;
    return "comment";
  }

  if (stream.peek() === "`") {
    return tokenRawStart(stream, state);
  }

  if (stream.match(/\\u\{[0-9a-fA-F]+\}/)) {
    return "escape";
  }

  if (stream.match(/\\./)) {
    return "escape";
  }

  if (stream.sol() && stream.match(/={1,6}(?=\s)/)) {
    return "heading";
  }

  if (stream.sol() && stream.match(/\s*[-+]\s/)) {
    return "list";
  }

  if (stream.sol() && stream.match(/\s*\/\s+[^\n:]+:/)) {
    return "term";
  }

  if (stream.match(/<[\p{L}\p{N}_:.-]+>/u)) {
    return "label";
  }

  if (stream.match(/@[\p{L}\p{N}_:.-]+/u)) {
    return "reference";
  }

  if (stream.match(/\$+/)) {
    state.mode = "math";
    return "mathDelimiter";
  }

  if (stream.peek() === "#") {
    stream.next();

    const word = eatIdentifier(stream);

    if (word) {
      state.mode = "code";
      state.codeDepth = 0;
      state.codeLineMode = codeLineKeywords.has(word);

      if (codeKeywords.has(word)) return "keyword";
      if (atoms.has(word)) return "atom";
      if (standardFunctions.has(word)) return "function";

      return "function";
    }

    state.mode = "code";
    state.codeDepth = 0;
    state.codeLineMode = false;

    return "markup";
  }

  if (stream.match(/\*[^*\n]+\*/)) {
    return "strong";
  }

  if (stream.match(/_[^_\n]+_/)) {
    return "emphasis";
  }

  stream.next();
  return null;
}

function tokenMath(stream: StringStreamLike, state: TypstState) {
  if (stream.eatSpace()) {
    return null;
  }

  if (stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }

  if (stream.match("/*")) {
    state.blockComment = true;
    return "comment";
  }

  if (state.blockComment) {
    return tokenBlockComment(stream, state);
  }

  if (stream.match(/\$+/)) {
    state.mode = "markup";
    return "mathDelimiter";
  }

  if (stream.match(/\\u\{[0-9a-fA-F]+\}/)) {
    return "escape";
  }

  if (stream.match(/\\./)) {
    return "escape";
  }

  if (stream.match(/(?:\d+(?:\.\d+)?|\.\d+)(?:pt|em|cm|mm|in|fr|%|deg|rad)?/)) {
    return "number";
  }

  if (isIdentifierStart(stream.peek())) {
    const word = eatIdentifier(stream);

    if (mathWords.has(word) || standardFunctions.has(word)) {
      return "mathFunction";
    }

    return "mathVariable";
  }

  if (stream.match(/[\[\]\{\}\(\)]/)) {
    return "bracket";
  }

  if (stream.match(/[+\-*/=<>!?:.,;|&^_]+/)) {
    return "operator";
  }

  stream.next();
  return "math";
}

function tokenCode(stream: StringStreamLike, state: TypstState) {
  if (state.blockComment) {
    return tokenBlockComment(stream, state);
  }

  if (stream.eatSpace()) {
    if (!state.codeLineMode && state.codeDepth <= 0) {
      state.mode = "markup";
    }

    return null;
  }

  if (stream.match("//")) {
    stream.skipToEnd();
    state.mode = "markup";
    state.codeLineMode = false;
    return "comment";
  }

  if (stream.match("/*")) {
    state.blockComment = true;
    return "comment";
  }

  if (stream.peek() === "\"") {
    return tokenString(stream);
  }

  if (stream.peek() === "`") {
    return tokenRawStart(stream, state);
  }

  if (stream.match(/\\u\{[0-9a-fA-F]+\}/)) {
    return "escape";
  }

  if (stream.match(/\\./)) {
    return "escape";
  }

  if (stream.match(/<[\p{L}\p{N}_:.-]+>/u)) {
    return "label";
  }

  if (stream.match(/@[\p{L}\p{N}_:.-]+/u)) {
    return "reference";
  }

  if (stream.match(/(?:\d+(?:\.\d+)?|\.\d+)(?:pt|em|cm|mm|in|fr|%|deg|rad|s|ms)?/)) {
    return "number";
  }

  if (isIdentifierStart(stream.peek())) {
    const word = eatIdentifier(stream);

    if (codeKeywords.has(word)) {
      if (codeLineKeywords.has(word)) {
        state.codeLineMode = true;
      }

      return "keyword";
    }

    if (atoms.has(word)) {
      return "atom";
    }

    if (standardFunctions.has(word)) {
      return stream.peek() === "(" || stream.peek() === "[" ? "function" : "builtin";
    }

    return stream.peek() === "(" || stream.peek() === "[" ? "function" : "variable";
  }

  if (stream.match(/[\[\{\(]/)) {
    state.codeDepth += 1;
    return "bracket";
  }

  if (stream.match(/[\]\}\)]/)) {
    state.codeDepth = Math.max(0, state.codeDepth - 1);

    if (!state.codeLineMode && state.codeDepth <= 0) {
      state.mode = "markup";
    }

    return "bracket";
  }

  if (stream.match(/=>|==|!=|<=|>=|\+=|-=|\*=|\/=|&&|\|\||\.\.|[+\-*/=<>!?:.,;|&]/)) {
    return "operator";
  }

  stream.next();
  return null;
}

interface StringStreamLike {
  eol(): boolean;
  sol(): boolean;
  peek(): string | undefined;
  next(): string | void;
  eatSpace(): boolean;
  match(pattern: string | RegExp, consume?: boolean, caseInsensitive?: boolean): boolean | RegExpMatchArray | null;
  skipToEnd(): void;
}

function nextChar(stream: StringStreamLike) {
  return stream.next() ?? "";
}

const typstParser: StreamParser<TypstState> = {
  name: "typst",

  startState() {
    return {
      mode: "markup",
      blockComment: false,
      rawFence: null,
      codeDepth: 0,
      codeLineMode: false
    };
  },

  blankLine(state) {
    if (state.mode === "code" && !state.blockComment && !state.rawFence) {
      state.mode = "markup";
      state.codeDepth = 0;
      state.codeLineMode = false;
    }
  },

  token(stream, state) {
    if (stream.eol()) {
      if (state.mode === "code" && !state.blockComment && !state.rawFence) {
        state.mode = "markup";
        state.codeDepth = 0;
        state.codeLineMode = false;
      }

      return null;
    }

    if (state.mode === "raw") {
      return tokenRaw(stream, state);
    }

    if (state.mode === "math") {
      return tokenMath(stream, state);
    }

    if (state.mode === "code") {
      return tokenCode(stream, state);
    }

    return tokenMarkup(stream, state);
  },

  tokenTable: {
    comment: t.comment,
    string: t.string,
    raw: t.monospace,
    number: t.number,
    keyword: t.keyword,
    atom: t.atom,
    builtin: t.standard(t.variableName),
    function: t.function(t.variableName),
    variable: t.variableName,
    operator: t.operator,
    bracket: t.bracket,
    heading: t.heading,
    strong: t.strong,
    emphasis: t.emphasis,
    label: t.labelName,
    reference: t.link,
    escape: t.escape,
    markup: t.processingInstruction,
    list: t.list,
    term: t.definition(t.variableName),
    math: t.special(t.string),
    mathDelimiter: t.processingInstruction,
    mathVariable: t.special(t.variableName),
    mathFunction: t.function(t.variableName)
  }
};

const typstHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: t.keyword, color: "var(--syntax-keyword)" },
  { tag: t.atom, color: "var(--syntax-atom)" },
  { tag: t.standard(t.variableName), color: "var(--syntax-builtin)" },
  { tag: t.function(t.variableName), color: "var(--syntax-function)" },
  { tag: t.variableName, color: "var(--syntax-variable)" },
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.monospace, color: "var(--syntax-raw)" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.operator, color: "var(--syntax-operator)" },
  { tag: t.bracket, color: "var(--syntax-bracket)" },
  { tag: t.heading, color: "var(--syntax-heading)" },
  { tag: t.strong, color: "var(--syntax-strong)" },
  { tag: t.emphasis, color: "var(--syntax-emphasis)", fontStyle: "italic" },
  { tag: t.labelName, color: "var(--syntax-label)" },
  { tag: t.link, color: "var(--syntax-reference)", textDecoration: "underline" },
  { tag: t.escape, color: "var(--syntax-escape)" },
  { tag: t.processingInstruction, color: "var(--syntax-markup)" },
  { tag: t.list, color: "var(--syntax-list)" },
  { tag: t.definition(t.variableName), color: "var(--syntax-term)" },
  { tag: t.special(t.string), color: "var(--syntax-math)" },
  { tag: t.special(t.variableName), color: "var(--syntax-math-variable)" }
]);

const keywordCompletions: Completion[] = [
  "let", "set", "show", "if", "else", "for", "in",
  "while", "break", "continue", "return", "import",
  "include", "as", "context"
].map((label) => ({ label, type: "keyword" }));

const atomCompletions: Completion[] = ["true", "false", "none", "auto"].map((label) => ({ label, type: "constant" }));

const functionCompletions: Completion[] = [
  { label: "align", type: "function", apply: "align(center)[]" },
  { label: "bibliography", type: "function", apply: "bibliography(\"refs.bib\")" },
  { label: "block", type: "function", apply: "block[]" },
  { label: "box", type: "function", apply: "box[]" },
  { label: "cite", type: "function", apply: "cite(<key>)" },
  { label: "columns", type: "function", apply: "columns(2)[]" },
  { label: "figure", type: "function", apply: "figure(\n  image(\"image.png\"),\n  caption: []\n)" },
  { label: "grid", type: "function", apply: "grid(columns: (), rows: ())" },
  { label: "heading", type: "function", apply: "heading[]" },
  { label: "image", type: "function", apply: "image(\"image.png\")" },
  { label: "link", type: "function", apply: "link(\"https://\")[]" },
  { label: "outline", type: "function", apply: "outline()" },
  { label: "page", type: "function", apply: "page(width: 210mm, height: 297mm)" },
  { label: "raw", type: "function", apply: "raw(\"\", lang: none)" },
  { label: "rect", type: "function", apply: "rect[]" },
  { label: "ref", type: "function", apply: "ref(<label>)" },
  { label: "table", type: "function", apply: "table(columns: (), [])" },
  { label: "text", type: "function", apply: "text(size: 11pt)[]" }
];

const snippetCompletions: Completion[] = [
  {
    label: "set page",
    type: "keyword",
    apply: "#set page(width: 210mm, height: 297mm, margin: 20mm)"
  },
  {
    label: "set text",
    type: "keyword",
    apply: "#set text(size: 11pt)"
  },
  {
    label: "set heading numbering",
    type: "keyword",
    apply: "#set heading(numbering: \"1.\")"
  },
  {
    label: "show heading",
    type: "keyword",
    apply: "#show heading: it => block[\n  #it.body\n]"
  },
  {
    label: "import package",
    type: "keyword",
    apply: "#import \"@preview/package:0.1.0\": item"
  },
  {
    label: "include file",
    type: "keyword",
    apply: "#include \"chapter.typ\""
  },
  {
    label: "raw block",
    type: "text",
    apply: "```typ\n\n```"
  },
  {
    label: "figure image",
    type: "function",
    apply: "#figure(\n  image(\"image.png\"),\n  caption: [Caption],\n) <fig:label>"
  },
  {
    label: "bibliography",
    type: "function",
    apply: "#bibliography(\"refs.bib\")"
  }
];

function typstCompletionSource(context: CompletionContext) {
  const before = context.matchBefore(/[#@<]?[A-Za-z_][A-Za-z0-9_-]*$/);

  if (!before || (before.from === before.to && !context.explicit)) {
    return null;
  }

  const token = before.text;
  const startsWithHash = token.startsWith("#");

  const options = [...keywordCompletions, ...atomCompletions, ...functionCompletions, ...snippetCompletions].map((completion) => {
    if (!startsWithHash) return completion;

    const apply = typeof completion.apply === "string"
      ? completion.apply.startsWith("#")
        ? completion.apply
        : `#${completion.apply}`
      : completion.apply;

    return { ...completion, apply };
  });

  return { from: before.from, options, validFor: /^#?[A-Za-z_][A-Za-z0-9_-]*$/ };
}

const typstLanguage = StreamLanguage.define(typstParser);

export function typstLanguageExtensions(): Extension[] {
  return [
    typstLanguage,
    typstLanguage.data.of({
      commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
      closeBrackets: { brackets: ["(", "[", "{", "\"", "`", "$"] }
    }),
    syntaxHighlighting(typstHighlightStyle),
    autocompletion({ override: [typstCompletionSource], activateOnTyping: true }),
    closeBrackets(),
    bracketMatching()
  ];
}