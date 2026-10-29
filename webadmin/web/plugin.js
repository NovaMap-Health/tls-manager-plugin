// web/plugin.jsx
import { platform } from "@oie/web-shell";
import { ConnectorForm, h, clear, textInput, asBool, YES_NO, modal, icon, toast as toast2, confirmDialog, promptDialog, checkbox, pickFile } from "@oie/web-ui";

// web/tlsService.js
import api from "@oie/web-api";

// node_modules/@peculiar/utils/build/bytes/buffer-source.js
var ARRAY_BUFFER_TAG = "[object ArrayBuffer]";
var SHARED_ARRAY_BUFFER_TAG = "[object SharedArrayBuffer]";
function tagOf(value) {
  return Object.prototype.toString.call(value);
}
function isDataViewConstructor(type) {
  return type === DataView || type.prototype instanceof DataView;
}
function bytesPerElement(type) {
  if (isDataViewConstructor(type)) return 1;
  return type.BYTES_PER_ELEMENT ?? 1;
}
function isArrayBufferViewLike(value) {
  if (ArrayBuffer.isView(value)) return true;
  if (!value || typeof value !== "object") return false;
  const view = value;
  return typeof view.byteOffset === "number" && typeof view.byteLength === "number" && isArrayBufferLike(view.buffer);
}
function copyBytes(data) {
  const view = toUint8Array(data);
  const copy2 = new Uint8Array(view.byteLength);
  copy2.set(view);
  return copy2;
}
function isArrayBuffer(value) {
  return tagOf(value) === ARRAY_BUFFER_TAG;
}
function isSharedArrayBuffer(value) {
  return typeof SharedArrayBuffer !== "undefined" && tagOf(value) === SHARED_ARRAY_BUFFER_TAG;
}
function isArrayBufferLike(value) {
  return isArrayBuffer(value) || isSharedArrayBuffer(value);
}
function isArrayBufferView(value) {
  return isArrayBufferViewLike(value);
}
function isBufferSource(value) {
  return isArrayBufferLike(value) || isArrayBufferView(value);
}
function assertBufferSource(value) {
  if (!isBufferSource(value)) throw new TypeError("Expected ArrayBuffer, SharedArrayBuffer, or ArrayBufferView");
}
function toUint8Array(data) {
  assertBufferSource(data);
  if (isArrayBufferLike(data)) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
function toUint8ArrayCopy(data) {
  return copyBytes(data);
}
function toArrayBuffer(data) {
  assertBufferSource(data);
  if (isArrayBuffer(data)) return data;
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(toUint8Array(data));
  return buffer;
}
function toArrayBufferLike(data) {
  assertBufferSource(data);
  if (isArrayBufferLike(data)) return data;
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) return data.buffer;
  return copyBytes(data).buffer;
}
function toView(data, type) {
  assertBufferSource(data);
  if (ArrayBuffer.isView(data) && data.constructor === type) return data;
  const view = toUint8Array(data);
  const elementSize = bytesPerElement(type);
  if (view.byteOffset % elementSize !== 0 || view.byteLength % elementSize !== 0) throw new RangeError(`Cannot create ${type.name} over unaligned byte range`);
  if (isDataViewConstructor(type)) return new type(view.buffer, view.byteOffset, view.byteLength);
  return new type(view.buffer, view.byteOffset, view.byteLength / elementSize);
}
function toViewCopy(data, type) {
  return toView(toUint8ArrayCopy(data), type);
}

// node_modules/@peculiar/utils/build/bytes/concat.js
function concatToUint8Array(buffers) {
  const views = [];
  let length = 0;
  for (const buffer of buffers) {
    const view = toUint8Array(buffer);
    views.push(view);
    length += view.byteLength;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const view of views) {
    result.set(view, offset);
    offset += view.byteLength;
  }
  return result;
}
function concat(first, second, ...rest) {
  let buffers;
  let type;
  if (typeof second === "function") {
    buffers = Array.from(first);
    type = second;
  } else if (isBufferSource(first)) buffers = [
    first,
    second,
    ...rest
  ].filter(isBufferSource);
  else {
    buffers = Array.from(first);
    if (second) buffers.push(second);
    buffers.push(...rest);
  }
  const bytes = concatToUint8Array(buffers);
  return type ? toView(bytes, type) : bytes.buffer;
}

// node_modules/@peculiar/utils/build/bytes/equal.js
function equal(a, b, options = {}) {
  const left = toUint8Array(a);
  const right = toUint8Array(b);
  if (!options.constantTime && left.byteLength !== right.byteLength) return false;
  const length = Math.max(left.byteLength, right.byteLength);
  let diff = left.byteLength ^ right.byteLength;
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

// node_modules/@peculiar/utils/build/bytes/sequence.js
function clampIndex(value, fallback, length) {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (normalized <= 0) return 0;
  if (normalized >= length) return length;
  return normalized;
}
function normalizeForwardRange(length, options) {
  const start = clampIndex(options?.start, 0, length);
  const end = clampIndex(options?.end, length, length);
  return end >= start ? [start, end] : [start, start];
}
function normalizeReverseRange(length, options) {
  const start = clampIndex(options?.start, length, length);
  const end = clampIndex(options?.end, 0, length);
  return start >= end ? [end, start] : [start, start];
}
function normalizeSliceIndex(value, fallback, length) {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (normalized < 0) return Math.max(length + normalized, 0);
  if (normalized > length) return length;
  return normalized;
}
function encodeAscii(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 255;
  return bytes;
}
function encodeUtf8(text) {
  return new TextEncoder().encode(text);
}
function toPatternBytes(pattern, options) {
  if (typeof pattern === "string") return options?.encoding === "utf8" ? encodeUtf8(pattern) : encodeAscii(pattern);
  return toUint8Array(pattern);
}
function bytesEqualAt(data, pattern, offset) {
  for (let index = 0; index < pattern.byteLength; index++) if (data[offset + index] !== pattern[index]) return false;
  return true;
}
function indexOf(data, pattern, options) {
  const bytes = toUint8Array(data);
  const needle = toPatternBytes(pattern, options);
  const [start, end] = normalizeForwardRange(bytes.byteLength, options);
  if (needle.byteLength === 0) return start;
  const lastOffset = end - needle.byteLength;
  if (lastOffset < start) return -1;
  for (let offset = start; offset <= lastOffset; offset++) if (bytesEqualAt(bytes, needle, offset)) return offset;
  return -1;
}
function lastIndexOf(data, pattern, options) {
  const bytes = toUint8Array(data);
  const needle = toPatternBytes(pattern, options);
  const [end, start] = normalizeReverseRange(bytes.byteLength, options);
  if (needle.byteLength === 0) return start;
  const firstOffset = start - needle.byteLength;
  if (firstOffset < end) return -1;
  for (let offset = firstOffset; offset >= end; offset--) if (bytesEqualAt(bytes, needle, offset)) return offset;
  return -1;
}
function includes(data, pattern, options) {
  return indexOf(data, pattern, options) !== -1;
}
function startsWith(data, pattern, options) {
  const bytes = toUint8Array(data);
  const needle = toPatternBytes(pattern, options);
  if (needle.byteLength > bytes.byteLength) return false;
  return bytesEqualAt(bytes, needle, 0);
}
function endsWith(data, pattern, options) {
  const bytes = toUint8Array(data);
  const needle = toPatternBytes(pattern, options);
  if (needle.byteLength > bytes.byteLength) return false;
  return bytesEqualAt(bytes, needle, bytes.byteLength - needle.byteLength);
}
function slice(data, start, end) {
  const bytes = toUint8Array(data);
  const normalizedStart = normalizeSliceIndex(start, 0, bytes.byteLength);
  const normalizedEnd = normalizeSliceIndex(end, bytes.byteLength, bytes.byteLength);
  if (normalizedEnd <= normalizedStart) return bytes.subarray(normalizedStart, normalizedStart);
  return bytes.subarray(normalizedStart, normalizedEnd);
}
function tail(data, length) {
  const bytes = toUint8Array(data);
  const normalizedLength = Number.isFinite(length) ? Math.max(0, Math.trunc(length)) : 0;
  if (normalizedLength >= bytes.byteLength) return bytes;
  return bytes.subarray(bytes.byteLength - normalizedLength);
}
function copy(data) {
  return toUint8ArrayCopy(data);
}
function compare(a, b) {
  const left = toUint8Array(a);
  const right = toUint8Array(b);
  const limit = Math.min(left.byteLength, right.byteLength);
  for (let index = 0; index < limit; index++) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  if (left.byteLength < right.byteLength) return -1;
  if (left.byteLength > right.byteLength) return 1;
  return 0;
}

// node_modules/@peculiar/utils/build/_virtual/_rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp(target, name, {
    get: all[name],
    enumerable: true
  });
  if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
  return target;
};

// node_modules/@peculiar/utils/build/bytes.js
var bytes_exports = /* @__PURE__ */ __exportAll({
  assertBufferSource: () => assertBufferSource,
  compare: () => compare,
  concat: () => concat,
  concatToUint8Array: () => concatToUint8Array,
  copy: () => copy,
  endsWith: () => endsWith,
  equal: () => equal,
  includes: () => includes,
  indexOf: () => indexOf,
  isArrayBuffer: () => isArrayBuffer,
  isArrayBufferLike: () => isArrayBufferLike,
  isArrayBufferView: () => isArrayBufferView,
  isBufferSource: () => isBufferSource,
  isSharedArrayBuffer: () => isSharedArrayBuffer,
  lastIndexOf: () => lastIndexOf,
  slice: () => slice,
  startsWith: () => startsWith,
  tail: () => tail,
  toArrayBuffer: () => toArrayBuffer,
  toArrayBufferLike: () => toArrayBufferLike,
  toUint8Array: () => toUint8Array,
  toUint8ArrayCopy: () => toUint8ArrayCopy,
  toView: () => toView,
  toViewCopy: () => toViewCopy
});

// node_modules/@peculiar/utils/build/encoding/binary.js
var binary_exports = /* @__PURE__ */ __exportAll({
  binary: () => binary,
  decode: () => decode,
  encode: () => encode,
  is: () => is
});
function encode(data) {
  const bytes = toUint8Array(data);
  let result = "";
  for (const byte of bytes) result += String.fromCharCode(byte);
  return result;
}
function decode(text) {
  const result = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) result[i] = text.charCodeAt(i) & 255;
  return result;
}
function is(text) {
  return typeof text === "string";
}
var binary = {
  encode,
  decode,
  is
};

// node_modules/@peculiar/utils/build/encoding/hex.js
var hex_exports = /* @__PURE__ */ __exportAll({
  decode: () => decode2,
  encode: () => encode2,
  format: () => format,
  formats: () => formats,
  hex: () => hex,
  is: () => is2,
  normalize: () => normalize,
  parse: () => parse
});
var HEX_CHARACTER_REGEX = /^[0-9a-f]$/i;
var COMMON_SEPARATORS = [
  " ",
  "	",
  "\n",
  "\r",
  ":",
  "-",
  "."
];
function resolveSeparators(options) {
  if (options.separators === "none") return [];
  if (!options.separators || options.separators === "common") return COMMON_SEPARATORS;
  return options.separators;
}
function validateSeparator(separator) {
  if (!separator) throw new TypeError("Hex separators must be non-empty strings");
}
function matchSeparator(text, index, separators) {
  for (const separator of separators) if (text.startsWith(separator, index)) return separator;
}
function detectCase(text) {
  const hasUpper = /[A-F]/.test(text);
  const hasLower = /[a-f]/.test(text);
  return hasUpper && !hasLower ? "upper" : "lower";
}
function detectLineSeparator(text) {
  const match = /\r\n|\n/.exec(text);
  if (!match) return;
  return match[0] === "\r\n" ? "\r\n" : "\n";
}
function compactForDetection(text) {
  return text.replace(/[^0-9a-f]/gi, "");
}
function detectGroup(text) {
  const segments = text.match(/[0-9A-Fa-f]+|[^0-9A-Fa-f]+/g) ?? [];
  if (segments.length < 3) return;
  const hexSegments = segments.filter((_, index) => index % 2 === 0);
  const separators = segments.filter((_, index) => index % 2 === 1);
  const separator = separators[0];
  if (!separator || separators.some((item) => item !== separator)) return;
  if (hexSegments.some((segment) => segment.length === 0 || segment.length % 2 !== 0)) return;
  const firstLength = hexSegments[0]?.length ?? 0;
  if (!firstLength) return;
  if (hexSegments.slice(0, -1).some((segment) => segment.length !== firstLength)) return;
  if ((hexSegments[hexSegments.length - 1]?.length ?? 0) > firstLength) return;
  return {
    size: firstLength / 2,
    separator
  };
}
function detectFormat(text) {
  const trimmed = text.trim();
  const prefix = /^0x/i.test(trimmed) ? "0x" : "";
  const body = prefix ? trimmed.slice(2) : trimmed;
  const lineSeparator = detectLineSeparator(body);
  const lines = body.split(/\r\n|\n/).filter((line) => line.length > 0);
  const group = detectGroup(lines[0]?.trim() ?? "");
  const format2 = {
    case: detectCase(trimmed),
    prefix
  };
  if (group) format2.group = group;
  if (lineSeparator && lines.length > 1) {
    const firstLineBytes = compactForDetection(lines[0] ?? "").length / 2;
    if (firstLineBytes > 0 && lines.slice(0, -1).every((line) => compactForDetection(line).length / 2 === firstLineBytes)) format2.line = {
      bytesPerLine: firstLineBytes,
      separator: lineSeparator
    };
  }
  return format2;
}
function normalizeText(text, options) {
  const allowPrefix = options.allowPrefix ?? true;
  const separators = [...resolveSeparators(options)].sort((left, right) => right.length - left.length);
  for (const separator of separators) validateSeparator(separator);
  let working = text.trim();
  if (/^0x/i.test(working)) {
    if (!allowPrefix) throw new TypeError("Hexadecimal text must not include a 0x prefix");
    working = working.slice(2);
  }
  let normalized = "";
  let lastTokenWasSeparator = false;
  for (let index = 0; index < working.length; ) {
    const character = working[index] ?? "";
    if (HEX_CHARACTER_REGEX.test(character)) {
      normalized += character;
      lastTokenWasSeparator = false;
      index += 1;
      continue;
    }
    const separator = matchSeparator(working, index, separators);
    if (!separator) throw new TypeError("Input is not valid hexadecimal text");
    if (options.strict && (lastTokenWasSeparator || normalized.length === 0)) throw new TypeError("Hexadecimal text contains misplaced separators");
    lastTokenWasSeparator = true;
    index += separator.length;
  }
  if (options.strict && lastTokenWasSeparator && normalized.length > 0) throw new TypeError("Hexadecimal text must not end with a separator");
  if (normalized.length % 2 !== 0) {
    if (!options.allowOddLength) throw new TypeError("Hexadecimal text must contain an even number of characters");
    normalized = `0${normalized}`;
  }
  return normalized.toLowerCase();
}
function groupPairs(pairs, group) {
  if (!group) return pairs.join("");
  if (!Number.isInteger(group.size) || group.size < 1) throw new RangeError("Hex group size must be a positive integer");
  const chunks = [];
  for (let index = 0; index < pairs.length; index += group.size) chunks.push(pairs.slice(index, index + group.size).join(""));
  return chunks.join(group.separator);
}
function normalize(text, options = {}) {
  return normalizeText(text, options);
}
function is2(text, options = {}) {
  if (typeof text !== "string") return false;
  try {
    normalize(text, options);
    return true;
  } catch {
    return false;
  }
}
function encode2(data, options = {}) {
  const bytes = toUint8Array(data);
  const casing = options.case ?? "lower";
  const pairs = Array.from(bytes, (byte) => {
    const text = byte.toString(16).padStart(2, "0");
    return casing === "upper" ? text.toUpperCase() : text;
  });
  let body = "";
  if (options.line) {
    const bytesPerLine = options.line.bytesPerLine;
    if (!Number.isInteger(bytesPerLine) || bytesPerLine < 1) throw new RangeError("Hex bytesPerLine must be a positive integer");
    const separator = options.line.separator ?? "\n";
    const lines = [];
    for (let index = 0; index < pairs.length; index += bytesPerLine) lines.push(groupPairs(pairs.slice(index, index + bytesPerLine), options.group));
    body = lines.join(separator);
  } else body = groupPairs(pairs, options.group);
  return `${options.prefix ?? ""}${body}`;
}
function decode2(text, options = {}) {
  const normalized = normalize(text, options);
  const result = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) result[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  return result;
}
function parse(text, options = {}) {
  const normalized = normalize(text, options);
  return {
    bytes: decode2(normalized),
    format: detectFormat(text),
    normalized
  };
}
function format(data, value) {
  return encode2(data, value);
}
var formats = {
  compact: Object.freeze({}),
  upper: Object.freeze({ case: "upper" }),
  colon: Object.freeze({ group: {
    size: 1,
    separator: ":"
  } }),
  colonUpper: Object.freeze({
    case: "upper",
    group: {
      size: 1,
      separator: ":"
    }
  }),
  groupsOf4: Object.freeze({ group: {
    size: 4,
    separator: " "
  } }),
  prefixed: Object.freeze({ prefix: "0x" })
};
var hex = {
  encode: encode2,
  decode: decode2,
  format,
  formats,
  is: is2,
  normalize,
  parse
};

// node_modules/@peculiar/utils/build/encoding/utf8.js
var utf8_exports = /* @__PURE__ */ __exportAll({
  decode: () => decode3,
  encode: () => encode3,
  utf8: () => utf8
});
function encode3(text) {
  return new TextEncoder().encode(text);
}
function decode3(data) {
  return new TextDecoder("utf-8", { fatal: false }).decode(toUint8Array(data));
}
var utf8 = {
  encode: encode3,
  decode: decode3
};

// node_modules/@peculiar/utils/build/encoding/utf16.js
var utf16_exports = /* @__PURE__ */ __exportAll({
  decode: () => decode4,
  encode: () => encode4,
  utf16: () => utf16
});
function encode4(text, options = {}) {
  const result = /* @__PURE__ */ new ArrayBuffer(text.length * 2);
  const view = new DataView(result);
  for (let i = 0; i < text.length; i++) view.setUint16(i * 2, text.charCodeAt(i), options.littleEndian ?? false);
  return new Uint8Array(result);
}
function decode4(data, options = {}) {
  const buffer = toArrayBuffer(data);
  const view = new DataView(buffer);
  let result = "";
  for (let i = 0; i < buffer.byteLength; i += 2) result += String.fromCharCode(view.getUint16(i, options.littleEndian ?? false));
  return result;
}
var utf16 = {
  encode: encode4,
  decode: decode4
};

// node_modules/@peculiar/utils/build/encoding/base64.js
var base64_exports = /* @__PURE__ */ __exportAll({
  base64: () => base64,
  decode: () => decode5,
  encode: () => encode5,
  is: () => is3,
  normalize: () => normalize2,
  pad: () => pad
});
var BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function nodeBuffer() {
  return globalThis.Buffer;
}
function normalize2(text) {
  return text.replace(/[\n\r\t ]/g, "");
}
function pad(text) {
  const remainder = text.length % 4;
  return remainder ? text + "=".repeat(4 - remainder) : text;
}
function is3(text) {
  if (typeof text !== "string") return false;
  const normalized = normalize2(text);
  return normalized === "" || BASE64_REGEX.test(normalized);
}
function encode5(data, _options) {
  const bytes = toUint8Array(data);
  const buffer = nodeBuffer();
  if (buffer) return buffer.from(bytes).toString("base64");
  return btoa(encode(bytes));
}
function decode5(text, _options) {
  const normalized = normalize2(text);
  if (!is3(normalized)) throw new TypeError("Input is not valid Base64 text");
  const buffer = nodeBuffer();
  if (buffer) return new Uint8Array(buffer.from(normalized, "base64"));
  return decode(atob(normalized));
}
var base64 = {
  encode: encode5,
  decode: decode5,
  is: is3,
  normalize: normalize2,
  pad
};

// node_modules/@peculiar/utils/build/encoding/base64url.js
var base64url_exports = /* @__PURE__ */ __exportAll({
  base64url: () => base64url,
  decode: () => decode6,
  encode: () => encode6,
  is: () => is4,
  normalize: () => normalize3
});
var BASE64URL_REGEX = /^[A-Za-z0-9_-]*$/;
var PADDED_BASE64URL_REGEX = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}==|[A-Za-z0-9_-]{3}=)?$/;
function normalize3(text) {
  return text.replace(/[\n\r\t ]/g, "");
}
function is4(text, options = {}) {
  if (typeof text !== "string") return false;
  const normalized = normalize3(text);
  return BASE64URL_REGEX.test(normalized) || !!options.allowPadding && PADDED_BASE64URL_REGEX.test(normalized);
}
function encode6(data, _options) {
  return base64.encode(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode6(text, options = {}) {
  const normalized = normalize3(text);
  if (!is4(normalized, options)) throw new TypeError("Input is not valid Base64Url text");
  return base64.decode(base64.pad(normalized.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/")));
}
var base64url = {
  encode: encode6,
  decode: decode6,
  is: is4,
  normalize: normalize3
};

// node_modules/@peculiar/utils/build/integer/uint.js
var uint_exports = /* @__PURE__ */ __exportAll({
  decode: () => decode7,
  decodeBigInt: () => decodeBigInt,
  encode: () => encode7,
  uint: () => uint
});
function resolveBits(bitsPerByte = 8) {
  if (!Number.isInteger(bitsPerByte) || bitsPerByte < 1 || bitsPerByte > 8) throw new RangeError("bitsPerByte must be an integer from 1 to 8");
  return bitsPerByte;
}
function pad2(digits, length) {
  if (length === void 0) return Uint8Array.from(digits);
  if (!Number.isInteger(length) || length < 0) throw new RangeError("length must be a non-negative integer");
  if (digits.length > length) throw new RangeError(`Value does not fit into ${length} byte(s)`);
  const result = new Uint8Array(length);
  result.set(digits, length - digits.length);
  return result;
}
function encode7(value, options = {}) {
  const bits = resolveBits(options.bitsPerByte);
  const digits = [];
  if (typeof value === "bigint") {
    if (value < 0n) throw new RangeError("Unsigned integer must not be negative");
    const shift = BigInt(bits);
    const mask = (1n << shift) - 1n;
    do {
      digits.push(Number(value & mask));
      value >>= shift;
    } while (value > 0n);
  } else {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Unsigned integer must be a non-negative safe integer; use bigint for larger values");
    const radix = 2 ** bits;
    do {
      digits.push(value % radix);
      value = Math.floor(value / radix);
    } while (value > 0);
  }
  return pad2(digits.reverse(), options.length);
}
function decodeBigInt(data, options = {}) {
  const bits = resolveBits(options.bitsPerByte);
  const shift = BigInt(bits);
  const radix = 1 << bits;
  let result = 0n;
  for (const digit of toUint8Array(data)) {
    if (digit >= radix) throw new RangeError(`Byte 0x${digit.toString(16)} exceeds ${bits} bits`);
    result = result << shift | BigInt(digit);
  }
  return result;
}
function decode7(data, options = {}) {
  const bits = resolveBits(options.bitsPerByte);
  const radix = 2 ** bits;
  let result = 0;
  for (const digit of toUint8Array(data)) {
    if (digit >= radix) throw new RangeError(`Byte 0x${digit.toString(16)} exceeds ${bits} bits`);
    if (result > (Number.MAX_SAFE_INTEGER - digit) / radix) throw new RangeError("Value exceeds Number.MAX_SAFE_INTEGER; use decodeBigInt instead");
    result = result * radix + digit;
  }
  return result;
}
var uint = {
  encode: encode7,
  decode: decode7,
  decodeBigInt
};

// node_modules/@peculiar/utils/build/integer/int.js
var int_exports = /* @__PURE__ */ __exportAll({
  decode: () => decode8,
  decodeBigInt: () => decodeBigInt2,
  encode: () => encode8,
  int: () => int,
  isMinimal: () => isMinimal
});
function toBigInt(value) {
  if (typeof value === "bigint") return value;
  if (!Number.isSafeInteger(value)) throw new RangeError("Integer must be a safe integer; use bigint for larger values");
  return BigInt(value);
}
function encode8(value, options = {}) {
  const integer = toBigInt(value);
  let size = 1;
  while (integer < -(1n << BigInt(size * 8 - 1)) || integer >= 1n << BigInt(size * 8 - 1)) size++;
  const length = options.length ?? size;
  if (!Number.isInteger(length) || length < 1) throw new RangeError("length must be a positive integer");
  if (size > length) throw new RangeError(`Value does not fit into ${length} byte(s)`);
  const unsigned = integer < 0n ? integer + (1n << BigInt(length * 8)) : integer;
  return encode7(unsigned, { length });
}
function decodeBigInt2(data) {
  const bytes = toUint8Array(data);
  if (!bytes.byteLength) throw new RangeError("Two's complement input must not be empty");
  const unsigned = decodeBigInt(bytes);
  return bytes[0] & 128 ? unsigned - (1n << BigInt(bytes.byteLength * 8)) : unsigned;
}
function decode8(data) {
  const value = decodeBigInt2(data);
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Value is outside the safe integer range; use decodeBigInt instead");
  return Number(value);
}
function isMinimal(data) {
  const bytes = toUint8Array(data);
  if (bytes.byteLength < 2) return bytes.byteLength === 1;
  const redundantZero = bytes[0] === 0 && (bytes[1] & 128) === 0;
  const redundantOnes = bytes[0] === 255 && (bytes[1] & 128) !== 0;
  return !redundantZero && !redundantOnes;
}
var int = {
  encode: encode8,
  decode: decode8,
  decodeBigInt: decodeBigInt2,
  isMinimal
};

// node_modules/asn1js/build/index.js
function concat2(buffers) {
  let outputLength = 0;
  let prevLength = 0;
  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    outputLength += buffer.byteLength;
  }
  const retView = new Uint8Array(outputLength);
  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    retView.set(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), prevLength);
    prevLength += buffer.byteLength;
  }
  return retView.buffer;
}
function checkBufferParams(baseBlock, inputBuffer, inputOffset, inputLength) {
  if (!(inputBuffer instanceof Uint8Array)) {
    baseBlock.error = "Wrong parameter: inputBuffer must be 'Uint8Array'";
    return false;
  }
  if (!inputBuffer.byteLength) {
    baseBlock.error = "Wrong parameter: inputBuffer has zero length";
    return false;
  }
  if (inputOffset < 0) {
    baseBlock.error = "Wrong parameter: inputOffset less than zero";
    return false;
  }
  if (inputLength < 0) {
    baseBlock.error = "Wrong parameter: inputLength less than zero";
    return false;
  }
  if (inputBuffer.byteLength - inputOffset - inputLength < 0) {
    baseBlock.error = "End of input reached before message was fully decoded (inconsistent offset and length values)";
    return false;
  }
  return true;
}
var ViewWriter = class {
  constructor() {
    this.items = [];
  }
  write(buf) {
    this.items.push(buf instanceof ArrayBuffer ? buf : concat2([buf]));
  }
  final() {
    return concat2(this.items);
  }
};
var ORIGINAL_VIEW_WRITER_WRITE = ViewWriter.prototype.write;
var ORIGINAL_VIEW_WRITER_FINAL = ViewWriter.prototype.final;
var EMPTY_BUFFER = /* @__PURE__ */ new ArrayBuffer(0);
var EMPTY_VIEW = /* @__PURE__ */ new Uint8Array(0);
var END_OF_CONTENT_NAME = "EndOfContent";
var OCTET_STRING_NAME = "OCTET STRING";
var BIT_STRING_NAME = "BIT STRING";
function HexBlock(BaseClass) {
  return class Some extends BaseClass {
    static {
      this.NAME = "hexBlock";
    }
    get valueHex() {
      return this.valueHexView.slice().buffer;
    }
    set valueHex(value) {
      this.valueHexView = new Uint8Array(value);
    }
    constructor(...args) {
      super(...args);
      const params = args[0] || {};
      this.isHexOnly = params.isHexOnly ?? false;
      this.valueHexView = params.valueHex ? toUint8Array(params.valueHex) : EMPTY_VIEW;
    }
    fromBER(inputBuffer, inputOffset, inputLength, _context) {
      const view = inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer;
      if (!checkBufferParams(this, view, inputOffset, inputLength)) return -1;
      const endLength = inputOffset + inputLength;
      this.valueHexView = view.subarray(inputOffset, endLength);
      if (!this.valueHexView.length) {
        this.warnings.push("Zero buffer length");
        return inputOffset;
      }
      this.blockLength = inputLength;
      return endLength;
    }
    toBER(sizeOnly = false) {
      if (!this.isHexOnly) {
        this.error = "Flag 'isHexOnly' is not set, abort";
        return EMPTY_BUFFER;
      }
      if (sizeOnly) return new ArrayBuffer(this.valueHexView.byteLength);
      if (this.valueHexView.buffer instanceof ArrayBuffer && this.valueHexView.byteLength === this.valueHexView.buffer.byteLength) return this.valueHexView.buffer;
      return toArrayBuffer(this.valueHexView);
    }
    toJSON() {
      return {
        ...super.toJSON(),
        isHexOnly: this.isHexOnly,
        valueHex: hex_exports.encode(this.valueHexView)
      };
    }
  };
}
var LocalBaseBlock = class {
  static {
    this.NAME = "baseBlock";
  }
  static blockName() {
    return this.NAME;
  }
  get valueBeforeDecode() {
    return this.valueBeforeDecodeView.slice().buffer;
  }
  set valueBeforeDecode(value) {
    this.valueBeforeDecodeView = new Uint8Array(value);
  }
  constructor({ blockLength = 0, error = "", warnings = [], valueBeforeDecode = EMPTY_VIEW } = {}) {
    this.blockLength = blockLength;
    this.error = error;
    this.warnings = warnings;
    this.valueBeforeDecodeView = toUint8Array(valueBeforeDecode);
  }
  toJSON() {
    return {
      blockName: this.constructor.NAME,
      blockLength: this.blockLength,
      error: this.error,
      warnings: this.warnings,
      valueBeforeDecode: hex_exports.encode(this.valueBeforeDecodeView)
    };
  }
};
var ValueBlock = class extends LocalBaseBlock {
  static {
    this.NAME = "valueBlock";
  }
  fromBER(_inputBuffer, _inputOffset, _inputLength, _context) {
    throw TypeError("User need to make a specific function in a class which extends 'ValueBlock'");
  }
  toBER(_sizeOnly, _writer) {
    throw TypeError("User need to make a specific function in a class which extends 'ValueBlock'");
  }
};
function decodeBase128(view) {
  try {
    return uint_exports.decode(view, { bitsPerByte: 7 });
  } catch {
    return;
  }
}
function encodeBase128(value) {
  try {
    return uint_exports.encode(value, { bitsPerByte: 7 });
  } catch {
    return;
  }
}
function bytesToSignedBigInt(view) {
  if (!view.byteLength) return BigInt(0);
  const value = BigInt(`0x${hex_exports.encode(view)}`);
  if (view[0] & 128) return value - (BigInt(1) << BigInt(view.byteLength * 8));
  return value;
}
function signedBigIntToBytes(value) {
  const byteLength = ((value < 0 ? -value - BigInt(1) : value).toString(2).length >> 3) + 1;
  const unsigned = value < 0 ? value + (BigInt(1) << BigInt(byteLength * 8)) : value;
  return hex_exports.decode(unsigned.toString(16).padStart(byteLength * 2, "0"));
}
var LocalIdentificationBlock = class extends HexBlock(LocalBaseBlock) {
  static {
    this.NAME = "identificationBlock";
  }
  constructor({ idBlock = {} } = {}) {
    super();
    if (idBlock) {
      this.isHexOnly = idBlock.isHexOnly ?? false;
      this.valueHexView = idBlock.valueHex ? toUint8Array(idBlock.valueHex) : EMPTY_VIEW;
      this.tagClass = idBlock.tagClass ?? -1;
      this.tagNumber = idBlock.tagNumber ?? -1;
      this.isConstructed = idBlock.isConstructed ?? false;
    } else {
      this.tagClass = -1;
      this.tagNumber = -1;
      this.isConstructed = false;
    }
  }
  toBER(sizeOnly = false) {
    let firstOctet = 0;
    switch (this.tagClass) {
      case 1:
        firstOctet |= 0;
        break;
      case 2:
        firstOctet |= 64;
        break;
      case 3:
        firstOctet |= 128;
        break;
      case 4:
        firstOctet |= 192;
        break;
      default:
        this.error = "Unknown tag class";
        return EMPTY_BUFFER;
    }
    if (this.isConstructed) firstOctet |= 32;
    if (this.tagNumber < 31 && !this.isHexOnly) {
      const retView2 = /* @__PURE__ */ new Uint8Array(1);
      if (!sizeOnly) {
        let number = this.tagNumber;
        number &= 31;
        firstOctet |= number;
        retView2[0] = firstOctet;
      }
      return retView2.buffer;
    }
    if (!this.isHexOnly) {
      const encodedView = encodeBase128(this.tagNumber);
      if (!encodedView) {
        this.error = "Error during encoding tag number";
        return EMPTY_BUFFER;
      }
      const size = encodedView.byteLength;
      const retView2 = new Uint8Array(size + 1);
      retView2[0] = firstOctet | 31;
      if (!sizeOnly) {
        for (let i = 0; i < size - 1; i++) retView2[i + 1] = encodedView[i] | 128;
        retView2[size] = encodedView[size - 1];
      }
      return retView2.buffer;
    }
    const retView = new Uint8Array(this.valueHexView.byteLength + 1);
    retView[0] = firstOctet | 31;
    if (!sizeOnly) {
      const curView = this.valueHexView;
      for (let i = 0; i < curView.length - 1; i++) retView[i + 1] = curView[i] | 128;
      retView[this.valueHexView.byteLength] = curView[curView.length - 1];
    }
    return retView.buffer;
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    const inputView = toUint8Array(inputBuffer);
    if (!checkBufferParams(this, inputView, inputOffset, inputLength)) return -1;
    const fastArgs = Number.isInteger(inputOffset) && Number.isInteger(inputLength);
    const intBuffer = fastArgs ? inputView : inputView.subarray(inputOffset, inputOffset + inputLength);
    const baseIndex = fastArgs ? inputOffset : 0;
    const bufferLength = fastArgs ? inputLength : intBuffer.length;
    if (bufferLength === 0) {
      this.error = "Zero buffer length";
      return -1;
    }
    switch (intBuffer[baseIndex] & 192) {
      case 0:
        this.tagClass = 1;
        break;
      case 64:
        this.tagClass = 2;
        break;
      case 128:
        this.tagClass = 3;
        break;
      case 192:
        this.tagClass = 4;
        break;
      default:
        this.error = "Unknown tag class";
        return -1;
    }
    this.isConstructed = (intBuffer[baseIndex] & 32) === 32;
    this.isHexOnly = false;
    const tagNumberMask = intBuffer[baseIndex] & 31;
    if (tagNumberMask !== 31) {
      this.tagNumber = tagNumberMask;
      this.blockLength = 1;
    } else {
      let count = 0;
      while (true) {
        const tagByteIndex = count + 1;
        if (tagByteIndex >= bufferLength) {
          this.error = "End of input reached before message was fully decoded";
          return -1;
        }
        count++;
        if ((intBuffer[baseIndex + tagByteIndex] & 128) === 0) break;
      }
      this.blockLength = count + 1;
      const intTagNumberBuffer = this.valueHexView = new Uint8Array(count);
      for (let i = 0; i < count; i++) intTagNumberBuffer[i] = intBuffer[baseIndex + i + 1] & 127;
      const tagNumber = this.blockLength <= 9 ? decodeBase128(intTagNumberBuffer) : void 0;
      if (tagNumber !== void 0) this.tagNumber = tagNumber;
      else {
        this.isHexOnly = true;
        this.warnings.push("Tag too long, represented as hex-coded");
      }
    }
    if (this.tagClass === 1 && this.isConstructed) switch (this.tagNumber) {
      case 1:
      case 2:
      case 5:
      case 6:
      case 9:
      case 13:
      case 14:
      case 23:
      case 24:
      case 31:
      case 32:
      case 33:
      case 34:
        this.error = "Constructed encoding used for primitive type";
        return -1;
    }
    return inputOffset + this.blockLength;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      tagClass: this.tagClass,
      tagNumber: this.tagNumber,
      isConstructed: this.isConstructed
    };
  }
};
var ORIGINAL_LOCAL_IDENTIFICATION_TO_BER = LocalIdentificationBlock.prototype.toBER;
var ORIGINAL_LOCAL_IDENTIFICATION_FROM_BER = LocalIdentificationBlock.prototype.fromBER;
var LocalLengthBlock = class extends LocalBaseBlock {
  static {
    this.NAME = "lengthBlock";
  }
  constructor({ lenBlock = {} } = {}) {
    super();
    this.isIndefiniteForm = lenBlock.isIndefiniteForm ?? false;
    this.longFormUsed = lenBlock.longFormUsed ?? false;
    this.length = lenBlock.length ?? 0;
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    const view = toUint8Array(inputBuffer);
    if (!checkBufferParams(this, view, inputOffset, inputLength)) return -1;
    const fastArgs = Number.isInteger(inputOffset) && Number.isInteger(inputLength);
    const intBuffer = fastArgs ? view : view.subarray(inputOffset, inputOffset + inputLength);
    const baseIndex = fastArgs ? inputOffset : 0;
    const bufferLength = fastArgs ? inputLength : intBuffer.length;
    if (bufferLength === 0) {
      this.error = "Zero buffer length";
      return -1;
    }
    if (intBuffer[baseIndex] === 255) {
      this.error = "Length block 0xFF is reserved by standard";
      return -1;
    }
    this.isIndefiniteForm = intBuffer[baseIndex] === 128;
    if (this.isIndefiniteForm) {
      this.blockLength = 1;
      return inputOffset + this.blockLength;
    }
    this.longFormUsed = !!(intBuffer[baseIndex] & 128);
    if (this.longFormUsed === false) {
      this.length = intBuffer[baseIndex];
      this.blockLength = 1;
      return inputOffset + this.blockLength;
    }
    const count = intBuffer[baseIndex] & 127;
    if (count > 8) {
      this.error = "Too big integer";
      return -1;
    }
    if (count + 1 > bufferLength) {
      this.error = "End of input reached before message was fully decoded";
      return -1;
    }
    const lenOffset = inputOffset + 1;
    const lengthBufferView = view.subarray(lenOffset, lenOffset + count);
    if (lengthBufferView[0] === 0) this.warnings.push("Needlessly long encoded length");
    try {
      this.length = uint_exports.decode(lengthBufferView);
    } catch {
      this.error = "Too big integer";
      return -1;
    }
    if (this.longFormUsed && this.length <= 127) this.warnings.push("Unnecessary usage of long length form");
    this.blockLength = count + 1;
    return inputOffset + this.blockLength;
  }
  toBER(sizeOnly = false) {
    let retBuf;
    let retView;
    if (this.length > 127) this.longFormUsed = true;
    if (this.isIndefiniteForm) {
      retBuf = /* @__PURE__ */ new ArrayBuffer(1);
      if (sizeOnly === false) {
        retView = new Uint8Array(retBuf);
        retView[0] = 128;
      }
      return retBuf;
    }
    if (this.longFormUsed) {
      let encodedBuf;
      try {
        encodedBuf = uint_exports.encode(this.length);
      } catch {
        this.error = "Too big length";
        return EMPTY_BUFFER;
      }
      retBuf = new ArrayBuffer(encodedBuf.byteLength + 1);
      if (sizeOnly) return retBuf;
      retView = new Uint8Array(retBuf);
      retView[0] = encodedBuf.byteLength | 128;
      retView.set(encodedBuf, 1);
      return retBuf;
    }
    retBuf = /* @__PURE__ */ new ArrayBuffer(1);
    if (sizeOnly === false) {
      retView = new Uint8Array(retBuf);
      retView[0] = this.length;
    }
    return retBuf;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      isIndefiniteForm: this.isIndefiniteForm,
      longFormUsed: this.longFormUsed,
      length: this.length
    };
  }
};
var ORIGINAL_LOCAL_LENGTH_TO_BER = LocalLengthBlock.prototype.toBER;
var ORIGINAL_LOCAL_LENGTH_FROM_BER = LocalLengthBlock.prototype.fromBER;
var typeStore = {};
var originalUint8ArraySliceInfo = findMethod(Uint8Array.prototype, "slice");
var originalUint8ArrayConstructor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "constructor")?.value;
var originalArrayIterator = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator)?.value;
var intrinsicTypedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")?.get;
var BUILTIN_DISPATCH_PAYLOAD_THRESHOLD = 16384;
var BUILTIN_DISPATCH_MAX_DEPTH = 64;
var builtinRegistry;
function registerBuiltinEncoder(builtinConstructors, internals) {
  const nextInternals = internals || builtinRegistry;
  if (!nextInternals) {
    builtinRegistry = void 0;
    return;
  }
  builtinRegistry = {
    ...nextInternals,
    ...builtinConstructors
  };
}
function dataProperty(object, name) {
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  if (!descriptor || !("value" in descriptor)) return void 0;
  return descriptor.value;
}
function intrinsicPayloadByteLength(value) {
  if (!intrinsicTypedArrayByteLength || !value || typeof value !== "object") return void 0;
  try {
    const byteLength = intrinsicTypedArrayByteLength.call(value);
    return typeof byteLength === "number" ? byteLength : void 0;
  } catch {
    return;
  }
}
function largePayloadOrChain(block, depth) {
  if (depth > BUILTIN_DISPATCH_MAX_DEPTH || !block || typeof block !== "object") return false;
  const valueBlockDescriptor = Object.getOwnPropertyDescriptor(block, "valueBlock");
  if (!valueBlockDescriptor || !("value" in valueBlockDescriptor)) return false;
  const valueBlock = valueBlockDescriptor.value;
  if (!valueBlock || typeof valueBlock !== "object") return false;
  const payloadDescriptor = Object.getOwnPropertyDescriptor(valueBlock, "valueHexView");
  if (payloadDescriptor) {
    if (!("value" in payloadDescriptor)) return false;
    const byteLength = intrinsicPayloadByteLength(payloadDescriptor.value);
    return byteLength !== void 0 && byteLength >= BUILTIN_DISPATCH_PAYLOAD_THRESHOLD;
  }
  const valuesDescriptor = Object.getOwnPropertyDescriptor(valueBlock, "value");
  if (!valuesDescriptor || !("value" in valuesDescriptor) || !Array.isArray(valuesDescriptor.value)) return false;
  const values = valuesDescriptor.value;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(values, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== 1) return false;
  const indexDescriptor = Object.getOwnPropertyDescriptor(values, "0");
  if (!indexDescriptor || !("value" in indexDescriptor)) return false;
  return largePayloadOrChain(indexDescriptor.value, depth + 1);
}
function shouldUseBuiltinEncoder(block) {
  try {
    return largePayloadOrChain(block, 0);
  } catch {
    return false;
  }
}
function sameDataMethod(current, original) {
  return !!current && "value" in current && current.value === original && current.writable === true && current.enumerable === false && current.configurable === true;
}
function writerMethodsStable(registry) {
  return sameDataMethod(Object.getOwnPropertyDescriptor(registry.ViewWriter.prototype, "write"), registry.originalWriterWrite) && sameDataMethod(Object.getOwnPropertyDescriptor(registry.ViewWriter.prototype, "final"), registry.originalWriterFinal);
}
function findMethod(prototype, name) {
  let current = prototype;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor) {
      if ("value" in descriptor && typeof descriptor.value === "function") return {
        declaringPrototype: current,
        method: descriptor.value
      };
      return;
    }
    current = Object.getPrototypeOf(current);
  }
}
function stableInheritedMethod(prototype, name, original) {
  if (!original) return false;
  let current = prototype;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (current === original.declaringPrototype) return !!descriptor && "value" in descriptor && descriptor.value === original.method;
    if (descriptor) return false;
    current = Object.getPrototypeOf(current);
  }
  return false;
}
function prototypeMethod(object, prototype, name, expected) {
  if (Object.prototype.hasOwnProperty.call(object, name)) return false;
  if (Object.getPrototypeOf(object) !== prototype) return false;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
  return !!descriptor && "value" in descriptor && descriptor.value === expected;
}
function inheritedMethod(object, name, expected, primitiveConstructor) {
  if (Object.prototype.hasOwnProperty.call(object, name)) return false;
  const prototype = Object.getPrototypeOf(object);
  const originalPrimitiveValuePrototype = Object.getPrototypeOf(primitiveConstructor.prototype);
  if (prototype !== primitiveConstructor.prototype || Object.getPrototypeOf(prototype) !== originalPrimitiveValuePrototype) return false;
  if (prototype && Object.getOwnPropertyDescriptor(prototype, name)) return false;
  const parentDescriptor = Object.getOwnPropertyDescriptor(originalPrimitiveValuePrototype, name);
  return !!parentDescriptor && "value" in parentDescriptor && parentDescriptor.value === expected;
}
function plainPayload(value, allowEmpty = false) {
  if (!(value instanceof Uint8Array) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return void 0;
  for (const name of [
    "buffer",
    "byteOffset",
    "byteLength",
    "length",
    "slice",
    "constructor"
  ]) if (Object.prototype.hasOwnProperty.call(value, name)) return void 0;
  const constructorDescriptor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "constructor");
  if (!constructorDescriptor || !("value" in constructorDescriptor) || constructorDescriptor.value !== originalUint8ArrayConstructor) return void 0;
  if (!stableInheritedMethod(Uint8Array.prototype, "slice", originalUint8ArraySliceInfo)) return void 0;
  try {
    const buffer = value.buffer;
    if (!(buffer instanceof ArrayBuffer) || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return void 0;
    if (Object.prototype.hasOwnProperty.call(buffer, "byteLength")) return void 0;
    if (value.byteLength !== value.length || !allowEmpty && value.byteLength === 0) return void 0;
    if (value.byteOffset < 0 || value.byteOffset + value.byteLength > buffer.byteLength) return void 0;
  } catch {
    return;
  }
  return value;
}
function validIdBlock(block, constructed, registry) {
  if (Object.getPrototypeOf(block) !== registry.LocalIdentificationBlock.prototype) return false;
  if (!prototypeMethod(block, registry.LocalIdentificationBlock.prototype, "toBER", registry.originalIdentificationToBER)) return false;
  const tagClass = dataProperty(block, "tagClass");
  const tagNumber = dataProperty(block, "tagNumber");
  const isConstructed2 = dataProperty(block, "isConstructed");
  const isHexOnly = dataProperty(block, "isHexOnly");
  const valueHexView = dataProperty(block, "valueHexView");
  if (typeof tagClass !== "number" || !Number.isInteger(tagClass) || tagClass < 1 || tagClass > 4) return false;
  if (typeof tagNumber !== "number" || !Number.isInteger(tagNumber) || tagNumber < 0) return false;
  if (isConstructed2 !== constructed || typeof isHexOnly !== "boolean") return false;
  if (isHexOnly) return !!plainPayload(valueHexView);
  return Number.isSafeInteger(tagNumber);
}
function validLengthBlock(block, allowIndefinite, registry) {
  if (Object.getPrototypeOf(block) !== registry.LocalLengthBlock.prototype) return false;
  if (!prototypeMethod(block, registry.LocalLengthBlock.prototype, "toBER", registry.originalLengthToBER)) return false;
  const indefinite = dataProperty(block, "isIndefiniteForm");
  const longForm = dataProperty(block, "longFormUsed");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(block, "length");
  const length = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : void 0;
  const longFormDescriptor = Object.getOwnPropertyDescriptor(block, "longFormUsed");
  return typeof indefinite === "boolean" && (indefinite === false || allowIndefinite) && typeof longForm === "boolean" && !!longFormDescriptor && "value" in longFormDescriptor && longFormDescriptor.writable === true && !!lengthDescriptor && "value" in lengthDescriptor && lengthDescriptor.writable === true && typeof length === "number" && Number.isSafeInteger(length) && length >= 0;
}
function validBaseBlock(block, isConstructed2, registry) {
  const idBlock = dataProperty(block, "idBlock");
  const lenBlock = dataProperty(block, "lenBlock");
  return !!idBlock && !!lenBlock && validIdBlock(idBlock, isConstructed2, registry) && validLengthBlock(lenBlock, isConstructed2, registry);
}
function constructedChild(block, registry) {
  const valueBlock = dataProperty(block, "valueBlock");
  if (!valueBlock || Object.getPrototypeOf(valueBlock) !== registry.LocalConstructedValueBlock.prototype) return void 0;
  if (!prototypeMethod(valueBlock, registry.LocalConstructedValueBlock.prototype, "toBER", registry.originalConstructedToBER)) return void 0;
  const values = dataProperty(valueBlock, "value");
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype) return void 0;
  const lengthDescriptor = Object.getOwnPropertyDescriptor(values, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== 1) return void 0;
  if (Object.prototype.hasOwnProperty.call(values, Symbol.iterator)) return void 0;
  const iteratorDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, Symbol.iterator);
  if (!iteratorDescriptor || !("value" in iteratorDescriptor) || iteratorDescriptor.value !== originalArrayIterator) return void 0;
  const indexDescriptor = Object.getOwnPropertyDescriptor(values, "0");
  if (!indexDescriptor || !("value" in indexDescriptor)) return void 0;
  if (Object.getOwnPropertyNames(values).length !== 2) return void 0;
  return indexDescriptor.value;
}
function bitPayload(block, registry) {
  const valueBlock = dataProperty(block, "valueBlock");
  if (!valueBlock || Object.getPrototypeOf(valueBlock) !== registry.LocalBitStringValueBlock.prototype) return void 0;
  if (!prototypeMethod(valueBlock, registry.LocalBitStringValueBlock.prototype, "toBER", registry.originalBitStringToBER)) return void 0;
  if (dataProperty(valueBlock, "isConstructed") !== false) return void 0;
  const unusedBits = dataProperty(valueBlock, "unusedBits");
  if (typeof unusedBits !== "number" || !Number.isInteger(unusedBits) || unusedBits < 0 || unusedBits > 7) return void 0;
  const payload = plainPayload(dataProperty(valueBlock, "valueHexView"), true);
  if (!payload) return void 0;
  return {
    payload,
    prefix: Uint8Array.of(payload.byteLength ? unusedBits : 0)
  };
}
function primitivePayload(block, kind, registry) {
  const valueBlock = dataProperty(block, "valueBlock");
  if (!valueBlock) return void 0;
  if (kind === "integer") {
    if (Object.getPrototypeOf(valueBlock) !== registry.LocalIntegerValueBlock.prototype) return void 0;
    if (!prototypeMethod(valueBlock, registry.LocalIntegerValueBlock.prototype, "toBER", registry.originalIntegerToBER)) return void 0;
  } else if (kind === "octet") {
    if (Object.getPrototypeOf(valueBlock) !== registry.LocalOctetStringValueBlock.prototype) return void 0;
    if (!prototypeMethod(valueBlock, registry.LocalOctetStringValueBlock.prototype, "toBER", registry.originalOctetStringToBER)) return void 0;
    if (dataProperty(valueBlock, "isConstructed") !== false) return void 0;
  } else {
    if (Object.getPrototypeOf(valueBlock) !== registry.LocalPrimitiveValueBlock.prototype) return void 0;
    if (!inheritedMethod(valueBlock, "toBER", registry.originalPrimitiveToBER, registry.LocalPrimitiveValueBlock)) return void 0;
  }
  if (kind === "primitive" && dataProperty(valueBlock, "isHexOnly") !== true) return void 0;
  if (typeof dataProperty(valueBlock, "isHexOnly") !== "boolean") return void 0;
  return plainPayload(dataProperty(valueBlock, "valueHexView"));
}
function validOuterMethod(block, registry) {
  if (Object.prototype.hasOwnProperty.call(block, "toBER")) return false;
  let prototype = block;
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "toBER");
    if (descriptor) return "value" in descriptor && descriptor.value === registry.originalBaseBlockToBER;
    prototype = Object.getPrototypeOf(prototype);
  }
  return false;
}
function isPrimitive(block, type, registry) {
  const constructor = registry[type];
  return !!constructor && Object.getPrototypeOf(block) === constructor.prototype;
}
function isConstructed(block, registry) {
  return Object.getPrototypeOf(block) === registry.Sequence.prototype || Object.getPrototypeOf(block) === registry.Set.prototype || Object.getPrototypeOf(block) === registry.Constructed.prototype;
}
function inspectNode(block, depth, registry) {
  if (depth > BUILTIN_DISPATCH_MAX_DEPTH || !block || typeof block !== "object") return void 0;
  try {
    if (!validOuterMethod(block, registry)) return void 0;
    const primitiveKind = isPrimitive(block, "BitString", registry) ? "bit" : isPrimitive(block, "Integer", registry) ? "integer" : isPrimitive(block, "OctetString", registry) ? "octet" : isPrimitive(block, "Primitive", registry) ? "primitive" : void 0;
    const constructed = primitiveKind === void 0 && isConstructed(block, registry);
    if (!primitiveKind && !constructed) return void 0;
    if (!validBaseBlock(block, constructed, registry)) return void 0;
    const idBlock = dataProperty(block, "idBlock");
    const lenBlock = dataProperty(block, "lenBlock");
    if (!idBlock || !lenBlock) return void 0;
    if (primitiveKind) {
      const bit = primitiveKind === "bit" ? bitPayload(block, registry) : void 0;
      const payload = primitiveKind === "bit" ? bit?.payload : primitivePayload(block, primitiveKind, registry);
      return payload ? {
        block,
        kind: primitiveKind,
        idBlock,
        lenBlock,
        indefinite: false,
        payload,
        prefix: bit?.prefix
      } : void 0;
    }
    const child = constructedChild(block, registry);
    const validatedChild = child && inspectNode(child, depth + 1, registry);
    const indefinite = dataProperty(lenBlock, "isIndefiniteForm");
    return validatedChild ? {
      block,
      kind: "constructed",
      idBlock,
      lenBlock,
      indefinite: indefinite === true,
      child: validatedChild
    } : void 0;
  } catch {
    return;
  }
}
function buildNode(node, sizeOnly, registry) {
  const id = Reflect.apply(registry.originalIdentificationToBER, node.idBlock, [sizeOnly]);
  if (!(id instanceof ArrayBuffer) || id.byteLength === 0) throw TypeError("Built-in identifier encoding failed");
  let payload;
  if (node.kind === "constructed") payload = buildNode(node.child, sizeOnly, registry);
  else payload = node.payload;
  const length = (payload instanceof Uint8Array ? payload.byteLength : payload.total) + (node.prefix?.byteLength ?? 0);
  let len;
  if (node.indefinite) len = Uint8Array.of(128).buffer;
  else {
    node.lenBlock.length = length;
    len = Reflect.apply(registry.originalLengthToBER, node.lenBlock, [sizeOnly]);
    if (!(len instanceof ArrayBuffer) || len.byteLength === 0) throw TypeError("Built-in length encoding failed");
  }
  const total = id.byteLength + len.byteLength + length + (node.indefinite ? 2 : 0);
  if (!Number.isSafeInteger(total)) throw RangeError("Built-in encoding is too large");
  return {
    id,
    len,
    payload,
    length,
    total,
    indefinite: node.indefinite,
    prefix: node.prefix
  };
}
function flatten(node, output, offset, sizeOnly) {
  output.set(new Uint8Array(node.id), offset);
  offset += node.id.byteLength;
  output.set(new Uint8Array(node.len), offset);
  offset += node.len.byteLength;
  if (node.prefix) {
    if (!sizeOnly) output.set(node.prefix, offset);
    offset += node.prefix.byteLength;
  }
  if (node.payload instanceof Uint8Array) {
    if (!sizeOnly) output.set(node.payload, offset);
    offset += node.payload.byteLength;
  } else offset = flatten(node.payload, output, offset, sizeOnly);
  if (node.indefinite) offset += 2;
  return offset;
}
function tryEncodeBuiltin(block, sizeOnly = false) {
  const registry = builtinRegistry;
  if (!registry || !writerMethodsStable(registry)) return void 0;
  const validated = inspectNode(block, 0, registry);
  if (!validated) return void 0;
  const node = buildNode(validated, sizeOnly, registry);
  const output = new Uint8Array(node.total);
  flatten(node, output, 0, sizeOnly);
  return output.buffer;
}
var BaseBlock = class extends LocalBaseBlock {
  static {
    this.NAME = "BaseBlock";
  }
  constructor({ name = "", optional = false, primitiveSchema, ...parameters } = {}, valueBlockType) {
    super(parameters);
    this.name = name;
    this.optional = optional;
    if (primitiveSchema) this.primitiveSchema = primitiveSchema;
    this.idBlock = new LocalIdentificationBlock(parameters);
    this.lenBlock = new LocalLengthBlock(parameters);
    this.valueBlock = valueBlockType ? new valueBlockType(parameters) : new ValueBlock(parameters);
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    const resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, this.lenBlock.isIndefiniteForm ? inputLength : this.lenBlock.length, context);
    if (resultOffset === -1) {
      this.error = this.valueBlock.error;
      return resultOffset;
    }
    if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
    if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
    if (!this.valueBlock.error.length) this.blockLength += this.valueBlock.blockLength;
    return resultOffset;
  }
  toBER(sizeOnly, writer) {
    const _writer = writer || new ViewWriter();
    if (!writer) {
      prepareIndefiniteForm(this);
      if (sizeOnly === true || sizeOnly === false || sizeOnly === void 0) {
        if (shouldUseBuiltinEncoder(this)) {
          const encoded = tryEncodeBuiltin(this, sizeOnly === true);
          if (encoded) return encoded;
        }
      }
    }
    const idBlockBuf = this.idBlock.toBER(sizeOnly);
    _writer.write(idBlockBuf);
    if (this.lenBlock.isIndefiniteForm) {
      _writer.write(new Uint8Array([128]).buffer);
      this.valueBlock.toBER(sizeOnly, _writer);
      _writer.write(/* @__PURE__ */ new ArrayBuffer(2));
    } else {
      const valueBlockBuf = this.valueBlock.toBER(sizeOnly);
      this.lenBlock.length = valueBlockBuf.byteLength;
      const lenBlockBuf = this.lenBlock.toBER(sizeOnly);
      _writer.write(lenBlockBuf);
      _writer.write(valueBlockBuf);
    }
    if (!writer) return _writer.final();
    return EMPTY_BUFFER;
  }
  toJSON() {
    const object = {
      ...super.toJSON(),
      idBlock: this.idBlock.toJSON(),
      lenBlock: this.lenBlock.toJSON(),
      valueBlock: this.valueBlock.toJSON(),
      name: this.name,
      optional: this.optional
    };
    if (this.primitiveSchema) object.primitiveSchema = this.primitiveSchema.toJSON();
    return object;
  }
  toString(encoding = "ascii") {
    if (encoding === "ascii") return this.onAsciiEncoding();
    return hex_exports.encode(this.toBER());
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : ${hex_exports.encode(this.valueBlock.valueBeforeDecodeView)}`;
  }
  isEqual(other) {
    if (this === other) return true;
    if (!(other instanceof this.constructor)) return false;
    const thisRaw = this.toBER();
    const otherRaw = other.toBER();
    return bytes_exports.equal(thisRaw, otherRaw);
  }
};
var ORIGINAL_BASE_BLOCK_TO_BER = BaseBlock.prototype.toBER;
function prepareIndefiniteForm(baseBlock) {
  if (baseBlock instanceof typeStore.Constructed) {
    for (const value of baseBlock.valueBlock.value) if (prepareIndefiniteForm(value)) baseBlock.lenBlock.isIndefiniteForm = true;
  }
  return !!baseBlock.lenBlock?.isIndefiniteForm;
}
var BaseStringBlock = class extends BaseBlock {
  static {
    this.NAME = "BaseStringBlock";
  }
  getValue() {
    return this.valueBlock.value;
  }
  setValue(value) {
    this.valueBlock.value = value;
  }
  constructor({ value = "", ...parameters } = {}, stringValueBlockType) {
    super(parameters, stringValueBlockType);
    if (value) this.fromString(value);
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    const resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, this.lenBlock.isIndefiniteForm ? inputLength : this.lenBlock.length);
    if (resultOffset === -1) {
      this.error = this.valueBlock.error;
      return resultOffset;
    }
    const valueError = this.checkValue(this.valueBlock.valueHexView);
    if (valueError) {
      this.error = valueError;
      return -1;
    }
    this.fromBuffer(this.valueBlock.valueHexView);
    if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
    if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
    if (!this.valueBlock.error.length) this.blockLength += this.valueBlock.blockLength;
    return resultOffset;
  }
  checkValue(_view) {
    return "";
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : '${this.valueBlock.value}'`;
  }
};
var LocalPrimitiveValueBlock = class extends HexBlock(ValueBlock) {
  static {
    this.NAME = "PrimitiveValueBlock";
  }
  constructor({ isHexOnly = true, ...parameters } = {}) {
    super(parameters);
    this.isHexOnly = isHexOnly;
  }
};
var ORIGINAL_LOCAL_PRIMITIVE_TO_BER = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(LocalPrimitiveValueBlock.prototype), "toBER")?.value;
var Primitive = class extends BaseBlock {
  static {
    typeStore.Primitive = this;
  }
  static {
    this.NAME = "PRIMITIVE";
  }
  constructor(parameters = {}) {
    super(parameters, LocalPrimitiveValueBlock);
    this.idBlock.isConstructed = false;
  }
};
var fastParserRegistry;
function registerFastParser(constructors) {
  fastParserRegistry = {
    Integer: constructors.Integer,
    Null: constructors.Null,
    Sequence: constructors.Sequence
  };
}
function fastParserContext(context) {
  const nodes = Object.getOwnPropertyDescriptor(context, "nodesCount");
  const maxNodes = Object.getOwnPropertyDescriptor(context, "maxNodes");
  const maxContentLength = Object.getOwnPropertyDescriptor(context, "maxContentLength");
  if (!nodes || !("value" in nodes) || nodes.writable !== true) return false;
  if (!maxNodes || !("value" in maxNodes) || !maxContentLength || !("value" in maxContentLength)) return false;
  return typeof nodes.value === "number" && Number.isSafeInteger(nodes.value) && nodes.value >= 0 && typeof maxNodes.value === "number" && Number.isSafeInteger(maxNodes.value) && maxNodes.value >= 0 && typeof maxContentLength.value === "number" && Number.isSafeInteger(maxContentLength.value) && maxContentLength.value >= 0 && nodes.value < maxNodes.value;
}
function fastParserType(store, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(store, name);
  return !!descriptor && "value" in descriptor && descriptor.value === value;
}
function tryFastFromBER(inputBuffer, inputOffset, inputLength, context) {
  const registry = fastParserRegistry;
  if (!registry) return void 0;
  let Constructor;
  let length = 0;
  try {
    if (Object.getPrototypeOf(inputBuffer) !== Uint8Array.prototype) return void 0;
    if (!Number.isSafeInteger(inputOffset) || inputOffset < 0 || !Number.isSafeInteger(inputLength) || inputLength < 2) return;
    if (inputOffset > inputBuffer.byteLength || inputLength > inputBuffer.byteLength - inputOffset) return void 0;
    const tag = inputBuffer[inputOffset];
    if (tag !== 2 && tag !== 5 && tag !== 48) return void 0;
    length = inputBuffer[inputOffset + 1];
    if (length >= 128 || length > inputLength - 2) return void 0;
    if (tag === 5 && length !== 0) return void 0;
    if (!fastParserContext(context)) return void 0;
    if (length > Object.getOwnPropertyDescriptor(context, "maxContentLength").value) return;
    const constructorName = tag === 2 ? "Integer" : tag === 5 ? "Null" : "Sequence";
    Constructor = registry[constructorName];
    if (!fastParserType(typeStore, constructorName, Constructor)) return void 0;
    const identificationFromBER = Object.getOwnPropertyDescriptor(LocalIdentificationBlock.prototype, "fromBER");
    const lengthFromBER = Object.getOwnPropertyDescriptor(LocalLengthBlock.prototype, "fromBER");
    if (!identificationFromBER || !("value" in identificationFromBER) || identificationFromBER.value !== ORIGINAL_LOCAL_IDENTIFICATION_FROM_BER || !lengthFromBER || !("value" in lengthFromBER) || lengthFromBER.value !== ORIGINAL_LOCAL_LENGTH_FROM_BER) return void 0;
  } catch {
    return;
  }
  if (!Constructor) return void 0;
  const result = new Constructor();
  result.idBlock.tagClass = 1;
  result.idBlock.tagNumber = inputBuffer[inputOffset] & 31;
  result.idBlock.isConstructed = inputBuffer[inputOffset] === 48;
  result.idBlock.isHexOnly = false;
  result.idBlock.blockLength = 1;
  result.lenBlock.isIndefiniteForm = false;
  result.lenBlock.longFormUsed = false;
  result.lenBlock.length = length;
  result.lenBlock.blockLength = 1;
  context.nodesCount += 1;
  const resultOffset = result.fromBER(inputBuffer, inputOffset + 2, length, context);
  result.valueBeforeDecodeView = inputBuffer.subarray(inputOffset, inputOffset + result.blockLength);
  return {
    offset: resultOffset,
    result
  };
}
var MAX_DEPTH_EXCEEDED_ERROR = "Maximum ASN.1 nesting depth exceeded";
var MAX_NODES_EXCEEDED_ERROR = "Maximum ASN.1 node count exceeded";
var MAX_CONTENT_LENGTH_EXCEEDED_ERROR = "Maximum ASN.1 content length exceeded";
function createFromBerContext(options = {}) {
  return {
    depth: 0,
    maxDepth: options.maxDepth ?? 100,
    nodesCount: 0,
    maxNodes: options.maxNodes ?? 1e4,
    maxContentLength: options.maxContentLength ?? 16777216,
    parseEmbedded: options.parseEmbedded ?? true
  };
}
function createErrorResult(error) {
  const result = new BaseBlock({}, ValueBlock);
  result.error = error;
  return {
    offset: -1,
    result
  };
}
function checkNodesLimit(context) {
  context.nodesCount += 1;
  if (context.nodesCount > context.maxNodes) return MAX_NODES_EXCEEDED_ERROR;
}
function checkContentLengthLimit(inputLength, context) {
  if (inputLength > context.maxContentLength) return MAX_CONTENT_LENGTH_EXCEEDED_ERROR;
}
function localFromBERWithChildContext(inputBuffer, inputOffset, inputLength, context) {
  const childDepth = context.depth + 1;
  if (childDepth > context.maxDepth) return createErrorResult(MAX_DEPTH_EXCEEDED_ERROR);
  context.depth = childDepth;
  try {
    return localFromBER(inputBuffer, inputOffset, inputLength, context);
  } finally {
    context.depth -= 1;
  }
}
function localChangeType(inputObject, newType) {
  if (inputObject instanceof newType) return inputObject;
  const newObject = new newType();
  newObject.idBlock = inputObject.idBlock;
  newObject.lenBlock = inputObject.lenBlock;
  newObject.warnings = inputObject.warnings;
  newObject.valueBeforeDecodeView = inputObject.valueBeforeDecodeView;
  return newObject;
}
function localFromBER(inputBuffer, inputOffset = 0, inputLength = inputBuffer.length, context = createFromBerContext()) {
  const fastResult = tryFastFromBER(inputBuffer, inputOffset, inputLength, context);
  if (fastResult) return fastResult;
  const incomingOffset = inputOffset;
  let returnObject = new BaseBlock({}, ValueBlock);
  if (!checkBufferParams(returnObject, inputBuffer, inputOffset, inputLength)) return {
    offset: -1,
    result: returnObject
  };
  if (Number.isInteger(inputOffset) && Number.isInteger(inputLength) ? inputLength === 0 : inputBuffer.subarray(inputOffset, inputOffset + inputLength).length === 0) {
    returnObject.error = "Zero buffer length";
    return {
      offset: -1,
      result: returnObject
    };
  }
  const nodesLimitError = checkNodesLimit(context);
  if (nodesLimitError) {
    returnObject.error = nodesLimitError;
    return {
      offset: -1,
      result: returnObject
    };
  }
  let resultOffset = returnObject.idBlock.fromBER(inputBuffer, inputOffset, inputLength);
  if (returnObject.idBlock.warnings.length) returnObject.warnings.concat(returnObject.idBlock.warnings);
  if (resultOffset === -1) {
    returnObject.error = returnObject.idBlock.error;
    return {
      offset: -1,
      result: returnObject
    };
  }
  inputOffset = resultOffset;
  inputLength -= returnObject.idBlock.blockLength;
  resultOffset = returnObject.lenBlock.fromBER(inputBuffer, inputOffset, inputLength);
  if (returnObject.lenBlock.warnings.length) returnObject.warnings.concat(returnObject.lenBlock.warnings);
  if (resultOffset === -1) {
    returnObject.error = returnObject.lenBlock.error;
    return {
      offset: -1,
      result: returnObject
    };
  }
  inputOffset = resultOffset;
  inputLength -= returnObject.lenBlock.blockLength;
  const valueLength = returnObject.lenBlock.isIndefiniteForm ? inputLength : returnObject.lenBlock.length;
  const contentLengthError = checkContentLengthLimit(valueLength, context);
  if (contentLengthError) {
    returnObject.error = contentLengthError;
    return {
      offset: -1,
      result: returnObject
    };
  }
  if (!returnObject.idBlock.isConstructed && returnObject.lenBlock.isIndefiniteForm) {
    returnObject.error = "Indefinite length form used for primitive encoding form";
    return {
      offset: -1,
      result: returnObject
    };
  }
  let newASN1Type = BaseBlock;
  switch (returnObject.idBlock.tagClass) {
    case 1:
      if (returnObject.idBlock.tagNumber >= 37 && returnObject.idBlock.isHexOnly === false) {
        returnObject.error = "UNIVERSAL 37 and upper tags are reserved by ASN.1 standard";
        return {
          offset: -1,
          result: returnObject
        };
      }
      switch (returnObject.idBlock.tagNumber) {
        case 0:
          if (returnObject.idBlock.isConstructed && returnObject.lenBlock.length > 0) {
            returnObject.error = "Type [UNIVERSAL 0] is reserved";
            return {
              offset: -1,
              result: returnObject
            };
          }
          newASN1Type = typeStore.EndOfContent;
          break;
        case 1:
          newASN1Type = typeStore.Boolean;
          break;
        case 2:
          newASN1Type = typeStore.Integer;
          break;
        case 3:
          newASN1Type = typeStore.BitString;
          break;
        case 4:
          newASN1Type = typeStore.OctetString;
          break;
        case 5:
          newASN1Type = typeStore.Null;
          break;
        case 6:
          newASN1Type = typeStore.ObjectIdentifier;
          break;
        case 10:
          newASN1Type = typeStore.Enumerated;
          break;
        case 12:
          newASN1Type = typeStore.Utf8String;
          break;
        case 13:
          newASN1Type = typeStore.RelativeObjectIdentifier;
          break;
        case 14:
          newASN1Type = typeStore.TIME;
          break;
        case 15:
          returnObject.error = "[UNIVERSAL 15] is reserved by ASN.1 standard";
          return {
            offset: -1,
            result: returnObject
          };
        case 16:
          newASN1Type = typeStore.Sequence;
          break;
        case 17:
          newASN1Type = typeStore.Set;
          break;
        case 18:
          newASN1Type = typeStore.NumericString;
          break;
        case 19:
          newASN1Type = typeStore.PrintableString;
          break;
        case 20:
          newASN1Type = typeStore.TeletexString;
          break;
        case 21:
          newASN1Type = typeStore.VideotexString;
          break;
        case 22:
          newASN1Type = typeStore.IA5String;
          break;
        case 23:
          newASN1Type = typeStore.UTCTime;
          break;
        case 24:
          newASN1Type = typeStore.GeneralizedTime;
          break;
        case 25:
          newASN1Type = typeStore.GraphicString;
          break;
        case 26:
          newASN1Type = typeStore.VisibleString;
          break;
        case 27:
          newASN1Type = typeStore.GeneralString;
          break;
        case 28:
          newASN1Type = typeStore.UniversalString;
          break;
        case 29:
          newASN1Type = typeStore.CharacterString;
          break;
        case 30:
          newASN1Type = typeStore.BmpString;
          break;
        case 31:
          newASN1Type = typeStore.DATE;
          break;
        case 32:
          newASN1Type = typeStore.TimeOfDay;
          break;
        case 33:
          newASN1Type = typeStore.DateTime;
          break;
        case 34:
          newASN1Type = typeStore.Duration;
          break;
        default: {
          const newObject = returnObject.idBlock.isConstructed ? new typeStore.Constructed() : new typeStore.Primitive();
          newObject.idBlock = returnObject.idBlock;
          newObject.lenBlock = returnObject.lenBlock;
          newObject.warnings = returnObject.warnings;
          returnObject = newObject;
        }
      }
      break;
    default:
      newASN1Type = returnObject.idBlock.isConstructed ? typeStore.Constructed : typeStore.Primitive;
  }
  returnObject = localChangeType(returnObject, newASN1Type);
  resultOffset = returnObject.fromBER(inputBuffer, inputOffset, valueLength, context);
  returnObject.valueBeforeDecodeView = inputBuffer.subarray(incomingOffset, incomingOffset + returnObject.blockLength);
  return {
    offset: resultOffset,
    result: returnObject
  };
}
function fromBER(inputBuffer, options = {}) {
  if (!inputBuffer.byteLength) {
    const result = new BaseBlock({}, ValueBlock);
    result.error = "Input buffer has zero length";
    return {
      offset: -1,
      result
    };
  }
  const inputView = toUint8Array(inputBuffer);
  return localFromBER(options.copyInput === false ? inputView : inputView.slice(), 0, inputBuffer.byteLength, createFromBerContext(options));
}
function checkLen(indefiniteLength, length) {
  if (indefiniteLength) return 1;
  return length;
}
var LocalConstructedValueBlock = class extends ValueBlock {
  static {
    this.NAME = "ConstructedValueBlock";
  }
  constructor({ value = [], isIndefiniteForm = false, ...parameters } = {}) {
    super(parameters);
    this.value = value;
    this.isIndefiniteForm = isIndefiniteForm;
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    const view = toUint8Array(inputBuffer);
    const parseContext = context ?? createFromBerContext();
    if (!checkBufferParams(this, view, inputOffset, inputLength)) return -1;
    this.valueBeforeDecodeView = view.subarray(inputOffset, inputOffset + inputLength);
    if (this.valueBeforeDecodeView.length === 0) {
      this.warnings.push("Zero buffer length");
      return inputOffset;
    }
    let currentOffset = inputOffset;
    while (checkLen(this.isIndefiniteForm, inputLength) > 0) {
      const returnObject = localFromBERWithChildContext(view, currentOffset, inputLength, parseContext);
      if (returnObject.offset === -1) {
        this.error = returnObject.result.error;
        this.warnings.concat(returnObject.result.warnings);
        return -1;
      }
      currentOffset = returnObject.offset;
      this.blockLength += returnObject.result.blockLength;
      inputLength -= returnObject.result.blockLength;
      this.value.push(returnObject.result);
      if (this.isIndefiniteForm && returnObject.result.constructor.NAME === "EndOfContent") break;
    }
    if (this.isIndefiniteForm) {
      if (this.value[this.value.length - 1].constructor.NAME === "EndOfContent") this.value.pop();
      else this.warnings.push("No EndOfContent block encoded");
    }
    return currentOffset;
  }
  toBER(sizeOnly, writer) {
    const _writer = writer || new ViewWriter();
    for (let i = 0; i < this.value.length; i++) this.value[i].toBER(sizeOnly, _writer);
    if (!writer) return _writer.final();
    return EMPTY_BUFFER;
  }
  toJSON() {
    const object = {
      ...super.toJSON(),
      isIndefiniteForm: this.isIndefiniteForm,
      value: []
    };
    for (const value of this.value) object.value.push(value.toJSON());
    return object;
  }
};
var ORIGINAL_LOCAL_CONSTRUCTED_TO_BER = LocalConstructedValueBlock.prototype.toBER;
var Constructed = class extends BaseBlock {
  static {
    typeStore.Constructed = this;
  }
  static {
    this.NAME = "CONSTRUCTED";
  }
  constructor(parameters = {}) {
    super(parameters, LocalConstructedValueBlock);
    this.idBlock.isConstructed = true;
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
    const resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, this.lenBlock.isIndefiniteForm ? inputLength : this.lenBlock.length, context);
    if (resultOffset === -1) {
      this.error = this.valueBlock.error;
      return resultOffset;
    }
    if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
    if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
    if (!this.valueBlock.error.length) this.blockLength += this.valueBlock.blockLength;
    return resultOffset;
  }
  onAsciiEncoding() {
    const values = [];
    for (const value of this.valueBlock.value) values.push(value.toString("ascii").split("\n").map((o) => `  ${o}`).join("\n"));
    const blockName = this.idBlock.tagClass === 3 ? `[${this.idBlock.tagNumber}]` : this.constructor.NAME;
    return values.length ? `${blockName} :
${values.join("\n")}` : `${blockName} :`;
  }
};
var LocalEndOfContentValueBlock = class extends ValueBlock {
  static {
    this.override = "EndOfContentValueBlock";
  }
  fromBER(inputBuffer, inputOffset, _inputLength) {
    return inputOffset;
  }
  toBER(_sizeOnly) {
    return EMPTY_BUFFER;
  }
};
var EndOfContent = class extends BaseBlock {
  static {
    typeStore.EndOfContent = this;
  }
  static {
    this.NAME = END_OF_CONTENT_NAME;
  }
  constructor(parameters = {}) {
    super(parameters, LocalEndOfContentValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 0;
  }
};
var Null = class extends BaseBlock {
  static {
    typeStore.Null = this;
  }
  static {
    this.NAME = "NULL";
  }
  constructor(parameters = {}) {
    super(parameters, ValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 5;
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    if (this.lenBlock.length > 0) this.warnings.push("Non-zero length of value block for Null type");
    if (!this.idBlock.error.length) this.blockLength += this.idBlock.blockLength;
    if (!this.lenBlock.error.length) this.blockLength += this.lenBlock.blockLength;
    this.blockLength += inputLength;
    if (inputOffset + inputLength > inputBuffer.byteLength) {
      this.error = "End of input reached before message was fully decoded (inconsistent offset and length values)";
      return -1;
    }
    return inputOffset + inputLength;
  }
  toBER(sizeOnly, writer) {
    const retBuf = /* @__PURE__ */ new ArrayBuffer(2);
    if (!sizeOnly) {
      const retView = new Uint8Array(retBuf);
      retView[0] = 5;
      retView[1] = 0;
    }
    if (writer) writer.write(retBuf);
    return retBuf;
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME}`;
  }
};
var LocalBooleanValueBlock = class extends HexBlock(ValueBlock) {
  static {
    this.NAME = "BooleanValueBlock";
  }
  get value() {
    for (const octet of this.valueHexView) if (octet > 0) return true;
    return false;
  }
  set value(value) {
    this.valueHexView[0] = value ? 255 : 0;
  }
  constructor({ value, ...parameters } = {}) {
    super(parameters);
    if (parameters.valueHex) this.valueHexView = toUint8Array(parameters.valueHex);
    else this.valueHexView = /* @__PURE__ */ new Uint8Array(1);
    if (value) this.value = value;
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    const inputView = toUint8Array(inputBuffer);
    if (!checkBufferParams(this, inputView, inputOffset, inputLength)) return -1;
    this.valueHexView = inputView.subarray(inputOffset, inputOffset + inputLength);
    if (inputLength > 1) this.warnings.push("Boolean value encoded in more then 1 octet");
    this.isHexOnly = true;
    if (inputLength > 1 && !int_exports.isMinimal(this.valueHexView)) this.warnings.push("Needlessly long format");
    this.blockLength = inputLength;
    return inputOffset + inputLength;
  }
  toBER() {
    return this.valueHexView.slice().buffer;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      value: this.value
    };
  }
};
var Boolean2 = class extends BaseBlock {
  static {
    typeStore.Boolean = this;
  }
  getValue() {
    return this.valueBlock.value;
  }
  setValue(value) {
    this.valueBlock.value = value;
  }
  static {
    this.NAME = "BOOLEAN";
  }
  constructor(parameters = {}) {
    super(parameters, LocalBooleanValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 1;
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : ${this.getValue}`;
  }
};
var LocalOctetStringValueBlock = class extends HexBlock(LocalConstructedValueBlock) {
  static {
    this.NAME = "OctetStringValueBlock";
  }
  constructor({ isConstructed: isConstructed2 = false, ...parameters } = {}) {
    super(parameters);
    this.isConstructed = isConstructed2;
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    let resultOffset = 0;
    if (this.isConstructed) {
      this.isHexOnly = false;
      resultOffset = LocalConstructedValueBlock.prototype.fromBER.call(this, inputBuffer, inputOffset, inputLength, context);
      if (resultOffset === -1) return resultOffset;
      for (let i = 0; i < this.value.length; i++) {
        const currentBlockName = this.value[i].constructor.NAME;
        if (currentBlockName === "EndOfContent") {
          if (this.isIndefiniteForm) break;
          else {
            this.error = "EndOfContent is unexpected, OCTET STRING may consists of OCTET STRINGs only";
            return -1;
          }
        }
        if (currentBlockName !== "OCTET STRING") {
          this.error = "OCTET STRING may consists of OCTET STRINGs only";
          return -1;
        }
      }
    } else {
      this.isHexOnly = true;
      resultOffset = super.fromBER(inputBuffer, inputOffset, inputLength);
      this.blockLength = inputLength;
    }
    return resultOffset;
  }
  toBER(sizeOnly, writer) {
    if (this.isConstructed) return LocalConstructedValueBlock.prototype.toBER.call(this, sizeOnly, writer);
    return sizeOnly ? new ArrayBuffer(this.valueHexView.byteLength) : this.valueHexView.slice().buffer;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      isConstructed: this.isConstructed
    };
  }
};
var ORIGINAL_LOCAL_OCTET_STRING_TO_BER = LocalOctetStringValueBlock.prototype.toBER;
var OctetString = class OctetString2 extends BaseBlock {
  static {
    typeStore.OctetString = this;
  }
  static {
    this.NAME = OCTET_STRING_NAME;
  }
  constructor({ idBlock = {}, lenBlock = {}, ...parameters } = {}) {
    parameters.isConstructed ??= !!parameters.value?.length;
    super({
      idBlock: {
        isConstructed: parameters.isConstructed,
        ...idBlock
      },
      lenBlock: {
        ...lenBlock,
        isIndefiniteForm: !!parameters.isIndefiniteForm
      },
      ...parameters
    }, LocalOctetStringValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 4;
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    this.valueBlock.isConstructed = this.idBlock.isConstructed;
    this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
    if (inputLength === 0) {
      if (this.idBlock.error.length === 0) this.blockLength += this.idBlock.blockLength;
      if (this.lenBlock.error.length === 0) this.blockLength += this.lenBlock.blockLength;
      return inputOffset;
    }
    if (!this.valueBlock.isConstructed && context?.parseEmbedded !== false) {
      const buf = (inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer).subarray(inputOffset, inputOffset + inputLength);
      try {
        if (buf.byteLength) {
          const parseContext = context ?? createFromBerContext();
          const asn = localFromBERWithChildContext(buf, 0, buf.byteLength, parseContext);
          if (asn.offset !== -1 && asn.offset === inputLength) this.valueBlock.value = [asn.result];
        }
      } catch {
      }
    }
    return super.fromBER(inputBuffer, inputOffset, inputLength, context);
  }
  onAsciiEncoding() {
    if (this.valueBlock.isConstructed || this.valueBlock.value && this.valueBlock.value.length) return Constructed.prototype.onAsciiEncoding.call(this);
    return `${this.constructor.NAME} : ${hex_exports.encode(this.valueBlock.valueHexView)}`;
  }
  getValue() {
    if (!this.idBlock.isConstructed) return this.valueBlock.valueHexView.slice().buffer;
    const array = [];
    for (const content of this.valueBlock.value) if (content instanceof OctetString2) array.push(content.valueBlock.valueHexView);
    return concat2(array);
  }
};
var LocalBitStringValueBlock = class extends HexBlock(LocalConstructedValueBlock) {
  static {
    this.NAME = "BitStringValueBlock";
  }
  constructor({ unusedBits = 0, isConstructed: isConstructed2 = false, ...parameters } = {}) {
    super(parameters);
    this.unusedBits = unusedBits;
    this.isConstructed = isConstructed2;
    this.blockLength = this.valueHexView.byteLength;
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    if (!inputLength) return inputOffset;
    let resultOffset = -1;
    if (this.isConstructed) {
      resultOffset = LocalConstructedValueBlock.prototype.fromBER.call(this, inputBuffer, inputOffset, inputLength, context);
      if (resultOffset === -1) return resultOffset;
      for (const value of this.value) {
        const currentBlockName = value.constructor.NAME;
        if (currentBlockName === "EndOfContent") {
          if (this.isIndefiniteForm) break;
          else {
            this.error = "EndOfContent is unexpected, BIT STRING may consists of BIT STRINGs only";
            return -1;
          }
        }
        if (currentBlockName !== "BIT STRING") {
          this.error = "BIT STRING may consists of BIT STRINGs only";
          return -1;
        }
        const valueBlock = value.valueBlock;
        if (this.unusedBits > 0 && valueBlock.unusedBits > 0) {
          this.error = 'Using of "unused bits" inside constructive BIT STRING allowed for least one only';
          return -1;
        }
        this.unusedBits = valueBlock.unusedBits;
      }
      return resultOffset;
    }
    const inputView = toUint8Array(inputBuffer);
    if (!checkBufferParams(this, inputView, inputOffset, inputLength)) return -1;
    const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
    this.unusedBits = intBuffer[0];
    if (this.unusedBits > 7) {
      this.error = "Unused bits for BitString must be in range 0-7";
      return -1;
    }
    if (!this.unusedBits && context?.parseEmbedded !== false) {
      const buf = intBuffer.subarray(1);
      try {
        if (buf.byteLength) {
          const parseContext = context ?? createFromBerContext();
          const asn = localFromBERWithChildContext(buf, 0, buf.byteLength, parseContext);
          if (asn.offset !== -1 && asn.offset === inputLength - 1) this.value = [asn.result];
        }
      } catch {
      }
    }
    this.valueHexView = intBuffer.subarray(1);
    this.blockLength = intBuffer.length;
    return inputOffset + inputLength;
  }
  toBER(sizeOnly, writer) {
    if (this.isConstructed) return LocalConstructedValueBlock.prototype.toBER.call(this, sizeOnly, writer);
    if (sizeOnly) return new ArrayBuffer(this.valueHexView.byteLength + 1);
    if (!this.valueHexView.byteLength) {
      const empty = /* @__PURE__ */ new Uint8Array(1);
      empty[0] = 0;
      return empty.buffer;
    }
    const retView = new Uint8Array(this.valueHexView.length + 1);
    retView[0] = this.unusedBits;
    retView.set(this.valueHexView, 1);
    return retView.buffer;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      unusedBits: this.unusedBits,
      isConstructed: this.isConstructed
    };
  }
};
var ORIGINAL_LOCAL_BIT_STRING_TO_BER = LocalBitStringValueBlock.prototype.toBER;
var BitString = class extends BaseBlock {
  static {
    typeStore.BitString = this;
  }
  static {
    this.NAME = BIT_STRING_NAME;
  }
  constructor({ idBlock = {}, lenBlock = {}, ...parameters } = {}) {
    parameters.isConstructed ??= !!parameters.value?.length;
    super({
      idBlock: {
        isConstructed: parameters.isConstructed,
        ...idBlock
      },
      lenBlock: {
        ...lenBlock,
        isIndefiniteForm: !!parameters.isIndefiniteForm
      },
      ...parameters
    }, LocalBitStringValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 3;
  }
  fromBER(inputBuffer, inputOffset, inputLength, context) {
    this.valueBlock.isConstructed = this.idBlock.isConstructed;
    this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
    return super.fromBER(inputBuffer, inputOffset, inputLength, context);
  }
  onAsciiEncoding() {
    if (this.valueBlock.isConstructed || this.valueBlock.value && this.valueBlock.value.length) return Constructed.prototype.onAsciiEncoding.call(this);
    else {
      const bits = [];
      const valueHex = this.valueBlock.valueHexView;
      for (const byte of valueHex) bits.push(byte.toString(2).padStart(8, "0"));
      const bitsStr = bits.join("");
      return `${this.constructor.NAME} : ${bitsStr.substring(0, bitsStr.length - this.valueBlock.unusedBits)}`;
    }
  }
};
var LocalIntegerValueBlock = class extends HexBlock(ValueBlock) {
  setValueHex() {
    if (this.valueHexView.length >= 4) {
      this.warnings.push("Too big Integer for decoding, hex only");
      this.isHexOnly = true;
      this._valueDec = 0;
    } else {
      this.isHexOnly = false;
      if (this.valueHexView.length > 0) {
        if (!int_exports.isMinimal(this.valueHexView)) this.warnings.push("Needlessly long format");
        this._valueDec = int_exports.decode(this.valueHexView);
      }
    }
  }
  static {
    this.NAME = "IntegerValueBlock";
  }
  static {
    Object.defineProperty(this.prototype, "valueHex", {
      set: function(v) {
        this.valueHexView = new Uint8Array(v);
        this.setValueHex();
      },
      get: function() {
        return this.valueHexView.slice().buffer;
      }
    });
  }
  constructor({ value, ...parameters } = {}) {
    super(parameters);
    this._valueDec = 0;
    if (parameters.valueHex) this.setValueHex();
    if (value !== void 0) this.valueDec = value;
  }
  set valueDec(v) {
    if (!Number.isInteger(v)) throw new RangeError(`Integer value must be an integer, got ${v}`);
    this.valueHexView = int_exports.encode(BigInt(v));
    this.isHexOnly = false;
    this._valueDec = v;
  }
  get valueDec() {
    return this._valueDec;
  }
  fromDER(inputBuffer, inputOffset, inputLength, expectedLength = 0) {
    const offset = this.fromBER(inputBuffer, inputOffset, inputLength);
    if (offset === -1) return offset;
    const view = this.valueHexView;
    if (view[0] === 0 && (view[1] & 128) !== 0) this.valueHexView = view.subarray(1);
    else if (expectedLength !== 0) {
      if (view.length < expectedLength) {
        if (expectedLength - view.length > 1) expectedLength = view.length + 1;
        this.valueHexView = view.subarray(expectedLength - view.length);
      }
    }
    return offset;
  }
  toDER(sizeOnly = false) {
    const view = this.valueHexView;
    switch (true) {
      case (view[0] & 128) !== 0:
        {
          const updatedView = new Uint8Array(this.valueHexView.length + 1);
          updatedView[0] = 0;
          updatedView.set(view, 1);
          this.valueHexView = updatedView;
        }
        break;
      case (view[0] === 0 && (view[1] & 128) === 0):
        this.valueHexView = this.valueHexView.subarray(1);
    }
    return this.toBER(sizeOnly);
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    const resultOffset = super.fromBER(inputBuffer, inputOffset, inputLength);
    if (resultOffset === -1) return resultOffset;
    this.setValueHex();
    return resultOffset;
  }
  toBER(sizeOnly) {
    return sizeOnly ? new ArrayBuffer(this.valueHexView.length) : this.valueHexView.slice().buffer;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      valueDec: this.valueDec
    };
  }
  toString() {
    return bytesToSignedBigInt(this.valueHexView).toString(10);
  }
};
var ORIGINAL_LOCAL_INTEGER_TO_BER = LocalIntegerValueBlock.prototype.toBER;
var ORIGINAL_LOCAL_INTEGER_TO_STRING = LocalIntegerValueBlock.prototype.toString;
var Integer = class Integer2 extends BaseBlock {
  static {
    typeStore.Integer = this;
  }
  static {
    this.NAME = "INTEGER";
  }
  constructor(parameters = {}) {
    super(parameters, LocalIntegerValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 2;
  }
  toBigInt() {
    const valueBlock = this.valueBlock;
    const toString = valueBlock.toString;
    if (toString === ORIGINAL_LOCAL_INTEGER_TO_STRING) return bytesToSignedBigInt(valueBlock.valueHexView);
    return BigInt(Reflect.apply(toString, valueBlock, []));
  }
  static fromBigInt(value) {
    return new Integer2({ valueHex: signedBigIntToBytes(BigInt(value)) });
  }
  convertToDER() {
    const integer = new Integer2({ valueHex: this.valueBlock.valueHexView });
    integer.valueBlock.toDER();
    return integer;
  }
  convertFromDER() {
    return new Integer2({ valueHex: this.valueBlock.valueHexView[0] === 0 ? this.valueBlock.valueHexView.subarray(1) : this.valueBlock.valueHexView });
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : ${this.valueBlock.toString()}`;
  }
};
var Enumerated = class extends Integer {
  static {
    typeStore.Enumerated = this;
  }
  static {
    this.NAME = "ENUMERATED";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 10;
  }
};
var LocalSidValueBlock = class extends HexBlock(ValueBlock) {
  static {
    this.NAME = "sidBlock";
  }
  constructor({ valueDec = -1, isFirstSid = false, ...parameters } = {}) {
    super(parameters);
    this.valueDec = valueDec;
    this.isFirstSid = isFirstSid;
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    if (!inputLength) return inputOffset;
    const inputView = toUint8Array(inputBuffer);
    if (!checkBufferParams(this, inputView, inputOffset, inputLength)) return -1;
    const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
    if (this.blockLength === 0 && Number.isInteger(inputOffset) && Number.isInteger(inputLength)) {
      let sidLength = 0;
      while (sidLength < inputLength) {
        const octet = intBuffer[sidLength];
        sidLength++;
        if ((octet & 128) === 0) break;
      }
      this.blockLength = sidLength;
      this.valueHexView = new Uint8Array(sidLength);
      for (let i = 0; i < sidLength; i++) this.valueHexView[i] = intBuffer[i] & 127;
    } else {
      this.valueHexView = new Uint8Array(inputLength);
      for (let i = 0; i < inputLength; i++) {
        this.valueHexView[i] = intBuffer[i] & 127;
        this.blockLength++;
        if ((intBuffer[i] & 128) === 0) break;
      }
      const tempView = new Uint8Array(this.blockLength);
      for (let i = 0; i < this.blockLength; i++) tempView[i] = this.valueHexView[i];
      this.valueHexView = tempView;
    }
    if ((intBuffer[this.blockLength - 1] & 128) !== 0) {
      this.error = "End of input reached before message was fully decoded";
      return -1;
    }
    if (this.valueHexView[0] === 0) this.warnings.push("Needlessly long format of SID encoding");
    const valueDec = this.blockLength <= 8 ? decodeBase128(this.valueHexView) : void 0;
    if (valueDec !== void 0) this.valueDec = valueDec;
    else {
      this.isHexOnly = true;
      this.warnings.push("Too big SID for decoding, hex only");
    }
    return inputOffset + this.blockLength;
  }
  set valueBigInt(value) {
    const bytes = encodeBase128(BigInt(value));
    if (!bytes) {
      this.error = "Error during encoding SID value";
      return;
    }
    for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 128;
    this.fromBER(bytes, 0, bytes.length);
  }
  toBER(sizeOnly) {
    if (this.isHexOnly) {
      if (sizeOnly) return new ArrayBuffer(this.valueHexView.byteLength);
      const curView = this.valueHexView;
      const retView2 = new Uint8Array(this.blockLength);
      for (let i = 0; i < this.blockLength - 1; i++) retView2[i] = curView[i] | 128;
      retView2[this.blockLength - 1] = curView[this.blockLength - 1];
      return toArrayBuffer(retView2);
    }
    const encodedBuf = encodeBase128(this.valueDec);
    if (!encodedBuf) {
      this.error = "Error during encoding SID value";
      return EMPTY_BUFFER;
    }
    const retView = new Uint8Array(encodedBuf.byteLength);
    if (!sizeOnly) {
      const len = encodedBuf.byteLength - 1;
      for (let i = 0; i < len; i++) retView[i] = encodedBuf[i] | 128;
      retView[len] = encodedBuf[len];
    }
    return toArrayBuffer(retView);
  }
  toString() {
    let result = "";
    if (this.isHexOnly) result = hex_exports.encode(this.valueHexView);
    else if (this.isFirstSid) {
      let sidValue = this.valueDec;
      if (this.valueDec <= 39) result = "0.";
      else if (this.valueDec <= 79) {
        result = "1.";
        sidValue -= 40;
      } else {
        result = "2.";
        sidValue -= 80;
      }
      result += sidValue.toString();
    } else result = this.valueDec.toString();
    return result;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      valueDec: this.valueDec,
      isFirstSid: this.isFirstSid
    };
  }
};
var LocalObjectIdentifierValueBlock = class extends ValueBlock {
  static {
    this.NAME = "ObjectIdentifierValueBlock";
  }
  constructor({ value = "", ...parameters } = {}) {
    super(parameters);
    this.value = [];
    if (value) this.fromString(value);
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    let resultOffset = inputOffset;
    while (inputLength > 0) {
      const sidBlock = new LocalSidValueBlock();
      resultOffset = sidBlock.fromBER(inputBuffer, resultOffset, inputLength);
      if (resultOffset === -1) {
        this.blockLength = 0;
        this.error = sidBlock.error;
        return resultOffset;
      }
      if (this.value.length === 0) sidBlock.isFirstSid = true;
      this.blockLength += sidBlock.blockLength;
      inputLength -= sidBlock.blockLength;
      this.value.push(sidBlock);
    }
    return resultOffset;
  }
  toBER(sizeOnly) {
    const retBuffers = [];
    for (let i = 0; i < this.value.length; i++) {
      const valueBuf = this.value[i].toBER(sizeOnly);
      if (valueBuf.byteLength === 0) {
        this.error = this.value[i].error;
        return EMPTY_BUFFER;
      }
      retBuffers.push(valueBuf);
    }
    return concat2(retBuffers);
  }
  fromString(string) {
    this.value = [];
    let pos1 = 0;
    let pos2 = 0;
    let sid = "";
    let flag = false;
    do {
      pos2 = string.indexOf(".", pos1);
      if (pos2 === -1) sid = string.substring(pos1);
      else sid = string.substring(pos1, pos2);
      pos1 = pos2 + 1;
      if (flag) {
        const sidBlock = this.value[0];
        let plus = 0;
        switch (sidBlock.valueDec) {
          case 0:
            break;
          case 1:
            plus = 40;
            break;
          case 2:
            plus = 80;
            break;
          default:
            this.value = [];
            return;
        }
        const parsedSID = parseInt(sid, 10);
        if (isNaN(parsedSID)) return;
        sidBlock.valueDec = parsedSID + plus;
        flag = false;
      } else {
        const sidBlock = new LocalSidValueBlock();
        if (sid > Number.MAX_SAFE_INTEGER) sidBlock.valueBigInt = BigInt(sid);
        else {
          sidBlock.valueDec = parseInt(sid, 10);
          if (isNaN(sidBlock.valueDec)) return;
        }
        if (!this.value.length) {
          sidBlock.isFirstSid = true;
          flag = true;
        }
        this.value.push(sidBlock);
      }
    } while (pos2 !== -1);
  }
  toString() {
    let result = "";
    let isHexOnly = false;
    for (let i = 0; i < this.value.length; i++) {
      isHexOnly = this.value[i].isHexOnly;
      let sidStr = this.value[i].toString();
      if (i !== 0) result = `${result}.`;
      if (isHexOnly) {
        sidStr = `{${sidStr}}`;
        if (this.value[i].isFirstSid) result = `2.{${sidStr} - 80}`;
        else result += sidStr;
      } else result += sidStr;
    }
    return result;
  }
  toJSON() {
    const object = {
      ...super.toJSON(),
      value: this.toString(),
      sidArray: []
    };
    for (let i = 0; i < this.value.length; i++) object.sidArray.push(this.value[i].toJSON());
    return object;
  }
};
var ObjectIdentifier = class extends BaseBlock {
  static {
    typeStore.ObjectIdentifier = this;
  }
  static {
    this.NAME = "OBJECT IDENTIFIER";
  }
  getValue() {
    return this.valueBlock.toString();
  }
  setValue(value) {
    this.valueBlock.fromString(value);
  }
  constructor(parameters = {}) {
    super(parameters, LocalObjectIdentifierValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 6;
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : ${this.valueBlock.toString() || "empty"}`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      value: this.getValue()
    };
  }
};
var LocalRelativeSidValueBlock = class extends HexBlock(LocalBaseBlock) {
  static {
    this.NAME = "relativeSidBlock";
  }
  constructor({ valueDec = 0, ...parameters } = {}) {
    super(parameters);
    this.valueDec = valueDec;
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    if (inputLength === 0) return inputOffset;
    const inputView = toUint8Array(inputBuffer);
    if (!checkBufferParams(this, inputView, inputOffset, inputLength)) return -1;
    const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
    if (this.blockLength === 0 && Number.isInteger(inputOffset) && Number.isInteger(inputLength)) {
      let sidLength = 0;
      while (sidLength < inputLength) {
        const octet = intBuffer[sidLength];
        sidLength++;
        if ((octet & 128) === 0) break;
      }
      this.blockLength = sidLength;
      this.valueHexView = new Uint8Array(sidLength);
      for (let i = 0; i < sidLength; i++) this.valueHexView[i] = intBuffer[i] & 127;
    } else {
      this.valueHexView = new Uint8Array(inputLength);
      for (let i = 0; i < inputLength; i++) {
        this.valueHexView[i] = intBuffer[i] & 127;
        this.blockLength++;
        if ((intBuffer[i] & 128) === 0) break;
      }
      const tempView = new Uint8Array(this.blockLength);
      for (let i = 0; i < this.blockLength; i++) tempView[i] = this.valueHexView[i];
      this.valueHexView = tempView;
    }
    if ((intBuffer[this.blockLength - 1] & 128) !== 0) {
      this.error = "End of input reached before message was fully decoded";
      return -1;
    }
    if (this.valueHexView[0] === 0) this.warnings.push("Needlessly long format of SID encoding");
    const valueDec = this.blockLength <= 8 ? decodeBase128(this.valueHexView) : void 0;
    if (valueDec !== void 0) this.valueDec = valueDec;
    else {
      this.isHexOnly = true;
      this.warnings.push("Too big SID for decoding, hex only");
    }
    return inputOffset + this.blockLength;
  }
  toBER(sizeOnly) {
    if (this.isHexOnly) {
      if (sizeOnly) return new ArrayBuffer(this.valueHexView.byteLength);
      const curView = this.valueHexView;
      const retView2 = new Uint8Array(this.blockLength);
      for (let i = 0; i < this.blockLength - 1; i++) retView2[i] = curView[i] | 128;
      retView2[this.blockLength - 1] = curView[this.blockLength - 1];
      return retView2.buffer;
    }
    const encodedBuf = encodeBase128(this.valueDec);
    if (!encodedBuf) {
      this.error = "Error during encoding SID value";
      return EMPTY_BUFFER;
    }
    const retView = new Uint8Array(encodedBuf.byteLength);
    if (!sizeOnly) {
      const len = encodedBuf.byteLength - 1;
      for (let i = 0; i < len; i++) retView[i] = encodedBuf[i] | 128;
      retView[len] = encodedBuf[len];
    }
    return retView.buffer;
  }
  toString() {
    let result = "";
    if (this.isHexOnly) result = hex_exports.encode(this.valueHexView);
    else result = this.valueDec.toString();
    return result;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      valueDec: this.valueDec
    };
  }
};
var LocalRelativeObjectIdentifierValueBlock = class extends ValueBlock {
  static {
    this.NAME = "RelativeObjectIdentifierValueBlock";
  }
  constructor({ value = "", ...parameters } = {}) {
    super(parameters);
    this.value = [];
    if (value) this.fromString(value);
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    let resultOffset = inputOffset;
    while (inputLength > 0) {
      const sidBlock = new LocalRelativeSidValueBlock();
      resultOffset = sidBlock.fromBER(inputBuffer, resultOffset, inputLength);
      if (resultOffset === -1) {
        this.blockLength = 0;
        this.error = sidBlock.error;
        return resultOffset;
      }
      this.blockLength += sidBlock.blockLength;
      inputLength -= sidBlock.blockLength;
      this.value.push(sidBlock);
    }
    return resultOffset;
  }
  toBER(sizeOnly, _writer) {
    const retBuffers = [];
    for (let i = 0; i < this.value.length; i++) {
      const valueBuf = this.value[i].toBER(sizeOnly);
      if (valueBuf.byteLength === 0) {
        this.error = this.value[i].error;
        return EMPTY_BUFFER;
      }
      retBuffers.push(valueBuf);
    }
    return concat2(retBuffers);
  }
  fromString(string) {
    this.value = [];
    let pos1 = 0;
    let pos2 = 0;
    let sid = "";
    do {
      pos2 = string.indexOf(".", pos1);
      if (pos2 === -1) sid = string.substring(pos1);
      else sid = string.substring(pos1, pos2);
      pos1 = pos2 + 1;
      const sidBlock = new LocalRelativeSidValueBlock();
      sidBlock.valueDec = parseInt(sid, 10);
      if (isNaN(sidBlock.valueDec)) return true;
      this.value.push(sidBlock);
    } while (pos2 !== -1);
    return true;
  }
  toString() {
    let result = "";
    let isHexOnly = false;
    for (let i = 0; i < this.value.length; i++) {
      isHexOnly = this.value[i].isHexOnly;
      let sidStr = this.value[i].toString();
      if (i !== 0) result = `${result}.`;
      if (isHexOnly) {
        sidStr = `{${sidStr}}`;
        result += sidStr;
      } else result += sidStr;
    }
    return result;
  }
  toJSON() {
    const object = {
      ...super.toJSON(),
      value: this.toString(),
      sidArray: []
    };
    for (let i = 0; i < this.value.length; i++) object.sidArray.push(this.value[i].toJSON());
    return object;
  }
};
var RelativeObjectIdentifier = class extends BaseBlock {
  static {
    typeStore.RelativeObjectIdentifier = this;
  }
  getValue() {
    return this.valueBlock.toString();
  }
  setValue(value) {
    this.valueBlock.fromString(value);
  }
  static {
    this.NAME = "RelativeObjectIdentifier";
  }
  constructor(parameters = {}) {
    super(parameters, LocalRelativeObjectIdentifierValueBlock);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 13;
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : ${this.valueBlock.toString() || "empty"}`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      value: this.getValue()
    };
  }
};
var Sequence = class extends Constructed {
  static {
    typeStore.Sequence = this;
  }
  static {
    this.NAME = "SEQUENCE";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 16;
  }
};
var Set2 = class extends Constructed {
  static {
    typeStore.Set = this;
  }
  static {
    this.NAME = "SET";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 17;
  }
};
var LocalStringValueBlock = class extends HexBlock(ValueBlock) {
  static {
    this.NAME = "StringValueBlock";
  }
  constructor({ ...parameters } = {}) {
    super(parameters);
    this.isHexOnly = true;
    this.value = "";
  }
  toJSON() {
    return {
      ...super.toJSON(),
      value: this.value
    };
  }
};
var LocalSimpleStringValueBlock = class extends LocalStringValueBlock {
  static {
    this.NAME = "SimpleStringValueBlock";
  }
};
var LocalSimpleStringBlock = class extends BaseStringBlock {
  static {
    this.NAME = "SIMPLE STRING";
  }
  constructor({ ...parameters } = {}) {
    super(parameters, LocalSimpleStringValueBlock);
  }
  fromBuffer(inputBuffer) {
    this.valueBlock.value = String.fromCharCode.apply(null, toUint8Array(inputBuffer));
  }
  fromString(inputString) {
    const strLen = inputString.length;
    const view = this.valueBlock.valueHexView = new Uint8Array(strLen);
    for (let i = 0; i < strLen; i++) view[i] = inputString.charCodeAt(i);
    this.valueBlock.value = inputString;
  }
};
var strictUtf8Decoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true
});
var LONE_SURROGATE = /\p{Cs}/u;
var LocalUtf8StringValueBlock = class extends LocalSimpleStringBlock {
  static {
    this.NAME = "Utf8StringValueBlock";
  }
  fromBuffer(inputBuffer) {
    this.valueBlock.valueHexView = toUint8Array(inputBuffer);
    try {
      this.valueBlock.value = strictUtf8Decoder.decode(this.valueBlock.valueHexView);
    } catch (ex) {
      this.warnings.push(`Error during "decodeURIComponent": ${ex}, using raw string`);
      this.valueBlock.value = binary_exports.encode(inputBuffer);
    }
  }
  fromString(inputString) {
    if (LONE_SURROGATE.test(inputString)) throw new TypeError("The string contains lone surrogates and cannot be encoded as UTF-8");
    this.valueBlock.valueHexView = utf8_exports.encode(inputString);
    this.valueBlock.value = inputString;
  }
};
var Utf8String = class extends LocalUtf8StringValueBlock {
  static {
    typeStore.Utf8String = this;
  }
  static {
    this.NAME = "UTF8String";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 12;
  }
};
var LocalBmpStringValueBlock = class extends LocalSimpleStringBlock {
  static {
    this.NAME = "BmpStringValueBlock";
  }
  checkValue(view) {
    return view.length % 2 !== 0 ? "BMPString value length must be a multiple of 2" : "";
  }
  fromBuffer(inputBuffer) {
    this.valueBlock.value = utf16_exports.decode(inputBuffer);
    this.valueBlock.valueHexView = toUint8Array(inputBuffer);
  }
  fromString(inputString) {
    this.valueBlock.value = inputString;
    this.valueBlock.valueHexView = utf16_exports.encode(inputString);
  }
};
var BmpString = class extends LocalBmpStringValueBlock {
  static {
    typeStore.BmpString = this;
  }
  static {
    this.NAME = "BMPString";
  }
  constructor({ ...parameters } = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 30;
  }
};
var MAX_CODE_POINT = 1114111;
var REPLACEMENT_CODE_POINT = 65533;
var LocalUniversalStringValueBlock = class extends LocalSimpleStringBlock {
  static {
    this.NAME = "UniversalStringValueBlock";
  }
  checkValue(view) {
    return view.length % 4 !== 0 ? "UniversalString value length must be a multiple of 4" : "";
  }
  fromBuffer(inputBuffer) {
    const view = toUint8Array(inputBuffer);
    const data = new DataView(view.buffer, view.byteOffset, view.byteLength);
    const count = view.length >> 2;
    const codePoints = [];
    for (let i = 0; i < count; i++) {
      const codePoint = data.getUint32(i * 4);
      if (codePoint > MAX_CODE_POINT) {
        this.warnings.push(`Code point 0x${codePoint.toString(16)} is outside the Unicode range, using U+FFFD`);
        codePoints.push(REPLACEMENT_CODE_POINT);
      } else if (codePoint >= 55296 && codePoint <= 57343) {
        const next = i + 1 < count ? data.getUint32((i + 1) * 4) : 0;
        if (codePoint <= 56319 && next >= 56320 && next <= 57343) {
          codePoints.push(65536 + (codePoint - 55296 << 10) + (next - 56320));
          i++;
        } else {
          this.warnings.push(`Code point 0x${codePoint.toString(16)} is a lone surrogate, using U+FFFD`);
          codePoints.push(REPLACEMENT_CODE_POINT);
        }
      } else codePoints.push(codePoint);
    }
    let value = "";
    for (let i = 0; i < codePoints.length; i += 8192) value += String.fromCodePoint(...codePoints.slice(i, i + 8192));
    this.valueBlock.value = value;
  }
  fromString(inputString) {
    const codePoints = Array.from(inputString, (char) => char.codePointAt(0));
    const valueHexView = this.valueBlock.valueHexView = new Uint8Array(codePoints.length * 4);
    for (let i = 0; i < codePoints.length; i++) valueHexView.set(uint_exports.encode(codePoints[i], { length: 4 }), i * 4);
    this.valueBlock.value = inputString;
  }
};
var UniversalString = class extends LocalUniversalStringValueBlock {
  static {
    typeStore.UniversalString = this;
  }
  static {
    this.NAME = "UniversalString";
  }
  constructor({ ...parameters } = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 28;
  }
};
var NumericString = class extends LocalSimpleStringBlock {
  static {
    typeStore.NumericString = this;
  }
  static {
    this.NAME = "NumericString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 18;
  }
};
var PrintableString = class extends LocalSimpleStringBlock {
  static {
    typeStore.PrintableString = this;
  }
  static {
    this.NAME = "PrintableString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 19;
  }
};
var TeletexString = class extends LocalSimpleStringBlock {
  static {
    typeStore.TeletexString = this;
  }
  static {
    this.NAME = "TeletexString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 20;
  }
};
var VideotexString = class extends LocalSimpleStringBlock {
  static {
    typeStore.VideotexString = this;
  }
  static {
    this.NAME = "VideotexString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 21;
  }
};
var IA5String = class extends LocalSimpleStringBlock {
  static {
    typeStore.IA5String = this;
  }
  static {
    this.NAME = "IA5String";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 22;
  }
};
var GraphicString = class extends LocalSimpleStringBlock {
  static {
    typeStore.GraphicString = this;
  }
  static {
    this.NAME = "GraphicString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 25;
  }
};
var VisibleString = class extends LocalSimpleStringBlock {
  static {
    typeStore.VisibleString = this;
  }
  static {
    this.NAME = "VisibleString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 26;
  }
};
var GeneralString = class extends LocalSimpleStringBlock {
  static {
    typeStore.GeneralString = this;
  }
  static {
    this.NAME = "GeneralString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 27;
  }
};
var CharacterString = class extends LocalSimpleStringBlock {
  static {
    typeStore.CharacterString = this;
  }
  static {
    this.NAME = "CharacterString";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 29;
  }
};
var UTCTime = class extends VisibleString {
  static {
    typeStore.UTCTime = this;
  }
  static {
    this.NAME = "UTCTime";
  }
  constructor({ value, valueDate, ...parameters } = {}) {
    super(parameters);
    this.year = 0;
    this.month = 0;
    this.day = 0;
    this.hour = 0;
    this.minute = 0;
    this.second = 0;
    if (value) {
      this.fromString(value);
      this.valueBlock.valueHexView = new Uint8Array(value.length);
      for (let i = 0; i < value.length; i++) this.valueBlock.valueHexView[i] = value.charCodeAt(i);
    }
    if (valueDate) {
      this.fromDate(valueDate);
      this.valueBlock.valueHexView = new Uint8Array(this.toBuffer());
    }
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 23;
  }
  fromBuffer(inputBuffer) {
    this.fromString(String.fromCharCode.apply(null, toUint8Array(inputBuffer)));
  }
  toBuffer() {
    this.checkYear();
    const str = this.toString();
    const buffer = new ArrayBuffer(str.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
    return buffer;
  }
  checkYear() {
    if (!(this.year >= 1950 && this.year <= 2049)) throw new RangeError(`UTCTime year must be between 1950 and 2049, got ${this.year}; use GeneralizedTime instead`);
  }
  fromDate(inputDate) {
    this.year = inputDate.getUTCFullYear();
    this.month = inputDate.getUTCMonth() + 1;
    this.day = inputDate.getUTCDate();
    this.hour = inputDate.getUTCHours();
    this.minute = inputDate.getUTCMinutes();
    this.second = inputDate.getUTCSeconds();
  }
  toDate() {
    return new Date(Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second));
  }
  fromString(inputString) {
    const parserArray = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z/gi.exec(inputString);
    if (parserArray === null) {
      this.error = "Wrong input string for conversion";
      return;
    }
    const year = parseInt(parserArray[1], 10);
    if (year >= 50) this.year = 1900 + year;
    else this.year = 2e3 + year;
    this.month = parseInt(parserArray[2], 10);
    this.day = parseInt(parserArray[3], 10);
    this.hour = parseInt(parserArray[4], 10);
    this.minute = parseInt(parserArray[5], 10);
    this.second = parseInt(parserArray[6], 10);
  }
  toString(encoding = "iso") {
    if (encoding === "iso") {
      const outputArray = Array.from({ length: 7 });
      outputArray[0] = String(this.year % 100).padStart(2, "0");
      outputArray[1] = String(this.month).padStart(2, "0");
      outputArray[2] = String(this.day).padStart(2, "0");
      outputArray[3] = String(this.hour).padStart(2, "0");
      outputArray[4] = String(this.minute).padStart(2, "0");
      outputArray[5] = String(this.second).padStart(2, "0");
      outputArray[6] = "Z";
      return outputArray.join("");
    }
    return super.toString(encoding);
  }
  onAsciiEncoding() {
    return `${this.constructor.NAME} : ${this.toDate().toISOString()}`;
  }
  toJSON() {
    return {
      ...super.toJSON(),
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      second: this.second
    };
  }
};
var GeneralizedTime = class extends UTCTime {
  static {
    typeStore.GeneralizedTime = this;
  }
  static {
    this.NAME = "GeneralizedTime";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.millisecond ??= 0;
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 24;
  }
  checkYear() {
  }
  fromDate(inputDate) {
    super.fromDate(inputDate);
    this.millisecond = inputDate.getUTCMilliseconds();
  }
  toDate() {
    const utcDate = Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second, this.millisecond);
    return new Date(utcDate);
  }
  fromString(inputString) {
    let isUTC = false;
    let timeString = "";
    let dateTimeString = "";
    let fractionPart = 0;
    let parser;
    let hourDifference = 0;
    let minuteDifference = 0;
    if (inputString[inputString.length - 1] === "Z") {
      timeString = inputString.substring(0, inputString.length - 1);
      isUTC = true;
    } else {
      const number = new Number(inputString[inputString.length - 1]);
      if (isNaN(number.valueOf())) throw new Error("Wrong input string for conversion");
      timeString = inputString;
    }
    if (isUTC) {
      if (timeString.indexOf("+") !== -1) throw new Error("Wrong input string for conversion");
      if (timeString.indexOf("-") !== -1) throw new Error("Wrong input string for conversion");
    } else {
      let multiplier = 1;
      let differencePosition = timeString.indexOf("+");
      let differenceString = "";
      if (differencePosition === -1) {
        differencePosition = timeString.indexOf("-");
        multiplier = -1;
      }
      if (differencePosition !== -1) {
        differenceString = timeString.substring(differencePosition + 1);
        timeString = timeString.substring(0, differencePosition);
        if (differenceString.length !== 2 && differenceString.length !== 4) throw new Error("Wrong input string for conversion");
        let number = parseInt(differenceString.substring(0, 2), 10);
        if (isNaN(number.valueOf())) throw new Error("Wrong input string for conversion");
        hourDifference = multiplier * number;
        if (differenceString.length === 4) {
          number = parseInt(differenceString.substring(2, 4), 10);
          if (isNaN(number.valueOf())) throw new Error("Wrong input string for conversion");
          minuteDifference = multiplier * number;
        }
      }
    }
    let fractionPointPosition = timeString.indexOf(".");
    if (fractionPointPosition === -1) fractionPointPosition = timeString.indexOf(",");
    if (fractionPointPosition !== -1) {
      const fractionPartCheck = /* @__PURE__ */ new Number(`0${timeString.substring(fractionPointPosition)}`);
      if (isNaN(fractionPartCheck.valueOf())) throw new Error("Wrong input string for conversion");
      fractionPart = fractionPartCheck.valueOf();
      dateTimeString = timeString.substring(0, fractionPointPosition);
    } else dateTimeString = timeString;
    switch (true) {
      case dateTimeString.length === 8:
        parser = /(\d{4})(\d{2})(\d{2})/gi;
        if (fractionPointPosition !== -1) throw new Error("Wrong input string for conversion");
        break;
      case dateTimeString.length === 10:
        parser = /(\d{4})(\d{2})(\d{2})(\d{2})/gi;
        if (fractionPointPosition !== -1) {
          let fractionResult = 60 * fractionPart;
          this.minute = Math.floor(fractionResult);
          fractionResult = 60 * (fractionResult - this.minute);
          this.second = Math.floor(fractionResult);
          fractionResult = 1e3 * (fractionResult - this.second);
          this.millisecond = Math.floor(fractionResult);
        }
        break;
      case dateTimeString.length === 12:
        parser = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/gi;
        if (fractionPointPosition !== -1) {
          let fractionResult = 60 * fractionPart;
          this.second = Math.floor(fractionResult);
          fractionResult = 1e3 * (fractionResult - this.second);
          this.millisecond = Math.floor(fractionResult);
        }
        break;
      case dateTimeString.length === 14:
        parser = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/gi;
        if (fractionPointPosition !== -1) {
          const fractionResult = 1e3 * fractionPart;
          this.millisecond = Math.floor(fractionResult);
        }
        break;
      default:
        throw new Error("Wrong input string for conversion");
    }
    const parserArray = parser.exec(dateTimeString);
    if (parserArray === null) throw new Error("Wrong input string for conversion");
    for (let j = 1; j < parserArray.length; j++) switch (j) {
      case 1:
        this.year = parseInt(parserArray[j], 10);
        break;
      case 2:
        this.month = parseInt(parserArray[j], 10);
        break;
      case 3:
        this.day = parseInt(parserArray[j], 10);
        break;
      case 4:
        this.hour = parseInt(parserArray[j], 10) + hourDifference;
        break;
      case 5:
        this.minute = parseInt(parserArray[j], 10) + minuteDifference;
        break;
      case 6:
        this.second = parseInt(parserArray[j], 10);
        break;
      default:
        throw new Error("Wrong input string for conversion");
    }
    if (isUTC === false) {
      const tempDate = new Date(this.year, this.month, this.day, this.hour, this.minute, this.second, this.millisecond);
      this.year = tempDate.getUTCFullYear();
      this.month = tempDate.getUTCMonth();
      this.day = tempDate.getUTCDay();
      this.hour = tempDate.getUTCHours();
      this.minute = tempDate.getUTCMinutes();
      this.second = tempDate.getUTCSeconds();
      this.millisecond = tempDate.getUTCMilliseconds();
    }
  }
  toString(encoding = "iso") {
    if (encoding === "iso") {
      const outputArray = [];
      outputArray.push(String(this.year).padStart(4, "0"));
      outputArray.push(String(this.month).padStart(2, "0"));
      outputArray.push(String(this.day).padStart(2, "0"));
      outputArray.push(String(this.hour).padStart(2, "0"));
      outputArray.push(String(this.minute).padStart(2, "0"));
      outputArray.push(String(this.second).padStart(2, "0"));
      if (this.millisecond !== 0) {
        outputArray.push(".");
        outputArray.push(String(this.millisecond).padStart(3, "0").replace(/0+$/, ""));
      }
      outputArray.push("Z");
      return outputArray.join("");
    }
    return super.toString(encoding);
  }
  toJSON() {
    return {
      ...super.toJSON(),
      millisecond: this.millisecond
    };
  }
};
var DATE = class extends Utf8String {
  static {
    typeStore.DATE = this;
  }
  static {
    this.NAME = "DATE";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 31;
  }
};
var TimeOfDay = class extends Utf8String {
  static {
    typeStore.TimeOfDay = this;
  }
  static {
    this.NAME = "TimeOfDay";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 32;
  }
};
var DateTime = class extends Utf8String {
  static {
    typeStore.DateTime = this;
  }
  static {
    this.NAME = "DateTime";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 33;
  }
};
var Duration = class extends Utf8String {
  static {
    typeStore.Duration = this;
  }
  static {
    this.NAME = "Duration";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 34;
  }
};
var TIME = class extends Utf8String {
  static {
    typeStore.TIME = this;
  }
  static {
    this.NAME = "TIME";
  }
  constructor(parameters = {}) {
    super(parameters);
    this.idBlock.tagClass = 1;
    this.idBlock.tagNumber = 14;
  }
};
var Any = class {
  constructor({ name = "", optional = false } = {}) {
    this.name = name;
    this.optional = optional;
  }
};
var Choice = class extends Any {
  constructor({ value = [], ...parameters } = {}) {
    super(parameters);
    this.value = value;
  }
};
var Repeated = class extends Any {
  constructor({ value = new Any(), local = false, ...parameters } = {}) {
    super(parameters);
    this.value = value;
    this.local = local;
  }
};
var RawData = class {
  get data() {
    return this.dataView.slice().buffer;
  }
  set data(value) {
    this.dataView = toUint8Array(value);
  }
  constructor({ data = EMPTY_VIEW } = {}) {
    this.dataView = toUint8Array(data);
  }
  fromBER(inputBuffer, inputOffset, inputLength) {
    const endLength = inputOffset + inputLength;
    this.dataView = toUint8Array(inputBuffer).subarray(inputOffset, endLength);
    return endLength;
  }
  toBER(_sizeOnly) {
    return this.dataView.slice().buffer;
  }
};
function compareSchema(root, inputData, inputSchema) {
  if (inputSchema instanceof Choice) {
    for (const element of inputSchema.value) if (compareSchema(root, inputData, element).verified) return {
      verified: true,
      result: root
    };
    {
      const _result = {
        verified: false,
        result: { error: "Wrong values for Choice type" }
      };
      if (inputSchema.hasOwnProperty("name")) _result.name = inputSchema.name;
      return _result;
    }
  }
  if (inputSchema instanceof Any) {
    if (inputSchema.hasOwnProperty("name")) root[inputSchema.name] = inputData;
    return {
      verified: true,
      result: root
    };
  }
  if (root instanceof Object === false) return {
    verified: false,
    result: { error: "Wrong root object" }
  };
  if (inputData instanceof Object === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 data" }
  };
  if (inputSchema instanceof Object === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if ("idBlock" in inputSchema === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if ("fromBER" in inputSchema.idBlock === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if ("toBER" in inputSchema.idBlock === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  const encodedId = inputSchema.idBlock.toBER(false);
  if (encodedId.byteLength === 0) return {
    verified: false,
    result: { error: "Error encoding idBlock for ASN.1 schema" }
  };
  if (inputSchema.idBlock.fromBER(encodedId, 0, encodedId.byteLength) === -1) return {
    verified: false,
    result: { error: "Error decoding idBlock for ASN.1 schema" }
  };
  if (inputSchema.idBlock.hasOwnProperty("tagClass") === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if (inputSchema.idBlock.tagClass !== inputData.idBlock.tagClass) return {
    verified: false,
    result: root
  };
  if (inputSchema.idBlock.hasOwnProperty("tagNumber") === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if (inputSchema.idBlock.tagNumber !== inputData.idBlock.tagNumber) return {
    verified: false,
    result: root
  };
  if (inputSchema.idBlock.hasOwnProperty("isConstructed") === false) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if (inputSchema.idBlock.isConstructed !== inputData.idBlock.isConstructed) return {
    verified: false,
    result: root
  };
  if (!("isHexOnly" in inputSchema.idBlock)) return {
    verified: false,
    result: { error: "Wrong ASN.1 schema" }
  };
  if (inputSchema.idBlock.isHexOnly !== inputData.idBlock.isHexOnly) return {
    verified: false,
    result: root
  };
  if (inputSchema.idBlock.isHexOnly) {
    if ("valueHexView" in inputSchema.idBlock === false) return {
      verified: false,
      result: { error: "Wrong ASN.1 schema" }
    };
    const schemaView = inputSchema.idBlock.valueHexView;
    const asn1View = inputData.idBlock.valueHexView;
    if (schemaView.length !== asn1View.length) return {
      verified: false,
      result: root
    };
    for (let i = 0; i < schemaView.length; i++) if (schemaView[i] !== asn1View[1]) return {
      verified: false,
      result: root
    };
  }
  if (inputSchema.name) {
    inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
    if (inputSchema.name) root[inputSchema.name] = inputData;
  }
  if (inputSchema instanceof typeStore.Constructed) {
    let admission = 0;
    let result = {
      verified: false,
      result: { error: "Unknown error" }
    };
    let maxLength = inputSchema.valueBlock.value.length;
    if (maxLength > 0) {
      if (inputSchema.valueBlock.value[0] instanceof Repeated) maxLength = inputData.valueBlock.value.length;
    }
    if (maxLength === 0) return {
      verified: true,
      result: root
    };
    if (inputData.valueBlock.value.length === 0 && inputSchema.valueBlock.value.length !== 0) {
      let _optional = true;
      for (let i = 0; i < inputSchema.valueBlock.value.length; i++) _optional = _optional && (inputSchema.valueBlock.value[i].optional || false);
      if (_optional) return {
        verified: true,
        result: root
      };
      if (inputSchema.name) {
        inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
        if (inputSchema.name) delete root[inputSchema.name];
      }
      root.error = "Inconsistent object length";
      return {
        verified: false,
        result: root
      };
    }
    for (let i = 0; i < maxLength; i++) if (i - admission >= inputData.valueBlock.value.length) {
      if (inputSchema.valueBlock.value[i].optional === false) {
        const _result = {
          verified: false,
          result: root
        };
        root.error = "Inconsistent length between ASN.1 data and schema";
        if (inputSchema.name) {
          inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
          if (inputSchema.name) {
            delete root[inputSchema.name];
            _result.name = inputSchema.name;
          }
        }
        return _result;
      }
    } else if (inputSchema.valueBlock.value[0] instanceof Repeated) {
      result = compareSchema(root, inputData.valueBlock.value[i], inputSchema.valueBlock.value[0].value);
      if (result.verified === false) {
        if (inputSchema.valueBlock.value[0].optional) admission++;
        else {
          if (inputSchema.name) {
            inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
            if (inputSchema.name) delete root[inputSchema.name];
          }
          return result;
        }
      }
      if ("name" in inputSchema.valueBlock.value[0] && inputSchema.valueBlock.value[0].name.length > 0) {
        let arrayRoot = {};
        if ("local" in inputSchema.valueBlock.value[0] && inputSchema.valueBlock.value[0].local) arrayRoot = inputData;
        else arrayRoot = root;
        if (typeof arrayRoot[inputSchema.valueBlock.value[0].name] === "undefined") arrayRoot[inputSchema.valueBlock.value[0].name] = [];
        arrayRoot[inputSchema.valueBlock.value[0].name].push(inputData.valueBlock.value[i]);
      }
    } else {
      result = compareSchema(root, inputData.valueBlock.value[i - admission], inputSchema.valueBlock.value[i]);
      if (result.verified === false) {
        if (inputSchema.valueBlock.value[i].optional) admission++;
        else {
          if (inputSchema.name) {
            inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
            if (inputSchema.name) delete root[inputSchema.name];
          }
          return result;
        }
      }
    }
    if (result.verified === false) {
      const _result = {
        verified: false,
        result: root
      };
      if (inputSchema.name) {
        inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
        if (inputSchema.name) {
          delete root[inputSchema.name];
          _result.name = inputSchema.name;
        }
      }
      return _result;
    }
    return {
      verified: true,
      result: root
    };
  }
  if (inputSchema.primitiveSchema && "valueHexView" in inputData.valueBlock) {
    const asn1 = localFromBER(inputData.valueBlock.valueHexView);
    if (asn1.offset === -1) {
      const _result = {
        verified: false,
        result: asn1.result
      };
      if (inputSchema.name) {
        inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, "");
        if (inputSchema.name) {
          delete root[inputSchema.name];
          _result.name = inputSchema.name;
        }
      }
      return _result;
    }
    return compareSchema(root, asn1.result, inputSchema.primitiveSchema);
  }
  return {
    verified: true,
    result: root
  };
}
registerBuiltinEncoder({
  BitString,
  Integer,
  OctetString,
  Primitive,
  Constructed,
  Sequence,
  Set: Set2
}, {
  BaseBlock,
  ViewWriter,
  LocalIdentificationBlock,
  LocalLengthBlock,
  LocalIntegerValueBlock,
  LocalOctetStringValueBlock,
  LocalConstructedValueBlock,
  LocalBitStringValueBlock,
  LocalPrimitiveValueBlock,
  originalBaseBlockToBER: ORIGINAL_BASE_BLOCK_TO_BER,
  originalWriterWrite: ORIGINAL_VIEW_WRITER_WRITE,
  originalWriterFinal: ORIGINAL_VIEW_WRITER_FINAL,
  originalIdentificationToBER: ORIGINAL_LOCAL_IDENTIFICATION_TO_BER,
  originalLengthToBER: ORIGINAL_LOCAL_LENGTH_TO_BER,
  originalIntegerToBER: ORIGINAL_LOCAL_INTEGER_TO_BER,
  originalOctetStringToBER: ORIGINAL_LOCAL_OCTET_STRING_TO_BER,
  originalBitStringToBER: ORIGINAL_LOCAL_BIT_STRING_TO_BER,
  originalConstructedToBER: ORIGINAL_LOCAL_CONSTRUCTED_TO_BER,
  originalPrimitiveToBER: ORIGINAL_LOCAL_PRIMITIVE_TO_BER
});
registerFastParser({
  Integer,
  Null,
  Sequence
});

// node_modules/bytestreamjs/build/byte_stream.js
var ByteStream = class ByteStream2 {
  _buffer;
  _view;
  constructor(parameters = {}) {
    if ("view" in parameters) this.fromUint8Array(parameters.view);
    else if ("buffer" in parameters) this.fromArrayBuffer(parameters.buffer);
    else if ("string" in parameters) this.fromString(parameters.string);
    else if ("hexstring" in parameters) this.fromHexString(parameters.hexstring);
    else if ("length" in parameters && parameters.length > 0) {
      this.length = parameters.length;
      if (parameters.stub) for (let i = 0; i < this._view.length; i++) this._view[i] = parameters.stub;
    } else this.length = 0;
  }
  set buffer(value) {
    this._buffer = value;
    this._view = new Uint8Array(this._buffer);
  }
  get buffer() {
    return this._buffer;
  }
  set view(value) {
    this._buffer = new ArrayBuffer(value.length);
    this._view = new Uint8Array(this._buffer);
    this._view.set(value);
  }
  get view() {
    return this._view;
  }
  get length() {
    return this.view.byteLength;
  }
  set length(value) {
    this._buffer = new ArrayBuffer(value);
    this._view = new Uint8Array(this._buffer);
  }
  clear() {
    this._buffer = /* @__PURE__ */ new ArrayBuffer(0);
    this._view = new Uint8Array(this._buffer);
  }
  fromArrayBuffer(array) {
    this._buffer = array;
    this._view = new Uint8Array(this._buffer);
  }
  fromUint8Array(array) {
    this.fromArrayBuffer(new Uint8Array(array).buffer);
  }
  fromString(string) {
    const stringLength = string.length;
    this.length = stringLength;
    for (let i = 0; i < stringLength; i++) this.view[i] = string.charCodeAt(i);
  }
  toString(start = 0, length = this.view.length - start) {
    let result = "";
    if (start >= this.view.length || start < 0) start = 0;
    if (length >= this.view.length || length < 0) length = this.view.length - start;
    for (let i = start; i < start + length; i++) result += String.fromCharCode(this.view[i]);
    return result;
  }
  fromHexString(hexString) {
    const stringLength = hexString.length;
    this.buffer = /* @__PURE__ */ new ArrayBuffer(stringLength >> 1);
    this.view = new Uint8Array(this.buffer);
    const hexMap = /* @__PURE__ */ new Map();
    hexMap.set("0", 0);
    hexMap.set("1", 1);
    hexMap.set("2", 2);
    hexMap.set("3", 3);
    hexMap.set("4", 4);
    hexMap.set("5", 5);
    hexMap.set("6", 6);
    hexMap.set("7", 7);
    hexMap.set("8", 8);
    hexMap.set("9", 9);
    hexMap.set("A", 10);
    hexMap.set("a", 10);
    hexMap.set("B", 11);
    hexMap.set("b", 11);
    hexMap.set("C", 12);
    hexMap.set("c", 12);
    hexMap.set("D", 13);
    hexMap.set("d", 13);
    hexMap.set("E", 14);
    hexMap.set("e", 14);
    hexMap.set("F", 15);
    hexMap.set("f", 15);
    let j = 0;
    let temp = 0;
    for (let i = 0; i < stringLength; i++) if (!(i % 2)) temp = hexMap.get(hexString.charAt(i)) << 4;
    else {
      temp |= hexMap.get(hexString.charAt(i));
      this.view[j] = temp;
      j++;
    }
  }
  toHexString(start = 0, length = this.view.length - start) {
    let result = "";
    if (start >= this.view.length || start < 0) start = 0;
    if (length >= this.view.length || length < 0) length = this.view.length - start;
    for (let i = start; i < start + length; i++) {
      const str = this.view[i].toString(16).toUpperCase();
      result = result + (str.length == 1 ? "0" : "") + str;
    }
    return result;
  }
  copy(start = 0, length = this.length - start) {
    if (!start && !this.length) return new ByteStream2();
    if (start < 0 || start > this.length - 1) throw new Error(`Wrong start position: ${start}`);
    return new ByteStream2({ buffer: this._buffer.slice(start, start + length) });
  }
  slice(start = 0, end = this.length) {
    if (!start && !this.length) return new ByteStream2();
    if (start < 0 || start > this.length - 1) throw new Error(`Wrong start position: ${start}`);
    return new ByteStream2({ buffer: this._buffer.slice(start, end) });
  }
  realloc(size) {
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    if (size > this._view.length) view.set(this._view);
    else view.set(new Uint8Array(this._buffer, 0, size));
    this._buffer = buffer;
    this._view = new Uint8Array(this._buffer);
  }
  append(stream) {
    const initialSize = this.length;
    const streamViewLength = stream.length;
    const subarrayView = stream._view.subarray();
    this.realloc(initialSize + streamViewLength);
    this._view.set(subarrayView, initialSize);
  }
  insert(stream, start = 0, length = this.length - start) {
    if (start > this.length - 1) return false;
    if (length > this.length - start) length = this.length - start;
    if (length > stream.length) length = stream.length;
    if (length == stream.length) this._view.set(stream._view, start);
    else this._view.set(stream._view.subarray(0, length), start);
    return true;
  }
  isEqual(stream) {
    if (this.length != stream.length) return false;
    for (let i = 0; i < stream.length; i++) if (this.view[i] != stream.view[i]) return false;
    return true;
  }
  isEqualView(view) {
    if (view.length != this.view.length) return false;
    for (let i = 0; i < view.length; i++) if (this.view[i] != view[i]) return false;
    return true;
  }
  findPattern(pattern, start_, length_, backward_) {
    const { start, length, backward } = this.prepareFindParameters(start_, length_, backward_);
    const patternLength = pattern.length;
    if (patternLength > length) return -1;
    const patternArray = [];
    for (let i = 0; i < patternLength; i++) patternArray.push(pattern.view[i]);
    for (let i = 0; i <= length - patternLength; i++) {
      let equal2 = true;
      const equalStart = backward ? start - patternLength - i : start + i;
      for (let j = 0; j < patternLength; j++) if (this.view[j + equalStart] != patternArray[j]) {
        equal2 = false;
        break;
      }
      if (equal2) return backward ? start - patternLength - i : start + patternLength + i;
    }
    return -1;
  }
  findFirstIn(patterns, start_, length_, backward_) {
    const { start, length, backward } = this.prepareFindParameters(start_, length_, backward_);
    const result = {
      id: -1,
      position: backward ? 0 : start + length,
      length: 0
    };
    for (let i = 0; i < patterns.length; i++) {
      const position = this.findPattern(patterns[i], start, length, backward);
      if (position != -1) {
        let valid = false;
        const patternLength = patterns[i].length;
        if (backward) {
          if (position - patternLength >= result.position - result.length) valid = true;
        } else if (position - patternLength <= result.position - result.length) valid = true;
        if (valid) {
          result.position = position;
          result.id = i;
          result.length = patternLength;
        }
      }
    }
    return result;
  }
  findAllIn(patterns, start_, length_) {
    let { start, length } = this.prepareFindParameters(start_, length_);
    const result = [];
    let patternFound = {
      id: -1,
      position: start
    };
    do {
      const position = patternFound.position;
      patternFound = this.findFirstIn(patterns, patternFound.position, length);
      if (patternFound.id == -1) break;
      length -= patternFound.position - position;
      result.push({
        id: patternFound.id,
        position: patternFound.position
      });
    } while (true);
    return result;
  }
  findAllPatternIn(pattern, start_, length_) {
    const { start, length } = this.prepareFindParameters(start_, length_);
    const result = [];
    const patternLength = pattern.length;
    if (patternLength > length) return -1;
    const patternArray = Array.from(pattern.view);
    for (let i = 0; i <= length - patternLength; i++) {
      let equal2 = true;
      const equalStart = start + i;
      for (let j = 0; j < patternLength; j++) if (this.view[j + equalStart] != patternArray[j]) {
        equal2 = false;
        break;
      }
      if (equal2) {
        result.push(start + patternLength + i);
        i += patternLength - 1;
      }
    }
    return result;
  }
  findFirstNotIn(patterns, start_, length_, backward_) {
    let { start, length, backward } = this.prepareFindParameters(start_, length_, backward_);
    const result = {
      left: {
        id: -1,
        position: start
      },
      right: {
        id: -1,
        position: 0
      },
      value: new ByteStream2()
    };
    let currentLength = length;
    while (currentLength > 0) {
      result.right = this.findFirstIn(patterns, backward ? start - length + currentLength : start + length - currentLength, currentLength, backward);
      if (result.right.id == -1) {
        length = currentLength;
        if (backward) start -= length;
        else start = result.left.position;
        result.value = new ByteStream2({ buffer: this._buffer.slice(start, start + length) });
        break;
      }
      if (result.right.position != (backward ? result.left.position - patterns[result.right.id].length : result.left.position + patterns[result.right.id].length)) {
        if (backward) {
          start = result.right.position + patterns[result.right.id].length;
          length = result.left.position - result.right.position - patterns[result.right.id].length;
        } else {
          start = result.left.position;
          length = result.right.position - result.left.position - patterns[result.right.id].length;
        }
        result.value = new ByteStream2({ buffer: this._buffer.slice(start, start + length) });
        break;
      }
      result.left = result.right;
      currentLength -= patterns[result.right.id].length;
    }
    if (backward) {
      const temp = result.right;
      result.right = result.left;
      result.left = temp;
    }
    return result;
  }
  findAllNotIn(patterns, start_, length_) {
    let { start, length } = this.prepareFindParameters(start_, length_);
    const result = [];
    let patternFound = {
      left: {
        id: -1,
        position: start
      },
      right: {
        id: -1,
        position: start
      },
      value: new ByteStream2()
    };
    do {
      const position = patternFound.right.position;
      patternFound = this.findFirstNotIn(patterns, patternFound.right.position, length);
      length -= patternFound.right.position - position;
      result.push({
        left: {
          id: patternFound.left.id,
          position: patternFound.left.position
        },
        right: {
          id: patternFound.right.id,
          position: patternFound.right.position
        },
        value: patternFound.value
      });
    } while (patternFound.right.id != -1);
    return result;
  }
  findFirstSequence(patterns, start_, length_, backward_) {
    let { start, length, backward } = this.prepareFindParameters(start_, length_, backward_);
    const firstIn = this.skipNotPatterns(patterns, start, length, backward);
    if (firstIn == -1) return {
      position: -1,
      value: new ByteStream2()
    };
    const firstNotIn = this.skipPatterns(patterns, firstIn, length - (backward ? start - firstIn : firstIn - start), backward);
    if (backward) {
      start = firstNotIn;
      length = firstIn - firstNotIn;
    } else {
      start = firstIn;
      length = firstNotIn - firstIn;
    }
    return {
      position: firstNotIn,
      value: new ByteStream2({ buffer: this._buffer.slice(start, start + length) })
    };
  }
  findAllSequences(patterns, start_, length_) {
    let { start, length } = this.prepareFindParameters(start_, length_);
    const result = [];
    let patternFound = {
      position: start,
      value: new ByteStream2()
    };
    do {
      const position = patternFound.position;
      patternFound = this.findFirstSequence(patterns, patternFound.position, length);
      if (patternFound.position != -1) {
        length -= patternFound.position - position;
        result.push({
          position: patternFound.position,
          value: patternFound.value
        });
      }
    } while (patternFound.position != -1);
    return result;
  }
  findPairedPatterns(leftPattern, rightPattern, start_, length_) {
    const result = [];
    if (leftPattern.isEqual(rightPattern)) return result;
    const { start, length } = this.prepareFindParameters(start_, length_);
    let currentPositionLeft = 0;
    const leftPatterns = this.findAllPatternIn(leftPattern, start, length);
    if (!Array.isArray(leftPatterns) || leftPatterns.length == 0) return result;
    const rightPatterns = this.findAllPatternIn(rightPattern, start, length);
    if (!Array.isArray(rightPatterns) || rightPatterns.length == 0) return result;
    while (currentPositionLeft < leftPatterns.length) {
      if (rightPatterns.length == 0) break;
      if (leftPatterns[0] == rightPatterns[0]) {
        result.push({
          left: leftPatterns[0],
          right: rightPatterns[0]
        });
        leftPatterns.splice(0, 1);
        rightPatterns.splice(0, 1);
        continue;
      }
      if (leftPatterns[currentPositionLeft] > rightPatterns[0]) break;
      while (leftPatterns[currentPositionLeft] < rightPatterns[0]) {
        currentPositionLeft++;
        if (currentPositionLeft >= leftPatterns.length) break;
      }
      result.push({
        left: leftPatterns[currentPositionLeft - 1],
        right: rightPatterns[0]
      });
      leftPatterns.splice(currentPositionLeft - 1, 1);
      rightPatterns.splice(0, 1);
      currentPositionLeft = 0;
    }
    result.sort((a, b) => a.left - b.left);
    return result;
  }
  findPairedArrays(inputLeftPatterns, inputRightPatterns, start_, length_) {
    const { start, length } = this.prepareFindParameters(start_, length_);
    const result = [];
    let currentPositionLeft = 0;
    const leftPatterns = this.findAllIn(inputLeftPatterns, start, length);
    if (leftPatterns.length == 0) return result;
    const rightPatterns = this.findAllIn(inputRightPatterns, start, length);
    if (rightPatterns.length == 0) return result;
    while (currentPositionLeft < leftPatterns.length) {
      if (rightPatterns.length == 0) break;
      if (leftPatterns[0].position == rightPatterns[0].position) {
        result.push({
          left: leftPatterns[0],
          right: rightPatterns[0]
        });
        leftPatterns.splice(0, 1);
        rightPatterns.splice(0, 1);
        continue;
      }
      if (leftPatterns[currentPositionLeft].position > rightPatterns[0].position) break;
      while (leftPatterns[currentPositionLeft].position < rightPatterns[0].position) {
        currentPositionLeft++;
        if (currentPositionLeft >= leftPatterns.length) break;
      }
      result.push({
        left: leftPatterns[currentPositionLeft - 1],
        right: rightPatterns[0]
      });
      leftPatterns.splice(currentPositionLeft - 1, 1);
      rightPatterns.splice(0, 1);
      currentPositionLeft = 0;
    }
    result.sort((a, b) => a.left.position - b.left.position);
    return result;
  }
  replacePattern(searchPattern, replacePattern, start_, length_, findAllResult = null) {
    let result = [];
    let i;
    const output = {
      status: -1,
      searchPatternPositions: [],
      replacePatternPositions: []
    };
    const { start, length } = this.prepareFindParameters(start_, length_);
    if (findAllResult == null) {
      result = this.findAllIn([searchPattern], start, length);
      if (result.length == 0) return output;
    } else result = findAllResult;
    output.searchPatternPositions.push(...Array.from(result, (element) => element.position));
    const patternDifference = searchPattern.length - replacePattern.length;
    const changedBuffer = new ArrayBuffer(this.view.length - result.length * patternDifference);
    const changedView = new Uint8Array(changedBuffer);
    changedView.set(new Uint8Array(this.buffer, 0, start));
    for (i = 0; i < result.length; i++) {
      const currentPosition = i == 0 ? start : result[i - 1].position;
      changedView.set(new Uint8Array(this.buffer, currentPosition, result[i].position - searchPattern.length - currentPosition), currentPosition - i * patternDifference);
      changedView.set(replacePattern.view, result[i].position - searchPattern.length - i * patternDifference);
      output.replacePatternPositions.push(result[i].position - searchPattern.length - i * patternDifference);
    }
    i--;
    changedView.set(new Uint8Array(this.buffer, result[i].position, this.length - result[i].position), result[i].position - searchPattern.length + replacePattern.length - i * patternDifference);
    this.buffer = changedBuffer;
    this.view = new Uint8Array(this.buffer);
    output.status = 1;
    return output;
  }
  skipPatterns(patterns, start_, length_, backward_) {
    const { start, length, backward } = this.prepareFindParameters(start_, length_, backward_);
    let result = start;
    for (let k = 0; k < patterns.length; k++) {
      const patternLength = patterns[k].length;
      const equalStart = backward ? result - patternLength : result;
      let equal2 = true;
      for (let j = 0; j < patternLength; j++) if (this.view[j + equalStart] != patterns[k].view[j]) {
        equal2 = false;
        break;
      }
      if (equal2) {
        k = -1;
        if (backward) {
          result -= patternLength;
          if (result <= 0) return result;
        } else {
          result += patternLength;
          if (result >= start + length) return result;
        }
      }
    }
    return result;
  }
  skipNotPatterns(patterns, start_, length_, backward_) {
    const { start, length, backward } = this.prepareFindParameters(start_, length_, backward_);
    let result = -1;
    for (let i = 0; i < length; i++) {
      for (let k = 0; k < patterns.length; k++) {
        const patternLength = patterns[k].length;
        const equalStart = backward ? start - i - patternLength : start + i;
        let equal2 = true;
        for (let j = 0; j < patternLength; j++) if (this.view[j + equalStart] != patterns[k].view[j]) {
          equal2 = false;
          break;
        }
        if (equal2) {
          result = backward ? start - i : start + i;
          break;
        }
      }
      if (result != -1) break;
    }
    return result;
  }
  prepareFindParameters(start = null, length = null, backward = false) {
    if (start === null) start = backward ? this.length : 0;
    if (start > this.length) start = this.length;
    if (backward) {
      if (length === null) length = start;
      if (length > start) length = start;
    } else {
      if (length === null) length = this.length - start;
      if (length > this.length - start) length = this.length - start;
    }
    return {
      start,
      length,
      backward
    };
  }
};

// node_modules/bytestreamjs/build/seq_stream.js
var pow2_24 = 16777216;
var SeqStream = class SeqStream2 {
  static APPEND_BLOCK = 1e3;
  _stream = new ByteStream();
  _length = 0;
  _start = 0;
  backward = false;
  appendBlock = 0;
  prevLength = 0;
  prevStart = 0;
  constructor(parameters = {}) {
    if ("view" in parameters) this.stream = new ByteStream({ view: parameters.view });
    else if ("buffer" in parameters) this.stream = new ByteStream({ buffer: parameters.buffer });
    else if ("string" in parameters) this.stream = new ByteStream({ string: parameters.string });
    else if ("hexstring" in parameters) this.stream = new ByteStream({ hexstring: parameters.hexstring });
    else if ("stream" in parameters) this.stream = parameters.stream.slice();
    else this.stream = new ByteStream();
    if ("backward" in parameters && parameters.backward) {
      this.backward = parameters.backward;
      this._start = this.stream.length;
    }
    if ("length" in parameters && parameters.length > 0) this._length = parameters.length;
    if ("start" in parameters && parameters.start && parameters.start > 0) this._start = parameters.start;
    if ("appendBlock" in parameters && parameters.appendBlock && parameters.appendBlock > 0) this.appendBlock = parameters.appendBlock;
  }
  set stream(value) {
    this._stream = value;
    this.prevLength = this._length;
    this._length = value.length;
    this.prevStart = this._start;
    this._start = 0;
  }
  get stream() {
    return this._stream;
  }
  set length(value) {
    this.prevLength = this._length;
    this._length = value;
  }
  get length() {
    if (this.appendBlock) return this.start;
    return this._length;
  }
  set start(value) {
    if (value > this.stream.length) return;
    this.prevStart = this._start;
    this.prevLength = this._length;
    this._length -= this.backward ? this._start - value : value - this._start;
    this._start = value;
  }
  get start() {
    return this._start;
  }
  get buffer() {
    return this._stream.buffer.slice(0, this._length);
  }
  resetPosition() {
    this._start = this.prevStart;
    this._length = this.prevLength;
  }
  findPattern(pattern, gap = null) {
    if (gap == null || gap > this.length) gap = this.length;
    const result = this.stream.findPattern(pattern, this.start, this.length, this.backward);
    if (result == -1) return result;
    if (this.backward) {
      if (result < this.start - pattern.length - gap) return -1;
    } else if (result > this.start + pattern.length + gap) return -1;
    this.start = result;
    return result;
  }
  findFirstIn(patterns, gap = null) {
    if (gap == null || gap > this.length) gap = this.length;
    const result = this.stream.findFirstIn(patterns, this.start, this.length, this.backward);
    if (result.id == -1) return result;
    if (this.backward) {
      if (result.position < this.start - patterns[result.id].length - gap) return {
        id: -1,
        position: this.backward ? 0 : this.start + this.length
      };
    } else if (result.position > this.start + patterns[result.id].length + gap) return {
      id: -1,
      position: this.backward ? 0 : this.start + this.length
    };
    this.start = result.position;
    return result;
  }
  findAllIn(patterns) {
    const start = this.backward ? this.start - this.length : this.start;
    return this.stream.findAllIn(patterns, start, this.length);
  }
  findFirstNotIn(patterns, gap = null) {
    if (gap == null || gap > this._length) gap = this._length;
    const result = this._stream.findFirstNotIn(patterns, this._start, this._length, this.backward);
    if (result.left.id == -1 && result.right.id == -1) return result;
    if (this.backward) {
      if (result.right.id != -1) {
        if (result.right.position < this._start - patterns[result.right.id].length - gap) return {
          left: {
            id: -1,
            position: this._start
          },
          right: {
            id: -1,
            position: 0
          },
          value: new ByteStream()
        };
      }
    } else if (result.left.id != -1) {
      if (result.left.position > this._start + patterns[result.left.id].length + gap) return {
        left: {
          id: -1,
          position: this._start
        },
        right: {
          id: -1,
          position: 0
        },
        value: new ByteStream()
      };
    }
    if (this.backward) {
      if (result.left.id == -1) this.start = 0;
      else this.start = result.left.position;
    } else if (result.right.id == -1) this.start = this._start + this._length;
    else this.start = result.right.position;
    return result;
  }
  findAllNotIn(patterns) {
    const start = this.backward ? this._start - this._length : this._start;
    return this._stream.findAllNotIn(patterns, start, this._length);
  }
  findFirstSequence(patterns, length = null, gap = null) {
    if (length == null || length > this._length) length = this._length;
    if (gap == null || gap > length) gap = length;
    const result = this._stream.findFirstSequence(patterns, this._start, length, this.backward);
    if (result.value.length == 0) return result;
    if (this.backward) {
      if (result.position < this._start - result.value.length - gap) return {
        position: -1,
        value: new ByteStream()
      };
    } else if (result.position > this._start + result.value.length + gap) return {
      position: -1,
      value: new ByteStream()
    };
    this.start = result.position;
    return result;
  }
  findAllSequences(patterns) {
    const start = this.backward ? this.start - this.length : this.start;
    return this.stream.findAllSequences(patterns, start, this.length);
  }
  findPairedPatterns(leftPattern, rightPattern, gap = null) {
    if (gap == null || gap > this.length) gap = this.length;
    const start = this.backward ? this.start - this.length : this.start;
    const result = this.stream.findPairedPatterns(leftPattern, rightPattern, start, this.length);
    if (result.length) {
      if (this.backward) {
        if (result[0].right < this.start - rightPattern.length - gap) return [];
      } else if (result[0].left > this.start + leftPattern.length + gap) return [];
    }
    return result;
  }
  findPairedArrays(leftPatterns, rightPatterns, gap = null) {
    if (gap == null || gap > this.length) gap = this.length;
    const start = this.backward ? this.start - this.length : this.start;
    const result = this.stream.findPairedArrays(leftPatterns, rightPatterns, start, this.length);
    if (result.length) {
      if (this.backward) {
        if (result[0].right.position < this.start - rightPatterns[result[0].right.id].length - gap) return [];
      } else if (result[0].left.position > this.start + leftPatterns[result[0].left.id].length + gap) return [];
    }
    return result;
  }
  replacePattern(searchPattern, replacePattern) {
    const start = this.backward ? this.start - this.length : this.start;
    return this.stream.replacePattern(searchPattern, replacePattern, start, this.length);
  }
  skipPatterns(patterns) {
    const result = this.stream.skipPatterns(patterns, this.start, this.length, this.backward);
    this.start = result;
    return result;
  }
  skipNotPatterns(patterns) {
    const result = this.stream.skipNotPatterns(patterns, this.start, this.length, this.backward);
    if (result == -1) return -1;
    this.start = result;
    return result;
  }
  append(stream) {
    this.beforeAppend(stream.length);
    this._stream.view.set(stream.view, this._start);
    this._length += stream.length * 2;
    this.start = this._start + stream.length;
    this.prevLength -= stream.length * 2;
  }
  appendView(view) {
    this.beforeAppend(view.length);
    this._stream.view.set(view, this._start);
    this._length += view.length * 2;
    this.start = this._start + view.length;
    this.prevLength -= view.length * 2;
  }
  appendChar(char) {
    this.beforeAppend(1);
    this._stream.view[this._start] = char;
    this._length += 2;
    this.start = this._start + 1;
    this.prevLength -= 2;
  }
  appendUint16(number) {
    this.beforeAppend(2);
    const value = new Uint16Array([number]);
    const view = new Uint8Array(value.buffer);
    this.stream.view[this._start] = view[1];
    this._stream.view[this._start + 1] = view[0];
    this._length += 4;
    this.start = this._start + 2;
    this.prevLength -= 4;
  }
  appendUint24(number) {
    this.beforeAppend(3);
    const value = new Uint32Array([number]);
    const view = new Uint8Array(value.buffer);
    this._stream.view[this._start] = view[2];
    this._stream.view[this._start + 1] = view[1];
    this._stream.view[this._start + 2] = view[0];
    this._length += 6;
    this.start = this._start + 3;
    this.prevLength -= 6;
  }
  appendUint32(number) {
    this.beforeAppend(4);
    const value = new Uint32Array([number]);
    const view = new Uint8Array(value.buffer);
    this._stream.view[this._start] = view[3];
    this._stream.view[this._start + 1] = view[2];
    this._stream.view[this._start + 2] = view[1];
    this._stream.view[this._start + 3] = view[0];
    this._length += 8;
    this.start = this._start + 4;
    this.prevLength -= 8;
  }
  appendInt16(number) {
    this.beforeAppend(2);
    const value = new Int16Array([number]);
    const view = new Uint8Array(value.buffer);
    this._stream.view[this._start] = view[1];
    this._stream.view[this._start + 1] = view[0];
    this._length += 4;
    this.start = this._start + 2;
    this.prevLength -= 4;
  }
  appendInt32(number) {
    this.beforeAppend(4);
    const value = new Int32Array([number]);
    const view = new Uint8Array(value.buffer);
    this._stream.view[this._start] = view[3];
    this._stream.view[this._start + 1] = view[2];
    this._stream.view[this._start + 2] = view[1];
    this._stream.view[this._start + 3] = view[0];
    this._length += 8;
    this.start = this._start + 4;
    this.prevLength -= 8;
  }
  getBlock(size, changeLength = true) {
    if (this._length <= 0) return /* @__PURE__ */ new Uint8Array(0);
    if (this._length < size) size = this._length;
    let result;
    if (this.backward) {
      const view = this._stream.view.subarray(this._length - size, this._length);
      result = new Uint8Array(size);
      for (let i = 0; i < size; i++) result[size - 1 - i] = view[i];
    } else result = this._stream.view.subarray(this._start, this._start + size);
    if (changeLength) this.start += this.backward ? -1 * size : size;
    return result;
  }
  getUint16(changeLength = true) {
    const block = this.getBlock(2, changeLength);
    if (block.length < 2) return 0;
    return block[0] << 8 | block[1];
  }
  getInt16(changeLength = true) {
    const num = this.getUint16(changeLength);
    const negative = 32768;
    if (num & negative) return -(negative - (num ^ negative));
    return num;
  }
  getUint24(changeLength = true) {
    const block = this.getBlock(4, changeLength);
    if (block.length < 3) return 0;
    return block[0] << 16 | block[1] << 8 | block[2];
  }
  getUint32(changeLength = true) {
    const block = this.getBlock(4, changeLength);
    if (block.length < 4) return 0;
    return block[0] * pow2_24 + (block[1] << 16) + (block[2] << 8) + block[3];
  }
  getInt32(changeLength = true) {
    const num = this.getUint32(changeLength);
    const negative = 2147483648;
    if (num & negative) return -(negative - (num ^ negative));
    return num;
  }
  beforeAppend(size) {
    if (this._start + size > this._stream.length) {
      if (size > this.appendBlock) this.appendBlock = size + SeqStream2.APPEND_BLOCK;
      this._stream.realloc(this._stream.length + this.appendBlock);
    }
  }
};

// node_modules/@noble/hashes/_u64.js
var U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h: h2, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h2, l];
  }
  return [Ah, Al];
}
var fromNumH = (n) => n / 2 ** 32 | 0;
var fromNumL = (n) => n >>> 0;
function setU64FromNum(view, byteOffset, n, isLE) {
  const h2 = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE ? l : h2, isLE);
  view.setUint32(byteOffset + 4, isLE ? h2 : l, isLE);
}
var shrSH = (h2, _l, s) => h2 >>> s;
var shrSL = (h2, l, s) => h2 << 32 - s | l >>> s;
var rotrSH = (h2, l, s) => h2 >>> s | l << 32 - s;
var rotrSL = (h2, l, s) => h2 << 32 - s | l >>> s;
var rotrBH = (h2, l, s) => h2 << 64 - s | l >>> s - 32;
var rotrBL = (h2, l, s) => h2 >>> s - 32 | l << 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle = (title) => title ? `"${title}" ` : "";
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes(value, length, title = "") {
  if (isBytes(value) && (length === void 0 || value.length === length))
    return value;
  if (length !== void 0)
    anumber(length, "length");
  const bytes = isBytes(value);
  const ofLen = length !== void 0 ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
var aobject = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
};
var aopts = (value, label) => {
  aobject(value, label);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`"${label}" expected plain object`);
  if (Object.hasOwn(value, "__proto__"))
    throw new TypeError(`"${label}.__proto__" is not allowed`);
};
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function rotl(word, shift) {
  return word << shift | word >>> 32 - shift >>> 0;
}
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== void 0)
    aopts(opts, title);
  const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    let processed = false;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        processed = true;
        continue;
      }
      buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
        processed = true;
      }
    }
    this.length += data.length;
    if (processed)
      this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    buffer.fill(0, pos);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      buffer.fill(0);
    }
    setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
    this.process(view, 0);
    this.roundClean();
    const oview = out === buffer ? view : createView(out);
    const len = this.outputLen;
    const outLen = len / 4;
    const state = this.get();
    if (len % 4 || outLen > state.length)
      throw new Error("invalid outputLen");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneIntoMeta(to) {
    const { buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (pos)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA384_IV = /* @__PURE__ */ Uint32Array.from([
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
]);
var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);

// node_modules/@noble/hashes/legacy.js
var SHA1_IV = /* @__PURE__ */ Uint32Array.from([
  1732584193,
  4023233417,
  2562383102,
  271733878,
  3285377520
]);
var SHA1_W = /* @__PURE__ */ new Uint32Array(80);
var _SHA1 = class extends HashMD {
  A = SHA1_IV[0] | 0;
  B = SHA1_IV[1] | 0;
  C = SHA1_IV[2] | 0;
  D = SHA1_IV[3] | 0;
  E = SHA1_IV[4] | 0;
  constructor() {
    super(64, 20, 8, false);
  }
  get() {
    const { A, B, C, D, E } = this;
    return [A, B, C, D, E];
  }
  set(A, B, C, D, E) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor()).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA1_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 80; i++)
      SHA1_W[i] = rotl(SHA1_W[i - 3] ^ SHA1_W[i - 8] ^ SHA1_W[i - 14] ^ SHA1_W[i - 16], 1);
    let { A, B, C, D, E } = this;
    for (let i = 0; i < 80; i++) {
      let F, K;
      if (i < 20) {
        F = Chi(B, C, D);
        K = 1518500249;
      } else if (i < 40) {
        F = B ^ C ^ D;
        K = 1859775393;
      } else if (i < 60) {
        F = Maj(B, C, D);
        K = 2400959708;
      } else {
        F = B ^ C ^ D;
        K = 3395469782;
      }
      const T = rotl(A, 5) + F + E + K + SHA1_W[i] | 0;
      E = D;
      D = C;
      C = rotl(B, 30);
      B = A;
      A = T;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    this.set(A, B, C, D, E);
  }
  roundClean() {
    clean(SHA1_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var sha1 = /* @__PURE__ */ createHasher(() => new _SHA1());

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  // Numeric initializers matter: starting the fields as `undefined` changes
  // V8's field representation and makes sha256 3x slower (measured).
  A = 0;
  B = 0;
  C = 0;
  D = 0;
  E = 0;
  F = 0;
  G = 0;
  H = 0;
  constructor(outputLen, IV) {
    super(64, outputLen, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor()).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  constructor() {
    super(32, SHA256_IV);
  }
};
var K512 = /* @__PURE__ */ (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
var SHA2_64B = class extends HashMD {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  // h -- high 32 bits, l -- low 32 bits
  // Numeric initializers matter: starting the fields as `undefined` changes
  // V8's field representation and slows hashing down (measured on sha256).
  Ah = 0;
  Al = 0;
  Bh = 0;
  Bl = 0;
  Ch = 0;
  Cl = 0;
  Dh = 0;
  Dl = 0;
  Eh = 0;
  El = 0;
  Fh = 0;
  Fl = 0;
  Gh = 0;
  Gl = 0;
  Hh = 0;
  Hl = 0;
  constructor(outputLen, IV) {
    super(128, outputLen, 16, false);
    this.Ah = IV[0] | 0;
    this.Al = IV[1] | 0;
    this.Bh = IV[2] | 0;
    this.Bl = IV[3] | 0;
    this.Ch = IV[4] | 0;
    this.Cl = IV[5] | 0;
    this.Dh = IV[6] | 0;
    this.Dl = IV[7] | 0;
    this.Eh = IV[8] | 0;
    this.El = IV[9] | 0;
    this.Fh = IV[10] | 0;
    this.Fl = IV[11] | 0;
    this.Gh = IV[12] | 0;
    this.Gl = IV[13] | 0;
    this.Hh = IV[14] | 0;
    this.Hl = IV[15] | 0;
  }
  // prettier-ignore
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor()).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset += 4);
    }
    for (let i = 16; i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0; i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L(T1l, sigma0l, MAJl);
      Ah = add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    this.destroyed = true;
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var _SHA512 = class extends SHA2_64B {
  constructor() {
    super(64, SHA512_IV);
  }
};
var _SHA384 = class extends SHA2_64B {
  constructor() {
    super(48, SHA384_IV);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);
var sha512 = /* @__PURE__ */ createHasher(
  () => new _SHA512(),
  /* @__PURE__ */ oidNist(3)
);
var sha384 = /* @__PURE__ */ createHasher(
  () => new _SHA384(),
  /* @__PURE__ */ oidNist(2)
);

// node_modules/pkijs/build/index.js
var EMPTY_BUFFER2 = /* @__PURE__ */ new ArrayBuffer(0);
var ArgumentError = class ArgumentError2 extends TypeError {
  constructor(..._args) {
    super(..._args);
    this.name = ArgumentError2.NAME;
  }
  static {
    this.NAME = "ArgumentError";
  }
  static isType(value, type) {
    if (typeof type === "string") {
      if (type === "Array" && Array.isArray(value)) return true;
      else if (type === "ArrayBuffer" && value instanceof ArrayBuffer) return true;
      else if (type === "ArrayBufferView" && ArrayBuffer.isView(value)) return true;
      else if (typeof value === type) return true;
    } else if (value instanceof type) return true;
    return false;
  }
  static assert(value, name, ...types) {
    for (const type of types) if (this.isType(value, type)) return;
    const typeNames = types.map((o) => o instanceof Function && "name" in o ? o.name : `${o}`);
    throw new ArgumentError2(`Parameter '${name}' is not of type ${typeNames.length > 1 ? `(${typeNames.join(" or ")})` : typeNames[0]}`);
  }
};
var ParameterError = class ParameterError2 extends TypeError {
  static {
    this.NAME = "ParameterError";
  }
  static assert(...args) {
    let target = null;
    let params;
    let fields;
    if (typeof args[0] === "string") {
      target = args[0];
      params = args[1];
      fields = args.slice(2);
    } else {
      params = args[0];
      fields = args.slice(1);
    }
    ArgumentError.assert(params, "parameters", "object");
    for (const field of fields) {
      const value = params[field];
      if (value === void 0 || value === null) throw new ParameterError2(field, target);
    }
  }
  static assertEmpty(value, name, target) {
    if (value === void 0 || value === null) throw new ParameterError2(name, target);
  }
  constructor(field, target = null, message) {
    super();
    this.name = ParameterError2.NAME;
    this.field = field;
    if (target) this.target = target;
    if (message) this.message = message;
    else this.message = `Absent mandatory parameter '${field}' ${target ? ` in '${target}'` : ""}`;
  }
};
var AsnError = class AsnError2 extends Error {
  static assertSchema(asn1, target) {
    if (!asn1.verified) throw new Error(`Object's schema was not verified against input data for ${target}`);
  }
  static assert(asn, target) {
    if (asn.offset === -1) throw new AsnError2(`Error during parsing of ASN.1 data. Data is not correct for '${target}'.`);
  }
  constructor(message) {
    super(message);
    this.name = "AsnError";
  }
};
var PkiObject = class {
  static {
    this.CLASS_NAME = "PkiObject";
  }
  static blockName() {
    return this.CLASS_NAME;
  }
  static fromBER(raw) {
    const asn1 = fromBER(raw);
    AsnError.assert(asn1, this.name);
    try {
      return new this({ schema: asn1.result });
    } catch (e) {
      throw new AsnError(`Cannot create '${this.CLASS_NAME}' from ASN.1 object`);
    }
  }
  static defaultValues(memberName) {
    throw new Error(`Invalid member name for ${this.CLASS_NAME} class: ${memberName}`);
  }
  static schema(parameters = {}) {
    throw new Error(`Method '${this.CLASS_NAME}.schema' should be overridden`);
  }
  get className() {
    return this.constructor.CLASS_NAME;
  }
  toString(encoding = "hex") {
    let schema;
    try {
      schema = this.toSchema();
    } catch {
      schema = this.toSchema(true);
    }
    const ber = schema.toBER();
    switch (encoding.toLowerCase()) {
      case "hex":
        return hex_exports.encode(ber);
      case "base64":
        return base64_exports.encode(ber);
      case "base64url":
        return base64url_exports.encode(ber);
      default:
        throw new Error(`Unknown type of encoding '${encoding}'`);
    }
  }
};
function stringPrep(inputString) {
  let isSpace = false;
  let cutResult = "";
  const result = inputString.trim();
  for (let i = 0; i < result.length; i++) if (result.charCodeAt(i) === 32) {
    if (isSpace === false) isSpace = true;
  } else {
    if (isSpace) {
      cutResult += " ";
      isSpace = false;
    }
    cutResult += result[i];
  }
  return cutResult.toLowerCase();
}
var TYPE$5 = "type";
var VALUE$6 = "value";
var AttributeTypeAndValue = class AttributeTypeAndValue2 extends PkiObject {
  static {
    this.CLASS_NAME = "AttributeTypeAndValue";
  }
  constructor(parameters = {}) {
    super();
    this.type = parameters[TYPE$5] ?? AttributeTypeAndValue2.defaultValues(TYPE$5);
    this.value = parameters[VALUE$6] ?? AttributeTypeAndValue2.defaultValues(VALUE$6);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TYPE$5:
        return "";
      case VALUE$6:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.type || "" }), new Any({ name: names.value || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of [TYPE$5, "typeValue"]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AttributeTypeAndValue2.schema({ names: {
      type: TYPE$5,
      value: "typeValue"
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.type = asn1.result.type.valueBlock.toString();
    this.value = asn1.result.typeValue;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.type }), this.value] });
  }
  toJSON() {
    const _object = { type: this.type };
    if (Object.keys(this.value).length !== 0) _object.value = this.value.toJSON();
    else _object.value = this.value;
    return _object;
  }
  isEqual(compareTo) {
    const stringBlockNames = [
      Utf8String.blockName(),
      BmpString.blockName(),
      UniversalString.blockName(),
      NumericString.blockName(),
      PrintableString.blockName(),
      TeletexString.blockName(),
      VideotexString.blockName(),
      IA5String.blockName(),
      GraphicString.blockName(),
      VisibleString.blockName(),
      GeneralString.blockName(),
      CharacterString.blockName()
    ];
    if (compareTo instanceof ArrayBuffer) return bytes_exports.equal(this.value.valueBeforeDecodeView, compareTo);
    if (compareTo.constructor.blockName() === AttributeTypeAndValue2.blockName()) {
      if (this.type !== compareTo.type) return false;
      const isStringPair = [false, false];
      const thisName = this.value.constructor.blockName();
      for (const name of stringBlockNames) {
        if (thisName === name) isStringPair[0] = true;
        if (compareTo.value.constructor.blockName() === name) isStringPair[1] = true;
      }
      if (isStringPair[0] !== isStringPair[1]) return false;
      if (isStringPair[0] && isStringPair[1]) {
        const value1 = stringPrep(this.value.valueBlock.value);
        const value2 = stringPrep(compareTo.value.valueBlock.value);
        if (value1.localeCompare(value2) !== 0) return false;
      } else if (!bytes_exports.equal(this.value.valueBeforeDecodeView, compareTo.value.valueBeforeDecodeView)) return false;
      return true;
    }
    return false;
  }
};
var TYPE_AND_VALUES = "typesAndValues";
var VALUE_BEFORE_DECODE = "valueBeforeDecode";
var RelativeDistinguishedNames = class RelativeDistinguishedNames2 extends PkiObject {
  static {
    this.CLASS_NAME = "RelativeDistinguishedNames";
  }
  constructor(parameters = {}) {
    super();
    this.typesAndValues = parameters["typesAndValues"] ?? RelativeDistinguishedNames2.defaultValues("typesAndValues");
    this.valueBeforeDecode = parameters["valueBeforeDecode"] ?? RelativeDistinguishedNames2.defaultValues("valueBeforeDecode");
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TYPE_AND_VALUES:
        return [];
      case VALUE_BEFORE_DECODE:
        return EMPTY_BUFFER2;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TYPE_AND_VALUES:
        return memberValue.length === 0;
      case VALUE_BEFORE_DECODE:
        return memberValue.byteLength === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.repeatedSequence || "",
        value: new Set2({ value: [new Repeated({
          name: names.repeatedSet || "",
          value: AttributeTypeAndValue.schema(names.typeAndValue || {})
        })] })
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of ["RDN", TYPE_AND_VALUES]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RelativeDistinguishedNames2.schema({ names: {
      blockName: "RDN",
      repeatedSet: TYPE_AND_VALUES
    } }));
    AsnError.assertSchema(asn1, this.className);
    if ("typesAndValues" in asn1.result) this.typesAndValues = Array.from(asn1.result.typesAndValues, (element) => new AttributeTypeAndValue({ schema: element }));
    this.valueBeforeDecode = asn1.result.RDN.valueBeforeDecodeView.slice().buffer;
  }
  toSchema() {
    if (this.valueBeforeDecode.byteLength === 0) return new Sequence({ value: [new Set2({ value: Array.from(this.typesAndValues, (o) => o.toSchema()) })] });
    const asn1 = fromBER(this.valueBeforeDecode);
    AsnError.assert(asn1, "RelativeDistinguishedNames");
    if (!(asn1.result instanceof Sequence)) throw new Error("ASN.1 result should be SEQUENCE");
    return asn1.result;
  }
  toJSON() {
    return { typesAndValues: Array.from(this.typesAndValues, (o) => o.toJSON()) };
  }
  isEqual(compareTo) {
    if (compareTo instanceof RelativeDistinguishedNames2) {
      if (this.typesAndValues.length !== compareTo.typesAndValues.length) return false;
      for (const [index, typeAndValue] of this.typesAndValues.entries()) if (typeAndValue.isEqual(compareTo.typesAndValues[index]) === false) return false;
      return true;
    }
    if (compareTo instanceof ArrayBuffer) return bytes_exports.equal(this.valueBeforeDecode, compareTo);
    return false;
  }
};
var TYPE = "type";
var VALUE = "value";
function builtInStandardAttributes(parameters = {}, optional = false) {
  const names = parameters.names ?? {};
  return new Sequence({
    optional,
    value: [
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 2,
          tagNumber: 1
        },
        name: names.country_name || "",
        value: [new Choice({ value: [new NumericString(), new PrintableString()] })]
      }),
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 2,
          tagNumber: 2
        },
        name: names.administration_domain_name || "",
        value: [new Choice({ value: [new NumericString(), new PrintableString()] })]
      }),
      new Primitive({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        name: names.network_address || "",
        isHexOnly: true
      }),
      new Primitive({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        name: names.terminal_identifier || "",
        isHexOnly: true
      }),
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 2
        },
        name: names.private_domain_name || "",
        value: [new Choice({ value: [new NumericString(), new PrintableString()] })]
      }),
      new Primitive({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 3
        },
        name: names.organization_name || "",
        isHexOnly: true
      }),
      new Primitive({
        optional: true,
        name: names.numeric_user_identifier || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 4
        },
        isHexOnly: true
      }),
      new Constructed({
        optional: true,
        name: names.personal_name || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 5
        },
        value: [
          new Primitive({
            idBlock: {
              tagClass: 3,
              tagNumber: 0
            },
            isHexOnly: true
          }),
          new Primitive({
            optional: true,
            idBlock: {
              tagClass: 3,
              tagNumber: 1
            },
            isHexOnly: true
          }),
          new Primitive({
            optional: true,
            idBlock: {
              tagClass: 3,
              tagNumber: 2
            },
            isHexOnly: true
          }),
          new Primitive({
            optional: true,
            idBlock: {
              tagClass: 3,
              tagNumber: 3
            },
            isHexOnly: true
          })
        ]
      }),
      new Constructed({
        optional: true,
        name: names.organizational_unit_names || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 6
        },
        value: [new Repeated({ value: new PrintableString() })]
      })
    ]
  });
}
function builtInDomainDefinedAttributes(optional = false) {
  return new Sequence({
    optional,
    value: [new PrintableString(), new PrintableString()]
  });
}
function extensionAttributes(optional = false) {
  return new Set2({
    optional,
    value: [new Primitive({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      isHexOnly: true
    }), new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: [new Any()]
    })]
  });
}
var GeneralName = class GeneralName2 extends PkiObject {
  static {
    this.CLASS_NAME = "GeneralName";
  }
  constructor(parameters = {}) {
    super();
    this.type = parameters["type"] ?? GeneralName2.defaultValues("type");
    this.value = parameters["value"] ?? GeneralName2.defaultValues("value");
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TYPE:
        return 9;
      case VALUE:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TYPE:
        return memberValue === GeneralName2.defaultValues(memberName);
      case VALUE:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Choice({ value: [
      new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        name: names.blockName || "",
        value: [new ObjectIdentifier(), new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Any()]
        })]
      }),
      new Primitive({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        }
      }),
      new Primitive({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 2
        }
      }),
      new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 3
        },
        name: names.blockName || "",
        value: [
          builtInStandardAttributes(names.builtInStandardAttributes || {}, false),
          builtInDomainDefinedAttributes(true),
          extensionAttributes(true)
        ]
      }),
      new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 4
        },
        name: names.blockName || "",
        value: [RelativeDistinguishedNames.schema(names.directoryName || {})]
      }),
      new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 5
        },
        name: names.blockName || "",
        value: [new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Choice({ value: [
            new TeletexString(),
            new PrintableString(),
            new UniversalString(),
            new Utf8String(),
            new BmpString()
          ] })]
        }), new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new Choice({ value: [
            new TeletexString(),
            new PrintableString(),
            new UniversalString(),
            new Utf8String(),
            new BmpString()
          ] })]
        })]
      }),
      new Primitive({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 6
        }
      }),
      new Primitive({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 7
        }
      }),
      new Primitive({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 8
        }
      })
    ] });
  }
  fromSchema(schema) {
    for (const prop of [
      "blockName",
      "otherName",
      "rfc822Name",
      "dNSName",
      "x400Address",
      "directoryName",
      "ediPartyName",
      "uniformResourceIdentifier",
      "iPAddress",
      "registeredID"
    ]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, GeneralName2.schema({ names: {
      blockName: "blockName",
      otherName: "otherName",
      rfc822Name: "rfc822Name",
      dNSName: "dNSName",
      x400Address: "x400Address",
      directoryName: { names: { blockName: "directoryName" } },
      ediPartyName: "ediPartyName",
      uniformResourceIdentifier: "uniformResourceIdentifier",
      iPAddress: "iPAddress",
      registeredID: "registeredID"
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.type = asn1.result.blockName.idBlock.tagNumber;
    switch (this.type) {
      case 0:
        this.value = asn1.result.blockName;
        break;
      case 1:
      case 2:
      case 6:
        {
          const value = asn1.result.blockName;
          value.idBlock.tagClass = 1;
          value.idBlock.tagNumber = 22;
          const valueBER = value.toBER(false);
          const asnValue = fromBER(valueBER);
          AsnError.assert(asnValue, "GeneralName value");
          this.value = asnValue.result.valueBlock.value;
        }
        break;
      case 3:
        this.value = asn1.result.blockName;
        break;
      case 4:
        this.value = new RelativeDistinguishedNames({ schema: asn1.result.directoryName });
        break;
      case 5:
        this.value = asn1.result.ediPartyName;
        break;
      case 7:
        this.value = new OctetString({ valueHex: asn1.result.blockName.valueBlock.valueHex });
        break;
      case 8: {
        const value = asn1.result.blockName;
        value.idBlock.tagClass = 1;
        value.idBlock.tagNumber = 6;
        const valueBER = value.toBER(false);
        const asnValue = fromBER(valueBER);
        AsnError.assert(asnValue, "GeneralName registeredID");
        this.value = asnValue.result.valueBlock.toString();
      }
    }
  }
  toSchema() {
    switch (this.type) {
      case 0:
      case 3:
      case 5:
        return new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: this.type
          },
          value: [this.value]
        });
      case 1:
      case 2:
      case 6: {
        const value = new IA5String({ value: this.value });
        value.idBlock.tagClass = 3;
        value.idBlock.tagNumber = this.type;
        return value;
      }
      case 4:
        return new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 4
          },
          value: [this.value.toSchema()]
        });
      case 7: {
        const value = this.value;
        value.idBlock.tagClass = 3;
        value.idBlock.tagNumber = this.type;
        return value;
      }
      case 8: {
        const value = new ObjectIdentifier({ value: this.value });
        value.idBlock.tagClass = 3;
        value.idBlock.tagNumber = this.type;
        return value;
      }
      default:
        return GeneralName2.schema();
    }
  }
  toJSON() {
    const _object = {
      type: this.type,
      value: ""
    };
    if (typeof this.value === "string") _object.value = this.value;
    else try {
      _object.value = this.value.toJSON();
    } catch {
    }
    return _object;
  }
};
var ACCESS_METHOD = "accessMethod";
var ACCESS_LOCATION = "accessLocation";
var CLEAR_PROPS$95 = [ACCESS_METHOD, ACCESS_LOCATION];
var AccessDescription = class AccessDescription2 extends PkiObject {
  static {
    this.CLASS_NAME = "AccessDescription";
  }
  constructor(parameters = {}) {
    super();
    this.accessMethod = parameters[ACCESS_METHOD] ?? AccessDescription2.defaultValues(ACCESS_METHOD);
    this.accessLocation = parameters[ACCESS_LOCATION] ?? AccessDescription2.defaultValues(ACCESS_LOCATION);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ACCESS_METHOD:
        return "";
      case ACCESS_LOCATION:
        return new GeneralName();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.accessMethod || "" }), GeneralName.schema(names.accessLocation || {})]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$95) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AccessDescription2.schema({ names: {
      accessMethod: ACCESS_METHOD,
      accessLocation: { names: { blockName: ACCESS_LOCATION } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.accessMethod = asn1.result.accessMethod.valueBlock.toString();
    this.accessLocation = new GeneralName({ schema: asn1.result.accessLocation });
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.accessMethod }), this.accessLocation.toSchema()] });
  }
  toJSON() {
    return {
      accessMethod: this.accessMethod,
      accessLocation: this.accessLocation.toJSON()
    };
  }
};
var SECONDS = "seconds";
var MILLIS = "millis";
var MICROS = "micros";
var Accuracy = class Accuracy2 extends PkiObject {
  static {
    this.CLASS_NAME = "Accuracy";
  }
  constructor(parameters = {}) {
    super();
    if ("seconds" in parameters) this.seconds = parameters["seconds"] ?? Accuracy2.defaultValues("seconds");
    if ("millis" in parameters) this.millis = parameters["millis"] ?? Accuracy2.defaultValues("millis");
    if ("micros" in parameters) this.micros = parameters["micros"] ?? Accuracy2.defaultValues("micros");
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SECONDS:
      case MILLIS:
      case MICROS:
        return 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case SECONDS:
      case MILLIS:
      case MICROS:
        return memberValue === Accuracy2.defaultValues(memberName);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      optional: true,
      value: [
        new Integer({
          optional: true,
          name: names.seconds || ""
        }),
        new Primitive({
          name: names.millis || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          }
        }),
        new Primitive({
          name: names.micros || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          }
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of [
      SECONDS,
      MILLIS,
      MICROS
    ]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Accuracy2.schema({ names: {
      seconds: SECONDS,
      millis: MILLIS,
      micros: MICROS
    } }));
    AsnError.assertSchema(asn1, this.className);
    if ("seconds" in asn1.result) this.seconds = asn1.result.seconds.valueBlock.valueDec;
    if ("millis" in asn1.result) {
      const intMillis = new Integer({ valueHex: asn1.result.millis.valueBlock.valueHex });
      this.millis = intMillis.valueBlock.valueDec;
    }
    if ("micros" in asn1.result) {
      const intMicros = new Integer({ valueHex: asn1.result.micros.valueBlock.valueHex });
      this.micros = intMicros.valueBlock.valueDec;
    }
  }
  toSchema() {
    const outputArray = [];
    if (this.seconds !== void 0) outputArray.push(new Integer({ value: this.seconds }));
    if (this.millis !== void 0) {
      const intMillis = new Integer({ value: this.millis });
      outputArray.push(new Primitive({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        valueHex: intMillis.valueBlock.valueHexView
      }));
    }
    if (this.micros !== void 0) {
      const intMicros = new Integer({ value: this.micros });
      outputArray.push(new Primitive({
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        valueHex: intMicros.valueBlock.valueHexView
      }));
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const _object = {};
    if (this.seconds !== void 0) _object.seconds = this.seconds;
    if (this.millis !== void 0) _object.millis = this.millis;
    if (this.micros !== void 0) _object.micros = this.micros;
    return _object;
  }
};
var ALGORITHM_ID = "algorithmId";
var ALGORITHM_PARAMS = "algorithmParams";
var ALGORITHM$2 = "algorithm";
var PARAMS = "params";
var CLEAR_PROPS$94 = [ALGORITHM$2, PARAMS];
var AlgorithmIdentifier = class AlgorithmIdentifier2 extends PkiObject {
  static {
    this.CLASS_NAME = "AlgorithmIdentifier";
  }
  constructor(parameters = {}) {
    super();
    this.algorithmId = parameters[ALGORITHM_ID] ?? AlgorithmIdentifier2.defaultValues(ALGORITHM_ID);
    if (ALGORITHM_PARAMS in parameters) this.algorithmParams = parameters[ALGORITHM_PARAMS] ?? AlgorithmIdentifier2.defaultValues(ALGORITHM_PARAMS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ALGORITHM_ID:
        return "";
      case ALGORITHM_PARAMS:
        return new Any();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case ALGORITHM_ID:
        return memberValue === "";
      case ALGORITHM_PARAMS:
        return memberValue instanceof Any;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      optional: names.optional || false,
      value: [new ObjectIdentifier({ name: names.algorithmIdentifier || "" }), new Any({
        name: names.algorithmParams || "",
        optional: true
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$94) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AlgorithmIdentifier2.schema({ names: {
      algorithmIdentifier: ALGORITHM$2,
      algorithmParams: PARAMS
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.algorithmId = asn1.result.algorithm.valueBlock.toString();
    if (PARAMS in asn1.result) this.algorithmParams = asn1.result.params;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.algorithmId }));
    if (this.algorithmParams && !(this.algorithmParams instanceof Any)) outputArray.push(this.algorithmParams);
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const object = { algorithmId: this.algorithmId };
    if (this.algorithmParams && !(this.algorithmParams instanceof Any)) object.algorithmParams = this.algorithmParams.toJSON();
    return object;
  }
  isEqual(algorithmIdentifier) {
    if (!(algorithmIdentifier instanceof AlgorithmIdentifier2)) return false;
    if (this.algorithmId !== algorithmIdentifier.algorithmId) return false;
    if (this.algorithmParams) {
      if (algorithmIdentifier.algorithmParams) return JSON.stringify(this.algorithmParams) === JSON.stringify(algorithmIdentifier.algorithmParams);
      return false;
    }
    if (algorithmIdentifier.algorithmParams) return false;
    return true;
  }
};
var ALT_NAMES = "altNames";
var CLEAR_PROPS$93 = [ALT_NAMES];
var AltName = class AltName2 extends PkiObject {
  static {
    this.CLASS_NAME = "AltName";
  }
  constructor(parameters = {}) {
    super();
    this.altNames = parameters[ALT_NAMES] ?? AltName2.defaultValues(ALT_NAMES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ALT_NAMES:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.altNames || "",
        value: GeneralName.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$93) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AltName2.schema({ names: { altNames: ALT_NAMES } }));
    AsnError.assertSchema(asn1, this.className);
    if (ALT_NAMES in asn1.result) this.altNames = Array.from(asn1.result.altNames, (element) => new GeneralName({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.altNames, (o) => o.toSchema()) });
  }
  toJSON() {
    return { altNames: Array.from(this.altNames, (o) => o.toJSON()) };
  }
};
var TYPE$4 = "type";
var VALUES$1 = "values";
var CLEAR_PROPS$92 = [TYPE$4, VALUES$1];
var Attribute = class Attribute2 extends PkiObject {
  static {
    this.CLASS_NAME = "Attribute";
  }
  constructor(parameters = {}) {
    super();
    this.type = parameters[TYPE$4] ?? Attribute2.defaultValues(TYPE$4);
    this.values = parameters[VALUES$1] ?? Attribute2.defaultValues(VALUES$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TYPE$4:
        return "";
      case VALUES$1:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TYPE$4:
        return memberValue === "";
      case VALUES$1:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.type || "" }), new Set2({
        name: names.setName || "",
        value: [new Repeated({
          name: names.values || "",
          value: new Any()
        })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$92) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Attribute2.schema({ names: {
      type: TYPE$4,
      values: VALUES$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.type = asn1.result.type.valueBlock.toString();
    this.values = asn1.result.values;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.type }), new Set2({ value: this.values })] });
  }
  toJSON() {
    return {
      type: this.type,
      values: Array.from(this.values, (o) => o.toJSON())
    };
  }
};
var NOT_BEFORE_TIME = "notBeforeTime";
var NOT_AFTER_TIME = "notAfterTime";
var CLEAR_PROPS$91 = [NOT_BEFORE_TIME, NOT_AFTER_TIME];
var AttCertValidityPeriod = class AttCertValidityPeriod2 extends PkiObject {
  static {
    this.CLASS_NAME = "AttCertValidityPeriod";
  }
  constructor(parameters = {}) {
    super();
    this.notBeforeTime = parameters[NOT_BEFORE_TIME] ?? AttCertValidityPeriod2.defaultValues(NOT_BEFORE_TIME);
    this.notAfterTime = parameters[NOT_AFTER_TIME] ?? AttCertValidityPeriod2.defaultValues(NOT_AFTER_TIME);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case NOT_BEFORE_TIME:
      case NOT_AFTER_TIME:
        return new Date(0, 0, 0);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new GeneralizedTime({ name: names.notBeforeTime || "" }), new GeneralizedTime({ name: names.notAfterTime || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$91) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AttCertValidityPeriod2.schema({ names: {
      notBeforeTime: NOT_BEFORE_TIME,
      notAfterTime: NOT_AFTER_TIME
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.notBeforeTime = asn1.result.notBeforeTime.toDate();
    this.notAfterTime = asn1.result.notAfterTime.toDate();
  }
  toSchema() {
    return new Sequence({ value: [new GeneralizedTime({ valueDate: this.notBeforeTime }), new GeneralizedTime({ valueDate: this.notAfterTime })] });
  }
  toJSON() {
    return {
      notBeforeTime: this.notBeforeTime,
      notAfterTime: this.notAfterTime
    };
  }
};
var NAMES = "names";
var GENERAL_NAMES = "generalNames";
var GeneralNames = class GeneralNames2 extends PkiObject {
  static {
    this.CLASS_NAME = "GeneralNames";
  }
  constructor(parameters = {}) {
    super();
    this.names = parameters[NAMES] ?? GeneralNames2.defaultValues(NAMES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case "names":
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}, optional = false) {
    const names = parameters[NAMES] ?? {};
    return new Sequence({
      optional,
      name: names.blockName || "",
      value: [new Repeated({
        name: names.generalNames || "",
        value: GeneralName.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of [NAMES, GENERAL_NAMES]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, GeneralNames2.schema({ names: {
      blockName: NAMES,
      generalNames: GENERAL_NAMES
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.names = Array.from(asn1.result.generalNames, (element) => new GeneralName({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.names, (o) => o.toSchema()) });
  }
  toJSON() {
    return { names: Array.from(this.names, (o) => o.toJSON()) };
  }
};
var id_SubjectDirectoryAttributes = "2.5.29.9";
var id_PrivateKeyUsagePeriod = "2.5.29.16";
var id_SubjectAltName = "2.5.29.17";
var id_IssuerAltName = "2.5.29.18";
var id_BasicConstraints = "2.5.29.19";
var id_CRLNumber = "2.5.29.20";
var id_BaseCRLNumber = "2.5.29.27";
var id_CRLReason = "2.5.29.21";
var id_InvalidityDate = "2.5.29.24";
var id_IssuingDistributionPoint = "2.5.29.28";
var id_CertificateIssuer = "2.5.29.29";
var id_NameConstraints = "2.5.29.30";
var id_CRLDistributionPoints = "2.5.29.31";
var id_FreshestCRL = "2.5.29.46";
var id_CertificatePolicies = "2.5.29.32";
var id_AnyPolicy = "2.5.29.32.0";
var id_MicrosoftAppPolicies = "1.3.6.1.4.1.311.21.10";
var id_PolicyMappings = "2.5.29.33";
var id_AuthorityKeyIdentifier = "2.5.29.35";
var id_PolicyConstraints = "2.5.29.36";
var id_ExtKeyUsage = "2.5.29.37";
var id_AuthorityInfoAccess = "1.3.6.1.5.5.7.1.1";
var id_SubjectInfoAccess = "1.3.6.1.5.5.7.1.11";
var id_SignedCertificateTimestampList = "1.3.6.1.4.1.11129.2.4.2";
var id_MicrosoftCertTemplateV2 = "1.3.6.1.4.1.311.21.7";
var id_MicrosoftCaVersion = "1.3.6.1.4.1.311.21.1";
var id_QCStatements = "1.3.6.1.5.5.7.1.3";
var id_ContentType_Data = "1.2.840.113549.1.7.1";
var id_ContentType_SignedData = "1.2.840.113549.1.7.2";
var id_ContentType_EnvelopedData = "1.2.840.113549.1.7.3";
var id_ContentType_EncryptedData = "1.2.840.113549.1.7.6";
var id_CertBag_X509Certificate = "1.2.840.113549.1.9.22.1";
var id_CertBag_SDSICertificate = "1.2.840.113549.1.9.22.2";
var id_CertBag_AttributeCertificate = "1.2.840.113549.1.9.22.3";
var id_CRLBag_X509CRL = "1.2.840.113549.1.9.23.1";
var id_pkix = "1.3.6.1.5.5.7";
var id_ad = `${id_pkix}.48`;
var id_PKIX_OCSP_Basic = `${id_ad}.1.1`;
var id_ad_caIssuers = `${id_ad}.2`;
var id_ad_ocsp = `${id_ad}.1`;
var KEY_IDENTIFIER$1 = "keyIdentifier";
var AUTHORITY_CERT_ISSUER = "authorityCertIssuer";
var AUTHORITY_CERT_SERIAL_NUMBER = "authorityCertSerialNumber";
var CLEAR_PROPS$90 = [
  KEY_IDENTIFIER$1,
  AUTHORITY_CERT_ISSUER,
  AUTHORITY_CERT_SERIAL_NUMBER
];
var AuthorityKeyIdentifier = class AuthorityKeyIdentifier2 extends PkiObject {
  static {
    this.CLASS_NAME = "AuthorityKeyIdentifier";
  }
  constructor(parameters = {}) {
    super();
    if (KEY_IDENTIFIER$1 in parameters) this.keyIdentifier = parameters[KEY_IDENTIFIER$1] ?? AuthorityKeyIdentifier2.defaultValues(KEY_IDENTIFIER$1);
    if (AUTHORITY_CERT_ISSUER in parameters) this.authorityCertIssuer = parameters[AUTHORITY_CERT_ISSUER] ?? AuthorityKeyIdentifier2.defaultValues(AUTHORITY_CERT_ISSUER);
    if (AUTHORITY_CERT_SERIAL_NUMBER in parameters) this.authorityCertSerialNumber = parameters[AUTHORITY_CERT_SERIAL_NUMBER] ?? AuthorityKeyIdentifier2.defaultValues(AUTHORITY_CERT_SERIAL_NUMBER);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case KEY_IDENTIFIER$1:
        return new OctetString();
      case AUTHORITY_CERT_ISSUER:
        return [];
      case AUTHORITY_CERT_SERIAL_NUMBER:
        return new Integer();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Primitive({
          name: names.keyIdentifier || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          }
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new Repeated({
            name: names.authorityCertIssuer || "",
            value: GeneralName.schema()
          })]
        }),
        new Primitive({
          name: names.authorityCertSerialNumber || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          }
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$90) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AuthorityKeyIdentifier2.schema({ names: {
      keyIdentifier: KEY_IDENTIFIER$1,
      authorityCertIssuer: AUTHORITY_CERT_ISSUER,
      authorityCertSerialNumber: AUTHORITY_CERT_SERIAL_NUMBER
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (KEY_IDENTIFIER$1 in asn1.result) this.keyIdentifier = new OctetString({ valueHex: asn1.result.keyIdentifier.valueBlock.valueHex });
    if (AUTHORITY_CERT_ISSUER in asn1.result) this.authorityCertIssuer = Array.from(asn1.result.authorityCertIssuer, (o) => new GeneralName({ schema: o }));
    if (AUTHORITY_CERT_SERIAL_NUMBER in asn1.result) this.authorityCertSerialNumber = new Integer({ valueHex: asn1.result.authorityCertSerialNumber.valueBlock.valueHex });
  }
  toSchema() {
    const outputArray = [];
    if (this.keyIdentifier) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      valueHex: this.keyIdentifier.valueBlock.valueHexView
    }));
    if (this.authorityCertIssuer) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: Array.from(this.authorityCertIssuer, (o) => o.toSchema())
    }));
    if (this.authorityCertSerialNumber) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      valueHex: this.authorityCertSerialNumber.valueBlock.valueHexView
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const object = {};
    if (this.keyIdentifier) object.keyIdentifier = this.keyIdentifier.toJSON();
    if (this.authorityCertIssuer) object.authorityCertIssuer = Array.from(this.authorityCertIssuer, (o) => o.toJSON());
    if (this.authorityCertSerialNumber) object.authorityCertSerialNumber = this.authorityCertSerialNumber.toJSON();
    return object;
  }
};
var PATH_LENGTH_CONSTRAINT = "pathLenConstraint";
var CA = "cA";
var BasicConstraints = class BasicConstraints2 extends PkiObject {
  static {
    this.CLASS_NAME = "BasicConstraints";
  }
  constructor(parameters = {}) {
    super();
    this.cA = parameters[CA] ?? false;
    if (PATH_LENGTH_CONSTRAINT in parameters) this.pathLenConstraint = parameters[PATH_LENGTH_CONSTRAINT] ?? 0;
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CA:
        return false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Boolean2({
        optional: true,
        name: names.cA || ""
      }), new Integer({
        optional: true,
        name: names.pathLenConstraint || ""
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of [CA, PATH_LENGTH_CONSTRAINT]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, BasicConstraints2.schema({ names: {
      cA: CA,
      pathLenConstraint: PATH_LENGTH_CONSTRAINT
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (CA in asn1.result) this.cA = asn1.result.cA.valueBlock.value;
    if (PATH_LENGTH_CONSTRAINT in asn1.result) {
      if (asn1.result.pathLenConstraint.valueBlock.isHexOnly) this.pathLenConstraint = asn1.result.pathLenConstraint;
      else this.pathLenConstraint = asn1.result.pathLenConstraint.valueBlock.valueDec;
    }
  }
  toSchema() {
    const outputArray = [];
    if (this.cA !== BasicConstraints2.defaultValues(CA)) outputArray.push(new Boolean2({ value: this.cA }));
    if (PATH_LENGTH_CONSTRAINT in this) {
      if (this.pathLenConstraint instanceof Integer) outputArray.push(this.pathLenConstraint);
      else outputArray.push(new Integer({ value: this.pathLenConstraint }));
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const object = {};
    if (this.cA !== BasicConstraints2.defaultValues(CA)) object.cA = this.cA;
    if (PATH_LENGTH_CONSTRAINT in this) {
      if (this.pathLenConstraint instanceof Integer) object.pathLenConstraint = this.pathLenConstraint.toJSON();
      else object.pathLenConstraint = this.pathLenConstraint;
    }
    return object;
  }
};
var CERTIFICATE_INDEX = "certificateIndex";
var KEY_INDEX = "keyIndex";
var CAVersion = class CAVersion2 extends PkiObject {
  static {
    this.CLASS_NAME = "CAVersion";
  }
  constructor(parameters = {}) {
    super();
    this.certificateIndex = parameters[CERTIFICATE_INDEX] ?? CAVersion2.defaultValues(CERTIFICATE_INDEX);
    this.keyIndex = parameters[KEY_INDEX] ?? CAVersion2.defaultValues(KEY_INDEX);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CERTIFICATE_INDEX:
      case KEY_INDEX:
        return 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema() {
    return new Integer();
  }
  fromSchema(schema) {
    if (schema.constructor.blockName() !== Integer.blockName()) throw new Error("Object's schema was not verified against input data for CAVersion");
    let value = schema.valueBlock.valueHex.slice(0);
    const valueView = new Uint8Array(value);
    switch (true) {
      case value.byteLength < 4:
        {
          const tempValue = /* @__PURE__ */ new ArrayBuffer(4);
          new Uint8Array(tempValue).set(valueView, 4 - value.byteLength);
          value = tempValue.slice(0);
        }
        break;
      case value.byteLength > 4: {
        const tempValue = /* @__PURE__ */ new ArrayBuffer(4);
        new Uint8Array(tempValue).set(valueView.slice(0, 4));
        value = tempValue.slice(0);
      }
    }
    const keyIndexBuffer = value.slice(0, 2);
    const keyIndexView8 = new Uint8Array(keyIndexBuffer);
    let temp = keyIndexView8[0];
    keyIndexView8[0] = keyIndexView8[1];
    keyIndexView8[1] = temp;
    const keyIndexView16 = new Uint16Array(keyIndexBuffer);
    this.keyIndex = keyIndexView16[0];
    const certificateIndexBuffer = value.slice(2);
    const certificateIndexView8 = new Uint8Array(certificateIndexBuffer);
    temp = certificateIndexView8[0];
    certificateIndexView8[0] = certificateIndexView8[1];
    certificateIndexView8[1] = temp;
    const certificateIndexView16 = new Uint16Array(certificateIndexBuffer);
    this.certificateIndex = certificateIndexView16[0];
  }
  toSchema() {
    const certificateIndexBuffer = /* @__PURE__ */ new ArrayBuffer(2);
    const certificateIndexView = new Uint16Array(certificateIndexBuffer);
    certificateIndexView[0] = this.certificateIndex;
    const certificateIndexView8 = new Uint8Array(certificateIndexBuffer);
    let temp = certificateIndexView8[0];
    certificateIndexView8[0] = certificateIndexView8[1];
    certificateIndexView8[1] = temp;
    const keyIndexBuffer = /* @__PURE__ */ new ArrayBuffer(2);
    const keyIndexView = new Uint16Array(keyIndexBuffer);
    keyIndexView[0] = this.keyIndex;
    const keyIndexView8 = new Uint8Array(keyIndexBuffer);
    temp = keyIndexView8[0];
    keyIndexView8[0] = keyIndexView8[1];
    keyIndexView8[1] = temp;
    return new Integer({ valueHex: bytes_exports.concat(keyIndexBuffer, certificateIndexBuffer) });
  }
  toJSON() {
    return {
      certificateIndex: this.certificateIndex,
      keyIndex: this.keyIndex
    };
  }
};
var POLICY_QUALIFIER_ID = "policyQualifierId";
var QUALIFIER = "qualifier";
var CLEAR_PROPS$89 = [POLICY_QUALIFIER_ID, QUALIFIER];
var PolicyQualifierInfo = class PolicyQualifierInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "PolicyQualifierInfo";
  }
  constructor(parameters = {}) {
    super();
    this.policyQualifierId = parameters[POLICY_QUALIFIER_ID] ?? PolicyQualifierInfo2.defaultValues(POLICY_QUALIFIER_ID);
    this.qualifier = parameters[QUALIFIER] ?? PolicyQualifierInfo2.defaultValues(QUALIFIER);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case POLICY_QUALIFIER_ID:
        return "";
      case QUALIFIER:
        return new Any();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.policyQualifierId || "" }), new Any({ name: names.qualifier || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$89) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PolicyQualifierInfo2.schema({ names: {
      policyQualifierId: POLICY_QUALIFIER_ID,
      qualifier: QUALIFIER
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.policyQualifierId = asn1.result.policyQualifierId.valueBlock.toString();
    this.qualifier = asn1.result.qualifier;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.policyQualifierId }), this.qualifier] });
  }
  toJSON() {
    return {
      policyQualifierId: this.policyQualifierId,
      qualifier: this.qualifier.toJSON()
    };
  }
};
var POLICY_IDENTIFIER = "policyIdentifier";
var POLICY_QUALIFIERS = "policyQualifiers";
var CLEAR_PROPS$88 = [POLICY_IDENTIFIER, POLICY_QUALIFIERS];
var PolicyInformation = class PolicyInformation2 extends PkiObject {
  static {
    this.CLASS_NAME = "PolicyInformation";
  }
  constructor(parameters = {}) {
    super();
    this.policyIdentifier = parameters["policyIdentifier"] ?? PolicyInformation2.defaultValues("policyIdentifier");
    if ("policyQualifiers" in parameters) this.policyQualifiers = parameters["policyQualifiers"] ?? PolicyInformation2.defaultValues("policyQualifiers");
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case POLICY_IDENTIFIER:
        return "";
      case POLICY_QUALIFIERS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.policyIdentifier || "" }), new Sequence({
        optional: true,
        value: [new Repeated({
          name: names.policyQualifiers || "",
          value: PolicyQualifierInfo.schema()
        })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$88) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PolicyInformation2.schema({ names: {
      policyIdentifier: POLICY_IDENTIFIER,
      policyQualifiers: POLICY_QUALIFIERS
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.policyIdentifier = asn1.result.policyIdentifier.valueBlock.toString();
    if ("policyQualifiers" in asn1.result) this.policyQualifiers = Array.from(asn1.result.policyQualifiers, (element) => new PolicyQualifierInfo({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.policyIdentifier }));
    if (this.policyQualifiers) outputArray.push(new Sequence({ value: Array.from(this.policyQualifiers, (o) => o.toSchema()) }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { policyIdentifier: this.policyIdentifier };
    if (this.policyQualifiers) res.policyQualifiers = Array.from(this.policyQualifiers, (o) => o.toJSON());
    return res;
  }
};
var CERTIFICATE_POLICIES = "certificatePolicies";
var CLEAR_PROPS$87 = [CERTIFICATE_POLICIES];
var CertificatePolicies = class CertificatePolicies2 extends PkiObject {
  static {
    this.CLASS_NAME = "CertificatePolicies";
  }
  constructor(parameters = {}) {
    super();
    this.certificatePolicies = parameters[CERTIFICATE_POLICIES] ?? CertificatePolicies2.defaultValues(CERTIFICATE_POLICIES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CERTIFICATE_POLICIES:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.certificatePolicies || "",
        value: PolicyInformation.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$87) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertificatePolicies2.schema({ names: { certificatePolicies: CERTIFICATE_POLICIES } }));
    AsnError.assertSchema(asn1, this.className);
    this.certificatePolicies = Array.from(asn1.result.certificatePolicies, (element) => new PolicyInformation({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.certificatePolicies, (o) => o.toSchema()) });
  }
  toJSON() {
    return { certificatePolicies: Array.from(this.certificatePolicies, (o) => o.toJSON()) };
  }
};
var TEMPLATE_ID = "templateID";
var TEMPLATE_MAJOR_VERSION = "templateMajorVersion";
var TEMPLATE_MINOR_VERSION = "templateMinorVersion";
var CLEAR_PROPS$86 = [
  TEMPLATE_ID,
  TEMPLATE_MAJOR_VERSION,
  TEMPLATE_MINOR_VERSION
];
var CertificateTemplate = class CertificateTemplate2 extends PkiObject {
  constructor(parameters = {}) {
    super();
    this.templateID = parameters[TEMPLATE_ID] ?? CertificateTemplate2.defaultValues(TEMPLATE_ID);
    if (TEMPLATE_MAJOR_VERSION in parameters) this.templateMajorVersion = parameters[TEMPLATE_MAJOR_VERSION] ?? CertificateTemplate2.defaultValues(TEMPLATE_MAJOR_VERSION);
    if (TEMPLATE_MINOR_VERSION in parameters) this.templateMinorVersion = parameters[TEMPLATE_MINOR_VERSION] ?? CertificateTemplate2.defaultValues(TEMPLATE_MINOR_VERSION);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TEMPLATE_ID:
        return "";
      case TEMPLATE_MAJOR_VERSION:
      case TEMPLATE_MINOR_VERSION:
        return 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new ObjectIdentifier({ name: names.templateID || "" }),
        new Integer({
          name: names.templateMajorVersion || "",
          optional: true
        }),
        new Integer({
          name: names.templateMinorVersion || "",
          optional: true
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$86) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertificateTemplate2.schema({ names: {
      templateID: TEMPLATE_ID,
      templateMajorVersion: TEMPLATE_MAJOR_VERSION,
      templateMinorVersion: TEMPLATE_MINOR_VERSION
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.templateID = asn1.result.templateID.valueBlock.toString();
    if (TEMPLATE_MAJOR_VERSION in asn1.result) this.templateMajorVersion = asn1.result.templateMajorVersion.valueBlock.valueDec;
    if (TEMPLATE_MINOR_VERSION in asn1.result) this.templateMinorVersion = asn1.result.templateMinorVersion.valueBlock.valueDec;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.templateID }));
    if (TEMPLATE_MAJOR_VERSION in this) outputArray.push(new Integer({ value: this.templateMajorVersion }));
    if (TEMPLATE_MINOR_VERSION in this) outputArray.push(new Integer({ value: this.templateMinorVersion }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { templateID: this.templateID };
    if (TEMPLATE_MAJOR_VERSION in this) res.templateMajorVersion = this.templateMajorVersion;
    if (TEMPLATE_MINOR_VERSION in this) res.templateMinorVersion = this.templateMinorVersion;
    return res;
  }
};
var DISTRIBUTION_POINT$1 = "distributionPoint";
var DISTRIBUTION_POINT_NAMES$1 = "distributionPointNames";
var REASONS = "reasons";
var CRL_ISSUER = "cRLIssuer";
var CRL_ISSUER_NAMES = "cRLIssuerNames";
var CLEAR_PROPS$85 = [
  DISTRIBUTION_POINT$1,
  DISTRIBUTION_POINT_NAMES$1,
  REASONS,
  CRL_ISSUER,
  CRL_ISSUER_NAMES
];
var DistributionPoint = class DistributionPoint2 extends PkiObject {
  static {
    this.CLASS_NAME = "DistributionPoint";
  }
  constructor(parameters = {}) {
    super();
    if (DISTRIBUTION_POINT$1 in parameters) this.distributionPoint = parameters[DISTRIBUTION_POINT$1] ?? DistributionPoint2.defaultValues(DISTRIBUTION_POINT$1);
    if (REASONS in parameters) this.reasons = parameters[REASONS] ?? DistributionPoint2.defaultValues(REASONS);
    if (CRL_ISSUER in parameters) this.cRLIssuer = parameters[CRL_ISSUER] ?? DistributionPoint2.defaultValues(CRL_ISSUER);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case DISTRIBUTION_POINT$1:
        return [];
      case REASONS:
        return new BitString();
      case CRL_ISSUER:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Choice({ value: [new Constructed({
            name: names.distributionPoint || "",
            optional: true,
            idBlock: {
              tagClass: 3,
              tagNumber: 0
            },
            value: [new Repeated({
              name: names.distributionPointNames || "",
              value: GeneralName.schema()
            })]
          }), new Constructed({
            name: names.distributionPoint || "",
            optional: true,
            idBlock: {
              tagClass: 3,
              tagNumber: 1
            },
            value: RelativeDistinguishedNames.schema().valueBlock.value
          })] })]
        }),
        new Primitive({
          name: names.reasons || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          }
        }),
        new Constructed({
          name: names.cRLIssuer || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          value: [new Repeated({
            name: names.cRLIssuerNames || "",
            value: GeneralName.schema()
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$85) delete schema[prop];
    const asn1 = compareSchema(schema, schema, DistributionPoint2.schema({ names: {
      distributionPoint: DISTRIBUTION_POINT$1,
      distributionPointNames: DISTRIBUTION_POINT_NAMES$1,
      reasons: REASONS,
      cRLIssuer: CRL_ISSUER,
      cRLIssuerNames: CRL_ISSUER_NAMES
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (DISTRIBUTION_POINT$1 in asn1.result) {
      if (asn1.result.distributionPoint.idBlock.tagNumber === 0) this.distributionPoint = Array.from(asn1.result.distributionPointNames, (element) => new GeneralName({ schema: element }));
      if (asn1.result.distributionPoint.idBlock.tagNumber === 1) this.distributionPoint = new RelativeDistinguishedNames({ schema: new Sequence({ value: asn1.result.distributionPoint.valueBlock.value }) });
    }
    if (REASONS in asn1.result) this.reasons = new BitString({ valueHex: asn1.result.reasons.valueBlock.valueHex });
    if (CRL_ISSUER in asn1.result) this.cRLIssuer = Array.from(asn1.result.cRLIssuerNames, (element) => new GeneralName({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    if (this.distributionPoint) {
      let internalValue;
      if (this.distributionPoint instanceof Array) internalValue = new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: Array.from(this.distributionPoint, (o) => o.toSchema())
      });
      else internalValue = new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: [this.distributionPoint.toSchema()]
      });
      outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [internalValue]
      }));
    }
    if (this.reasons) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      valueHex: this.reasons.valueBlock.valueHexView
    }));
    if (this.cRLIssuer) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      value: Array.from(this.cRLIssuer, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const object = {};
    if (this.distributionPoint) {
      if (this.distributionPoint instanceof Array) object.distributionPoint = Array.from(this.distributionPoint, (o) => o.toJSON());
      else object.distributionPoint = this.distributionPoint.toJSON();
    }
    if (this.reasons) object.reasons = this.reasons.toJSON();
    if (this.cRLIssuer) object.cRLIssuer = Array.from(this.cRLIssuer, (o) => o.toJSON());
    return object;
  }
};
var DISTRIBUTION_POINTS = "distributionPoints";
var CLEAR_PROPS$84 = [DISTRIBUTION_POINTS];
var CRLDistributionPoints = class CRLDistributionPoints2 extends PkiObject {
  static {
    this.CLASS_NAME = "CRLDistributionPoints";
  }
  constructor(parameters = {}) {
    super();
    this.distributionPoints = parameters[DISTRIBUTION_POINTS] ?? CRLDistributionPoints2.defaultValues(DISTRIBUTION_POINTS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case DISTRIBUTION_POINTS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.distributionPoints || "",
        value: DistributionPoint.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$84) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CRLDistributionPoints2.schema({ names: { distributionPoints: DISTRIBUTION_POINTS } }));
    AsnError.assertSchema(asn1, this.className);
    this.distributionPoints = Array.from(asn1.result.distributionPoints, (element) => new DistributionPoint({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.distributionPoints, (o) => o.toSchema()) });
  }
  toJSON() {
    return { distributionPoints: Array.from(this.distributionPoints, (o) => o.toJSON()) };
  }
};
var KEY_PURPOSES = "keyPurposes";
var CLEAR_PROPS$83 = [KEY_PURPOSES];
var ExtKeyUsage = class ExtKeyUsage2 extends PkiObject {
  static {
    this.CLASS_NAME = "ExtKeyUsage";
  }
  constructor(parameters = {}) {
    super();
    this.keyPurposes = parameters[KEY_PURPOSES] ?? ExtKeyUsage2.defaultValues(KEY_PURPOSES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case KEY_PURPOSES:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.keyPurposes || "",
        value: new ObjectIdentifier()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$83) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ExtKeyUsage2.schema({ names: { keyPurposes: KEY_PURPOSES } }));
    AsnError.assertSchema(asn1, this.className);
    this.keyPurposes = Array.from(asn1.result.keyPurposes, (element) => element.valueBlock.toString());
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.keyPurposes, (element) => new ObjectIdentifier({ value: element })) });
  }
  toJSON() {
    return { keyPurposes: Array.from(this.keyPurposes) };
  }
};
var ACCESS_DESCRIPTIONS = "accessDescriptions";
var InfoAccess = class InfoAccess2 extends PkiObject {
  static {
    this.CLASS_NAME = "InfoAccess";
  }
  constructor(parameters = {}) {
    super();
    this.accessDescriptions = parameters[ACCESS_DESCRIPTIONS] ?? InfoAccess2.defaultValues(ACCESS_DESCRIPTIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ACCESS_DESCRIPTIONS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.accessDescriptions || "",
        value: AccessDescription.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of [ACCESS_DESCRIPTIONS]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, InfoAccess2.schema({ names: { accessDescriptions: ACCESS_DESCRIPTIONS } }));
    AsnError.assertSchema(asn1, this.className);
    this.accessDescriptions = Array.from(asn1.result.accessDescriptions, (element) => new AccessDescription({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.accessDescriptions, (o) => o.toSchema()) });
  }
  toJSON() {
    return { accessDescriptions: Array.from(this.accessDescriptions, (o) => o.toJSON()) };
  }
};
var DISTRIBUTION_POINT = "distributionPoint";
var DISTRIBUTION_POINT_NAMES = "distributionPointNames";
var ONLY_CONTAINS_USER_CERTS = "onlyContainsUserCerts";
var ONLY_CONTAINS_CA_CERTS = "onlyContainsCACerts";
var ONLY_SOME_REASON = "onlySomeReasons";
var INDIRECT_CRL = "indirectCRL";
var ONLY_CONTAINS_ATTRIBUTE_CERTS = "onlyContainsAttributeCerts";
var CLEAR_PROPS$82 = [
  DISTRIBUTION_POINT,
  DISTRIBUTION_POINT_NAMES,
  ONLY_CONTAINS_USER_CERTS,
  ONLY_CONTAINS_CA_CERTS,
  ONLY_SOME_REASON,
  INDIRECT_CRL,
  ONLY_CONTAINS_ATTRIBUTE_CERTS
];
var IssuingDistributionPoint = class IssuingDistributionPoint2 extends PkiObject {
  static {
    this.CLASS_NAME = "IssuingDistributionPoint";
  }
  constructor(parameters = {}) {
    super();
    if (DISTRIBUTION_POINT in parameters) this.distributionPoint = parameters[DISTRIBUTION_POINT] ?? IssuingDistributionPoint2.defaultValues(DISTRIBUTION_POINT);
    this.onlyContainsUserCerts = parameters[ONLY_CONTAINS_USER_CERTS] ?? IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_USER_CERTS);
    this.onlyContainsCACerts = parameters[ONLY_CONTAINS_CA_CERTS] ?? IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_CA_CERTS);
    if (ONLY_SOME_REASON in parameters) this.onlySomeReasons = parameters[ONLY_SOME_REASON] ?? IssuingDistributionPoint2.defaultValues(ONLY_SOME_REASON);
    this.indirectCRL = parameters[INDIRECT_CRL] ?? IssuingDistributionPoint2.defaultValues(INDIRECT_CRL);
    this.onlyContainsAttributeCerts = parameters[ONLY_CONTAINS_ATTRIBUTE_CERTS] ?? IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_ATTRIBUTE_CERTS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case DISTRIBUTION_POINT:
        return [];
      case ONLY_CONTAINS_USER_CERTS:
        return false;
      case ONLY_CONTAINS_CA_CERTS:
        return false;
      case ONLY_SOME_REASON:
        return 0;
      case INDIRECT_CRL:
        return false;
      case ONLY_CONTAINS_ATTRIBUTE_CERTS:
        return false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Choice({ value: [new Constructed({
            name: names.distributionPoint || "",
            idBlock: {
              tagClass: 3,
              tagNumber: 0
            },
            value: [new Repeated({
              name: names.distributionPointNames || "",
              value: GeneralName.schema()
            })]
          }), new Constructed({
            name: names.distributionPoint || "",
            idBlock: {
              tagClass: 3,
              tagNumber: 1
            },
            value: RelativeDistinguishedNames.schema().valueBlock.value
          })] })]
        }),
        new Primitive({
          name: names.onlyContainsUserCerts || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          }
        }),
        new Primitive({
          name: names.onlyContainsCACerts || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          }
        }),
        new Primitive({
          name: names.onlySomeReasons || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 3
          }
        }),
        new Primitive({
          name: names.indirectCRL || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 4
          }
        }),
        new Primitive({
          name: names.onlyContainsAttributeCerts || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 5
          }
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$82) delete schema[prop];
    const asn1 = compareSchema(schema, schema, IssuingDistributionPoint2.schema({ names: {
      distributionPoint: DISTRIBUTION_POINT,
      distributionPointNames: DISTRIBUTION_POINT_NAMES,
      onlyContainsUserCerts: ONLY_CONTAINS_USER_CERTS,
      onlyContainsCACerts: ONLY_CONTAINS_CA_CERTS,
      onlySomeReasons: ONLY_SOME_REASON,
      indirectCRL: INDIRECT_CRL,
      onlyContainsAttributeCerts: ONLY_CONTAINS_ATTRIBUTE_CERTS
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (DISTRIBUTION_POINT in asn1.result) switch (true) {
      case asn1.result.distributionPoint.idBlock.tagNumber === 0:
        this.distributionPoint = Array.from(asn1.result.distributionPointNames, (element) => new GeneralName({ schema: element }));
        break;
      case asn1.result.distributionPoint.idBlock.tagNumber === 1:
        this.distributionPoint = new RelativeDistinguishedNames({ schema: new Sequence({ value: asn1.result.distributionPoint.valueBlock.value }) });
        break;
      default:
        throw new Error("Unknown tagNumber for distributionPoint: {$asn1.result.distributionPoint.idBlock.tagNumber}");
    }
    if (ONLY_CONTAINS_USER_CERTS in asn1.result) {
      const view = new Uint8Array(asn1.result.onlyContainsUserCerts.valueBlock.valueHex);
      this.onlyContainsUserCerts = view[0] !== 0;
    }
    if (ONLY_CONTAINS_CA_CERTS in asn1.result) {
      const view = new Uint8Array(asn1.result.onlyContainsCACerts.valueBlock.valueHex);
      this.onlyContainsCACerts = view[0] !== 0;
    }
    if (ONLY_SOME_REASON in asn1.result) {
      const view = new Uint8Array(asn1.result.onlySomeReasons.valueBlock.valueHex);
      this.onlySomeReasons = view[0];
    }
    if (INDIRECT_CRL in asn1.result) {
      const view = new Uint8Array(asn1.result.indirectCRL.valueBlock.valueHex);
      this.indirectCRL = view[0] !== 0;
    }
    if (ONLY_CONTAINS_ATTRIBUTE_CERTS in asn1.result) {
      const view = new Uint8Array(asn1.result.onlyContainsAttributeCerts.valueBlock.valueHex);
      this.onlyContainsAttributeCerts = view[0] !== 0;
    }
  }
  toSchema() {
    const outputArray = [];
    if (this.distributionPoint) {
      let value;
      if (this.distributionPoint instanceof Array) value = new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: Array.from(this.distributionPoint, (o) => o.toSchema())
      });
      else {
        value = this.distributionPoint.toSchema();
        value.idBlock.tagClass = 3;
        value.idBlock.tagNumber = 1;
      }
      outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [value]
      }));
    }
    if (this.onlyContainsUserCerts !== IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_USER_CERTS)) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      valueHex: new Uint8Array([255]).buffer
    }));
    if (this.onlyContainsCACerts !== IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_CA_CERTS)) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      valueHex: new Uint8Array([255]).buffer
    }));
    if (this.onlySomeReasons !== void 0) {
      const buffer = /* @__PURE__ */ new ArrayBuffer(1);
      const view = new Uint8Array(buffer);
      view[0] = this.onlySomeReasons;
      outputArray.push(new Primitive({
        idBlock: {
          tagClass: 3,
          tagNumber: 3
        },
        valueHex: buffer
      }));
    }
    if (this.indirectCRL !== IssuingDistributionPoint2.defaultValues(INDIRECT_CRL)) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 4
      },
      valueHex: new Uint8Array([255]).buffer
    }));
    if (this.onlyContainsAttributeCerts !== IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_ATTRIBUTE_CERTS)) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 5
      },
      valueHex: new Uint8Array([255]).buffer
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const obj = {};
    if (this.distributionPoint) {
      if (this.distributionPoint instanceof Array) obj.distributionPoint = Array.from(this.distributionPoint, (o) => o.toJSON());
      else obj.distributionPoint = this.distributionPoint.toJSON();
    }
    if (this.onlyContainsUserCerts !== IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_USER_CERTS)) obj.onlyContainsUserCerts = this.onlyContainsUserCerts;
    if (this.onlyContainsCACerts !== IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_CA_CERTS)) obj.onlyContainsCACerts = this.onlyContainsCACerts;
    if (ONLY_SOME_REASON in this) obj.onlySomeReasons = this.onlySomeReasons;
    if (this.indirectCRL !== IssuingDistributionPoint2.defaultValues(INDIRECT_CRL)) obj.indirectCRL = this.indirectCRL;
    if (this.onlyContainsAttributeCerts !== IssuingDistributionPoint2.defaultValues(ONLY_CONTAINS_ATTRIBUTE_CERTS)) obj.onlyContainsAttributeCerts = this.onlyContainsAttributeCerts;
    return obj;
  }
};
var BASE = "base";
var MINIMUM = "minimum";
var MAXIMUM = "maximum";
var CLEAR_PROPS$81 = [
  BASE,
  MINIMUM,
  MAXIMUM
];
var GeneralSubtree = class GeneralSubtree2 extends PkiObject {
  static {
    this.CLASS_NAME = "GeneralSubtree";
  }
  constructor(parameters = {}) {
    super();
    this.base = parameters[BASE] ?? GeneralSubtree2.defaultValues(BASE);
    this.minimum = parameters[MINIMUM] ?? GeneralSubtree2.defaultValues(MINIMUM);
    if (MAXIMUM in parameters) this.maximum = parameters[MAXIMUM] ?? GeneralSubtree2.defaultValues(MAXIMUM);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case BASE:
        return new GeneralName();
      case MINIMUM:
        return 0;
      case MAXIMUM:
        return 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        GeneralName.schema(names.base || {}),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Integer({ name: names.minimum || "" })]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new Integer({ name: names.maximum || "" })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$81) delete schema[prop];
    const asn1 = compareSchema(schema, schema, GeneralSubtree2.schema({ names: {
      base: { names: { blockName: BASE } },
      minimum: MINIMUM,
      maximum: MAXIMUM
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.base = new GeneralName({ schema: asn1.result.base });
    if (MINIMUM in asn1.result) {
      if (asn1.result.minimum.valueBlock.isHexOnly) this.minimum = asn1.result.minimum;
      else this.minimum = asn1.result.minimum.valueBlock.valueDec;
    }
    if (MAXIMUM in asn1.result) {
      if (asn1.result.maximum.valueBlock.isHexOnly) this.maximum = asn1.result.maximum;
      else this.maximum = asn1.result.maximum.valueBlock.valueDec;
    }
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.base.toSchema());
    if (this.minimum !== 0) {
      let valueMinimum = 0;
      if (this.minimum instanceof Integer) valueMinimum = this.minimum;
      else valueMinimum = new Integer({ value: this.minimum });
      outputArray.push(new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [valueMinimum]
      }));
    }
    if (MAXIMUM in this) {
      let valueMaximum = 0;
      if (this.maximum instanceof Integer) valueMaximum = this.maximum;
      else valueMaximum = new Integer({ value: this.maximum });
      outputArray.push(new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: [valueMaximum]
      }));
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { base: this.base.toJSON() };
    if (this.minimum !== 0) {
      if (typeof this.minimum === "number") res.minimum = this.minimum;
      else res.minimum = this.minimum.toJSON();
    }
    if (this.maximum !== void 0) {
      if (typeof this.maximum === "number") res.maximum = this.maximum;
      else res.maximum = this.maximum.toJSON();
    }
    return res;
  }
};
var PERMITTED_SUBTREES = "permittedSubtrees";
var EXCLUDED_SUBTREES = "excludedSubtrees";
var CLEAR_PROPS$80 = [PERMITTED_SUBTREES, EXCLUDED_SUBTREES];
var NameConstraints = class NameConstraints2 extends PkiObject {
  static {
    this.CLASS_NAME = "NameConstraints";
  }
  constructor(parameters = {}) {
    super();
    if (PERMITTED_SUBTREES in parameters) this.permittedSubtrees = parameters[PERMITTED_SUBTREES] ?? NameConstraints2.defaultValues(PERMITTED_SUBTREES);
    if (EXCLUDED_SUBTREES in parameters) this.excludedSubtrees = parameters[EXCLUDED_SUBTREES] ?? NameConstraints2.defaultValues(EXCLUDED_SUBTREES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case PERMITTED_SUBTREES:
      case EXCLUDED_SUBTREES:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Repeated({
          name: names.permittedSubtrees || "",
          value: GeneralSubtree.schema()
        })]
      }), new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: [new Repeated({
          name: names.excludedSubtrees || "",
          value: GeneralSubtree.schema()
        })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$80) delete schema[prop];
    const asn1 = compareSchema(schema, schema, NameConstraints2.schema({ names: {
      permittedSubtrees: PERMITTED_SUBTREES,
      excludedSubtrees: EXCLUDED_SUBTREES
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (PERMITTED_SUBTREES in asn1.result) this.permittedSubtrees = Array.from(asn1.result.permittedSubtrees, (element) => new GeneralSubtree({ schema: element }));
    if (EXCLUDED_SUBTREES in asn1.result) this.excludedSubtrees = Array.from(asn1.result.excludedSubtrees, (element) => new GeneralSubtree({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    if (this.permittedSubtrees) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: Array.from(this.permittedSubtrees, (o) => o.toSchema())
    }));
    if (this.excludedSubtrees) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: Array.from(this.excludedSubtrees, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const object = {};
    if (this.permittedSubtrees) object.permittedSubtrees = Array.from(this.permittedSubtrees, (o) => o.toJSON());
    if (this.excludedSubtrees) object.excludedSubtrees = Array.from(this.excludedSubtrees, (o) => o.toJSON());
    return object;
  }
};
var REQUIRE_EXPLICIT_POLICY = "requireExplicitPolicy";
var INHIBIT_POLICY_MAPPING = "inhibitPolicyMapping";
var CLEAR_PROPS$79 = [REQUIRE_EXPLICIT_POLICY, INHIBIT_POLICY_MAPPING];
var PolicyConstraints = class PolicyConstraints2 extends PkiObject {
  static {
    this.CLASS_NAME = "PolicyConstraints";
  }
  constructor(parameters = {}) {
    super();
    if (REQUIRE_EXPLICIT_POLICY in parameters) this.requireExplicitPolicy = parameters[REQUIRE_EXPLICIT_POLICY] ?? PolicyConstraints2.defaultValues(REQUIRE_EXPLICIT_POLICY);
    if (INHIBIT_POLICY_MAPPING in parameters) this.inhibitPolicyMapping = parameters[INHIBIT_POLICY_MAPPING] ?? PolicyConstraints2.defaultValues(INHIBIT_POLICY_MAPPING);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case REQUIRE_EXPLICIT_POLICY:
        return 0;
      case INHIBIT_POLICY_MAPPING:
        return 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Primitive({
        name: names.requireExplicitPolicy || "",
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        }
      }), new Primitive({
        name: names.inhibitPolicyMapping || "",
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        }
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$79) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PolicyConstraints2.schema({ names: {
      requireExplicitPolicy: REQUIRE_EXPLICIT_POLICY,
      inhibitPolicyMapping: INHIBIT_POLICY_MAPPING
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (REQUIRE_EXPLICIT_POLICY in asn1.result) {
      const field1 = asn1.result.requireExplicitPolicy;
      field1.idBlock.tagClass = 1;
      field1.idBlock.tagNumber = 2;
      const ber1 = field1.toBER(false);
      const int1 = fromBER(ber1);
      AsnError.assert(int1, "Integer");
      this.requireExplicitPolicy = int1.result.valueBlock.valueDec;
    }
    if (INHIBIT_POLICY_MAPPING in asn1.result) {
      const field2 = asn1.result.inhibitPolicyMapping;
      field2.idBlock.tagClass = 1;
      field2.idBlock.tagNumber = 2;
      const ber2 = field2.toBER(false);
      const int2 = fromBER(ber2);
      AsnError.assert(int2, "Integer");
      this.inhibitPolicyMapping = int2.result.valueBlock.valueDec;
    }
  }
  toSchema() {
    const outputArray = [];
    if (REQUIRE_EXPLICIT_POLICY in this) {
      const int1 = new Integer({ value: this.requireExplicitPolicy });
      int1.idBlock.tagClass = 3;
      int1.idBlock.tagNumber = 0;
      outputArray.push(int1);
    }
    if (INHIBIT_POLICY_MAPPING in this) {
      const int2 = new Integer({ value: this.inhibitPolicyMapping });
      int2.idBlock.tagClass = 3;
      int2.idBlock.tagNumber = 1;
      outputArray.push(int2);
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {};
    if (REQUIRE_EXPLICIT_POLICY in this) res.requireExplicitPolicy = this.requireExplicitPolicy;
    if (INHIBIT_POLICY_MAPPING in this) res.inhibitPolicyMapping = this.inhibitPolicyMapping;
    return res;
  }
};
var ISSUER_DOMAIN_POLICY = "issuerDomainPolicy";
var SUBJECT_DOMAIN_POLICY = "subjectDomainPolicy";
var CLEAR_PROPS$78 = [ISSUER_DOMAIN_POLICY, SUBJECT_DOMAIN_POLICY];
var PolicyMapping = class PolicyMapping2 extends PkiObject {
  static {
    this.CLASS_NAME = "PolicyMapping";
  }
  constructor(parameters = {}) {
    super();
    this.issuerDomainPolicy = parameters[ISSUER_DOMAIN_POLICY] ?? PolicyMapping2.defaultValues(ISSUER_DOMAIN_POLICY);
    this.subjectDomainPolicy = parameters[SUBJECT_DOMAIN_POLICY] ?? PolicyMapping2.defaultValues(SUBJECT_DOMAIN_POLICY);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ISSUER_DOMAIN_POLICY:
        return "";
      case SUBJECT_DOMAIN_POLICY:
        return "";
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.issuerDomainPolicy || "" }), new ObjectIdentifier({ name: names.subjectDomainPolicy || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$78) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PolicyMapping2.schema({ names: {
      issuerDomainPolicy: ISSUER_DOMAIN_POLICY,
      subjectDomainPolicy: SUBJECT_DOMAIN_POLICY
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.issuerDomainPolicy = asn1.result.issuerDomainPolicy.valueBlock.toString();
    this.subjectDomainPolicy = asn1.result.subjectDomainPolicy.valueBlock.toString();
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.issuerDomainPolicy }), new ObjectIdentifier({ value: this.subjectDomainPolicy })] });
  }
  toJSON() {
    return {
      issuerDomainPolicy: this.issuerDomainPolicy,
      subjectDomainPolicy: this.subjectDomainPolicy
    };
  }
};
var MAPPINGS = "mappings";
var CLEAR_PROPS$77 = [MAPPINGS];
var PolicyMappings = class PolicyMappings2 extends PkiObject {
  static {
    this.CLASS_NAME = "PolicyMappings";
  }
  constructor(parameters = {}) {
    super();
    this.mappings = parameters[MAPPINGS] ?? PolicyMappings2.defaultValues(MAPPINGS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case MAPPINGS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.mappings || "",
        value: PolicyMapping.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$77) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PolicyMappings2.schema({ names: { mappings: MAPPINGS } }));
    AsnError.assertSchema(asn1, this.className);
    this.mappings = Array.from(asn1.result.mappings, (element) => new PolicyMapping({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.mappings, (o) => o.toSchema()) });
  }
  toJSON() {
    return { mappings: Array.from(this.mappings, (o) => o.toJSON()) };
  }
};
var NOT_BEFORE$1 = "notBefore";
var NOT_AFTER$1 = "notAfter";
var CLEAR_PROPS$76 = [NOT_BEFORE$1, NOT_AFTER$1];
var PrivateKeyUsagePeriod = class PrivateKeyUsagePeriod2 extends PkiObject {
  static {
    this.CLASS_NAME = "PrivateKeyUsagePeriod";
  }
  constructor(parameters = {}) {
    super();
    if (NOT_BEFORE$1 in parameters) this.notBefore = parameters[NOT_BEFORE$1] ?? PrivateKeyUsagePeriod2.defaultValues(NOT_BEFORE$1);
    if (NOT_AFTER$1 in parameters) this.notAfter = parameters[NOT_AFTER$1] ?? PrivateKeyUsagePeriod2.defaultValues(NOT_AFTER$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case NOT_BEFORE$1:
        return /* @__PURE__ */ new Date();
      case NOT_AFTER$1:
        return /* @__PURE__ */ new Date();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Primitive({
        name: names.notBefore || "",
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        }
      }), new Primitive({
        name: names.notAfter || "",
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        }
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$76) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PrivateKeyUsagePeriod2.schema({ names: {
      notBefore: NOT_BEFORE$1,
      notAfter: NOT_AFTER$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (NOT_BEFORE$1 in asn1.result) {
      const localNotBefore = new GeneralizedTime();
      localNotBefore.fromBuffer(asn1.result.notBefore.valueBlock.valueHex);
      this.notBefore = localNotBefore.toDate();
    }
    if (NOT_AFTER$1 in asn1.result) {
      const localNotAfter = new GeneralizedTime({ valueHex: asn1.result.notAfter.valueBlock.valueHex });
      localNotAfter.fromBuffer(asn1.result.notAfter.valueBlock.valueHex);
      this.notAfter = localNotAfter.toDate();
    }
  }
  toSchema() {
    const outputArray = [];
    if (NOT_BEFORE$1 in this) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      valueHex: new GeneralizedTime({ valueDate: this.notBefore }).valueBlock.valueHexView
    }));
    if (NOT_AFTER$1 in this) outputArray.push(new Primitive({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      valueHex: new GeneralizedTime({ valueDate: this.notAfter }).valueBlock.valueHexView
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {};
    if (this.notBefore) res.notBefore = this.notBefore;
    if (this.notAfter) res.notAfter = this.notAfter;
    return res;
  }
};
var ID = "id";
var TYPE$3 = "type";
var VALUES = "values";
var QC_STATEMENT_CLEAR_PROPS = [ID, TYPE$3];
var QC_STATEMENTS_CLEAR_PROPS = [VALUES];
var QCStatement = class QCStatement2 extends PkiObject {
  static {
    this.CLASS_NAME = "QCStatement";
  }
  constructor(parameters = {}) {
    super();
    this.id = parameters[ID] ?? QCStatement2.defaultValues(ID);
    if (TYPE$3 in parameters) this.type = parameters[TYPE$3] ?? QCStatement2.defaultValues(TYPE$3);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ID:
        return "";
      case TYPE$3:
        return new Null();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case ID:
        return memberValue === "";
      case TYPE$3:
        return memberValue instanceof Null;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.id || "" }), new Any({
        name: names.type || "",
        optional: true
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of QC_STATEMENT_CLEAR_PROPS) delete schema[prop];
    const asn1 = compareSchema(schema, schema, QCStatement2.schema({ names: {
      id: ID,
      type: TYPE$3
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.id = asn1.result.id.valueBlock.toString();
    if (TYPE$3 in asn1.result) this.type = asn1.result.type;
  }
  toSchema() {
    const value = [new ObjectIdentifier({ value: this.id })];
    if (TYPE$3 in this) value.push(this.type);
    return new Sequence({ value });
  }
  toJSON() {
    const object = { id: this.id };
    if (this.type) object.type = this.type.toJSON();
    return object;
  }
};
var QCStatements = class QCStatements2 extends PkiObject {
  static {
    this.CLASS_NAME = "QCStatements";
  }
  constructor(parameters = {}) {
    super();
    this.values = parameters[VALUES] ?? QCStatements2.defaultValues(VALUES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VALUES:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VALUES:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.values || "",
        value: QCStatement.schema(names.value || {})
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of QC_STATEMENTS_CLEAR_PROPS) delete schema[prop];
    const asn1 = compareSchema(schema, schema, QCStatements2.schema({ names: { values: VALUES } }));
    AsnError.assertSchema(asn1, this.className);
    this.values = Array.from(asn1.result.values, (element) => new QCStatement({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.values, (o) => o.toSchema()) });
  }
  toJSON() {
    return { values: Array.from(this.values, (o) => o.toJSON()) };
  }
};
var ECNamedCurves = class {
  static {
    this.namedCurves = {};
  }
  static register(name, id, size) {
    this.namedCurves[name.toLowerCase()] = this.namedCurves[id] = {
      name,
      id,
      size
    };
  }
  static find(nameOrId) {
    return this.namedCurves[nameOrId.toLowerCase()] || null;
  }
  static {
    this.register("P-256", "1.2.840.10045.3.1.7", 32);
    this.register("P-384", "1.3.132.0.34", 48);
    this.register("P-521", "1.3.132.0.35", 66);
    this.register("brainpoolP256r1", "1.3.36.3.3.2.8.1.1.7", 32);
    this.register("brainpoolP384r1", "1.3.36.3.3.2.8.1.1.11", 48);
    this.register("brainpoolP512r1", "1.3.36.3.3.2.8.1.1.13", 64);
  }
};
var X = "x";
var Y = "y";
var NAMED_CURVE$1 = "namedCurve";
var ECPublicKey = class ECPublicKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "ECPublicKey";
  }
  constructor(parameters = {}) {
    super();
    this.x = parameters[X] ?? ECPublicKey2.defaultValues(X);
    this.y = parameters[Y] ?? ECPublicKey2.defaultValues(Y);
    this.namedCurve = parameters[NAMED_CURVE$1] ?? ECPublicKey2.defaultValues(NAMED_CURVE$1);
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case X:
      case Y:
        return EMPTY_BUFFER2;
      case NAMED_CURVE$1:
        return "";
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case X:
      case Y:
        return memberValue instanceof ArrayBuffer && bytes_exports.equal(memberValue, ECPublicKey2.defaultValues(memberName));
      case NAMED_CURVE$1:
        return typeof memberValue === "string" && memberValue === ECPublicKey2.defaultValues(memberName);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema() {
    return new RawData();
  }
  fromSchema(schema1) {
    const view = toUint8Array(schema1);
    if (view[0] !== 4) throw new Error("Object's schema was not verified against input data for ECPublicKey");
    const namedCurve = ECNamedCurves.find(this.namedCurve);
    if (!namedCurve) throw new Error(`Incorrect curve OID: ${this.namedCurve}`);
    const coordinateLength = namedCurve.size;
    if (view.byteLength !== coordinateLength * 2 + 1) throw new Error("Object's schema was not verified against input data for ECPublicKey");
    this.namedCurve = namedCurve.name;
    this.x = view.slice(1, coordinateLength + 1).buffer;
    this.y = view.slice(1 + coordinateLength, coordinateLength * 2 + 1).buffer;
  }
  toSchema() {
    return new RawData({ data: bytes_exports.concat(new Uint8Array([4]), this.x, this.y) });
  }
  toJSON() {
    const namedCurve = ECNamedCurves.find(this.namedCurve);
    return {
      crv: namedCurve ? namedCurve.name : this.namedCurve,
      x: base64url_exports.encode(this.x),
      y: base64url_exports.encode(this.y)
    };
  }
  fromJSON(json) {
    ParameterError.assert("json", json, "crv", "x", "y");
    let coordinateLength = 0;
    const namedCurve = ECNamedCurves.find(json.crv);
    if (namedCurve) {
      this.namedCurve = namedCurve.id;
      coordinateLength = namedCurve.size;
    }
    const xConvertBuffer = base64url_exports.decode(json.x, { allowPadding: true });
    if (xConvertBuffer.byteLength < coordinateLength) {
      this.x = new ArrayBuffer(coordinateLength);
      const view = new Uint8Array(this.x);
      const convertBufferView = new Uint8Array(xConvertBuffer);
      view.set(convertBufferView, 1);
    } else this.x = xConvertBuffer.slice(0, coordinateLength).buffer;
    const yConvertBuffer = base64url_exports.decode(json.y, { allowPadding: true });
    if (yConvertBuffer.byteLength < coordinateLength) {
      this.y = new ArrayBuffer(coordinateLength);
      const view = new Uint8Array(this.y);
      const convertBufferView = new Uint8Array(yConvertBuffer);
      view.set(convertBufferView, 1);
    } else this.y = yConvertBuffer.slice(0, coordinateLength).buffer;
  }
};
var MODULUS$1 = "modulus";
var PUBLIC_EXPONENT$1 = "publicExponent";
var CLEAR_PROPS$75 = [MODULUS$1, PUBLIC_EXPONENT$1];
var RSAPublicKey = class RSAPublicKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "RSAPublicKey";
  }
  constructor(parameters = {}) {
    super();
    this.modulus = parameters[MODULUS$1] ?? RSAPublicKey2.defaultValues(MODULUS$1);
    this.publicExponent = parameters[PUBLIC_EXPONENT$1] ?? RSAPublicKey2.defaultValues(PUBLIC_EXPONENT$1);
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case MODULUS$1:
        return new Integer();
      case PUBLIC_EXPONENT$1:
        return new Integer();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Integer({ name: names.modulus || "" }), new Integer({ name: names.publicExponent || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$75) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RSAPublicKey2.schema({ names: {
      modulus: MODULUS$1,
      publicExponent: PUBLIC_EXPONENT$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.modulus = asn1.result.modulus.convertFromDER(256);
    this.publicExponent = asn1.result.publicExponent.convertFromDER();
  }
  toSchema() {
    return new Sequence({ value: [this.modulus.convertToDER(), this.publicExponent.convertToDER()] });
  }
  toJSON() {
    return {
      n: base64url_exports.encode(this.modulus.valueBlock.valueHexView),
      e: base64url_exports.encode(this.publicExponent.valueBlock.valueHexView)
    };
  }
  fromJSON(json) {
    ParameterError.assert("json", json, "n", "e");
    this.modulus = new Integer({ valueHex: base64url_exports.decode(json.n, { allowPadding: true }) });
    this.publicExponent = new Integer({ valueHex: base64url_exports.decode(json.e, { allowPadding: true }) });
  }
};
var ALGORITHM$1 = "algorithm";
var SUBJECT_PUBLIC_KEY = "subjectPublicKey";
var CLEAR_PROPS$74 = [ALGORITHM$1, SUBJECT_PUBLIC_KEY];
var PublicKeyInfo = class PublicKeyInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "PublicKeyInfo";
  }
  get parsedKey() {
    if (this._parsedKey === void 0) {
      switch (this.algorithm.algorithmId) {
        case "1.2.840.10045.2.1":
          if ("algorithmParams" in this.algorithm) {
            if (this.algorithm.algorithmParams.constructor.blockName() === ObjectIdentifier.blockName()) try {
              this._parsedKey = new ECPublicKey({
                namedCurve: this.algorithm.algorithmParams.valueBlock.toString(),
                schema: this.subjectPublicKey.valueBlock.valueHexView
              });
            } catch {
            }
          }
          break;
        case "1.2.840.113549.1.1.1":
        case "1.2.840.113549.1.1.10": {
          const publicKeyASN1 = fromBER(this.subjectPublicKey.valueBlock.valueHexView);
          if (publicKeyASN1.offset !== -1) try {
            this._parsedKey = new RSAPublicKey({ schema: publicKeyASN1.result });
          } catch {
          }
        }
      }
      this._parsedKey ||= null;
    }
    return this._parsedKey || void 0;
  }
  set parsedKey(value) {
    this._parsedKey = value;
  }
  constructor(parameters = {}) {
    super();
    this.algorithm = parameters[ALGORITHM$1] ?? PublicKeyInfo2.defaultValues(ALGORITHM$1);
    this.subjectPublicKey = parameters[SUBJECT_PUBLIC_KEY] ?? PublicKeyInfo2.defaultValues(SUBJECT_PUBLIC_KEY);
    const parsedKey = parameters.parsedKey ?? null;
    if (parsedKey) this.parsedKey = parsedKey;
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ALGORITHM$1:
        return new AlgorithmIdentifier();
      case SUBJECT_PUBLIC_KEY:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [AlgorithmIdentifier.schema(names.algorithm || {}), new BitString({ name: names.subjectPublicKey || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$74) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PublicKeyInfo2.schema({ names: {
      algorithm: { names: { blockName: ALGORITHM$1 } },
      subjectPublicKey: SUBJECT_PUBLIC_KEY
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.algorithm = new AlgorithmIdentifier({ schema: asn1.result.algorithm });
    this.subjectPublicKey = asn1.result.subjectPublicKey;
  }
  toSchema() {
    return new Sequence({ value: [this.algorithm.toSchema(), this.subjectPublicKey] });
  }
  toJSON() {
    if (!this.parsedKey) return {
      algorithm: this.algorithm.toJSON(),
      subjectPublicKey: this.subjectPublicKey.toJSON()
    };
    const jwk = {};
    switch (this.algorithm.algorithmId) {
      case "1.2.840.10045.2.1":
        jwk.kty = "EC";
        break;
      case "1.2.840.113549.1.1.1":
      case "1.2.840.113549.1.1.10":
        jwk.kty = "RSA";
    }
    const publicKeyJWK = this.parsedKey.toJSON();
    Object.assign(jwk, publicKeyJWK);
    return jwk;
  }
  fromJSON(json) {
    if ("kty" in json) {
      switch (json.kty.toUpperCase()) {
        case "EC":
          this.parsedKey = new ECPublicKey({ json });
          this.algorithm = new AlgorithmIdentifier({
            algorithmId: "1.2.840.10045.2.1",
            algorithmParams: new ObjectIdentifier({ value: this.parsedKey.namedCurve })
          });
          break;
        case "RSA":
          this.parsedKey = new RSAPublicKey({ json });
          this.algorithm = new AlgorithmIdentifier({
            algorithmId: "1.2.840.113549.1.1.1",
            algorithmParams: new Null()
          });
          break;
        default:
          throw new Error(`Invalid value for "kty" parameter: ${json.kty}`);
      }
      this.subjectPublicKey = new BitString({ valueHex: this.parsedKey.toSchema().toBER(false) });
    }
  }
  async importKey(publicKey, crypto2 = getCrypto(true)) {
    try {
      if (!publicKey) throw new Error("Need to provide publicKey input parameter");
      const exportedKey = await crypto2.exportKey("spki", publicKey);
      const asn1 = fromBER(exportedKey);
      try {
        this.fromSchema(asn1.result);
      } catch {
        throw new Error("Error during initializing object from schema");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : `${e}`;
      throw new Error(`Error during exporting public key: ${message}`);
    }
  }
};
var VERSION$21 = "version";
var PRIVATE_KEY$1 = "privateKey";
var NAMED_CURVE = "namedCurve";
var PUBLIC_KEY$1 = "publicKey";
var CLEAR_PROPS$73 = [
  VERSION$21,
  PRIVATE_KEY$1,
  NAMED_CURVE,
  PUBLIC_KEY$1
];
var ECPrivateKey = class ECPrivateKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "ECPrivateKey";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$21] ?? ECPrivateKey2.defaultValues(VERSION$21);
    this.privateKey = parameters[PRIVATE_KEY$1] ?? ECPrivateKey2.defaultValues(PRIVATE_KEY$1);
    if (NAMED_CURVE in parameters) this.namedCurve = parameters[NAMED_CURVE] ?? ECPrivateKey2.defaultValues(NAMED_CURVE);
    if (PUBLIC_KEY$1 in parameters) this.publicKey = parameters[PUBLIC_KEY$1] ?? ECPrivateKey2.defaultValues(PUBLIC_KEY$1);
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$21:
        return 1;
      case PRIVATE_KEY$1:
        return new OctetString();
      case NAMED_CURVE:
        return "";
      case PUBLIC_KEY$1:
        return new ECPublicKey();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$21:
        return memberValue === ECPrivateKey2.defaultValues(memberName);
      case PRIVATE_KEY$1:
        return memberValue.isEqual(ECPrivateKey2.defaultValues(memberName));
      case NAMED_CURVE:
        return memberValue === "";
      case PUBLIC_KEY$1:
        return ECPublicKey.compareWithDefault(NAMED_CURVE, memberValue.namedCurve) && ECPublicKey.compareWithDefault("x", memberValue.x) && ECPublicKey.compareWithDefault("y", memberValue.y);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        new OctetString({ name: names.privateKey || "" }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new ObjectIdentifier({ name: names.namedCurve || "" })]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new BitString({ name: names.publicKey || "" })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$73) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ECPrivateKey2.schema({ names: {
      version: VERSION$21,
      privateKey: PRIVATE_KEY$1,
      namedCurve: NAMED_CURVE,
      publicKey: PUBLIC_KEY$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.privateKey = asn1.result.privateKey;
    if (NAMED_CURVE in asn1.result) this.namedCurve = asn1.result.namedCurve.valueBlock.toString();
    if (PUBLIC_KEY$1 in asn1.result) {
      const publicKeyData = { schema: asn1.result.publicKey.valueBlock.valueHex };
      if (NAMED_CURVE in this) publicKeyData.namedCurve = this.namedCurve;
      this.publicKey = new ECPublicKey(publicKeyData);
    }
  }
  toSchema() {
    const outputArray = [new Integer({ value: this.version }), this.privateKey];
    if (this.namedCurve) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [new ObjectIdentifier({ value: this.namedCurve })]
    }));
    if (this.publicKey) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: [new BitString({ valueHex: this.publicKey.toSchema().toBER(false) })]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    if (!this.namedCurve || ECPrivateKey2.compareWithDefault(NAMED_CURVE, this.namedCurve)) throw new Error('Not enough information for making JSON: absent "namedCurve" value');
    const curve = ECNamedCurves.find(this.namedCurve);
    const privateKeyJSON = {
      crv: curve ? curve.name : this.namedCurve,
      d: base64url_exports.encode(this.privateKey.valueBlock.valueHexView)
    };
    if (this.publicKey) {
      const publicKeyJSON = this.publicKey.toJSON();
      privateKeyJSON.x = publicKeyJSON.x;
      privateKeyJSON.y = publicKeyJSON.y;
    }
    return privateKeyJSON;
  }
  fromJSON(json) {
    ParameterError.assert("json", json, "crv", "d");
    let coordinateLength = 0;
    const curve = ECNamedCurves.find(json.crv);
    if (curve) {
      this.namedCurve = curve.id;
      coordinateLength = curve.size;
    }
    const convertBuffer = base64url_exports.decode(json.d);
    if (convertBuffer.byteLength < coordinateLength) {
      const buffer = new ArrayBuffer(coordinateLength);
      const view = new Uint8Array(buffer);
      const convertBufferView = new Uint8Array(convertBuffer);
      view.set(convertBufferView, 1);
      this.privateKey = new OctetString({ valueHex: buffer });
    } else this.privateKey = new OctetString({ valueHex: convertBuffer.slice(0, coordinateLength) });
    if (json.x && json.y) this.publicKey = new ECPublicKey({ json });
  }
};
var PRIME = "prime";
var EXPONENT = "exponent";
var COEFFICIENT$1 = "coefficient";
var CLEAR_PROPS$72 = [
  PRIME,
  EXPONENT,
  COEFFICIENT$1
];
var OtherPrimeInfo = class OtherPrimeInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "OtherPrimeInfo";
  }
  constructor(parameters = {}) {
    super();
    this.prime = parameters[PRIME] ?? OtherPrimeInfo2.defaultValues(PRIME);
    this.exponent = parameters[EXPONENT] ?? OtherPrimeInfo2.defaultValues(EXPONENT);
    this.coefficient = parameters[COEFFICIENT$1] ?? OtherPrimeInfo2.defaultValues(COEFFICIENT$1);
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case PRIME:
        return new Integer();
      case EXPONENT:
        return new Integer();
      case COEFFICIENT$1:
        return new Integer();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.prime || "" }),
        new Integer({ name: names.exponent || "" }),
        new Integer({ name: names.coefficient || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$72) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OtherPrimeInfo2.schema({ names: {
      prime: PRIME,
      exponent: EXPONENT,
      coefficient: COEFFICIENT$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.prime = asn1.result.prime.convertFromDER();
    this.exponent = asn1.result.exponent.convertFromDER();
    this.coefficient = asn1.result.coefficient.convertFromDER();
  }
  toSchema() {
    return new Sequence({ value: [
      this.prime.convertToDER(),
      this.exponent.convertToDER(),
      this.coefficient.convertToDER()
    ] });
  }
  toJSON() {
    return {
      r: base64url_exports.encode(this.prime.valueBlock.valueHexView),
      d: base64url_exports.encode(this.exponent.valueBlock.valueHexView),
      t: base64url_exports.encode(this.coefficient.valueBlock.valueHexView)
    };
  }
  fromJSON(json) {
    ParameterError.assert("json", json, "r", "d", "r");
    this.prime = new Integer({ valueHex: base64url_exports.decode(json.r) });
    this.exponent = new Integer({ valueHex: base64url_exports.decode(json.d) });
    this.coefficient = new Integer({ valueHex: base64url_exports.decode(json.t) });
  }
};
var VERSION$20 = "version";
var MODULUS = "modulus";
var PUBLIC_EXPONENT = "publicExponent";
var PRIVATE_EXPONENT = "privateExponent";
var PRIME1 = "prime1";
var PRIME2 = "prime2";
var EXPONENT1 = "exponent1";
var EXPONENT2 = "exponent2";
var COEFFICIENT = "coefficient";
var OTHER_PRIME_INFOS = "otherPrimeInfos";
var CLEAR_PROPS$71 = [
  VERSION$20,
  MODULUS,
  PUBLIC_EXPONENT,
  PRIVATE_EXPONENT,
  PRIME1,
  PRIME2,
  EXPONENT1,
  EXPONENT2,
  COEFFICIENT,
  OTHER_PRIME_INFOS
];
var RSAPrivateKey = class RSAPrivateKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "RSAPrivateKey";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$20] ?? RSAPrivateKey2.defaultValues(VERSION$20);
    this.modulus = parameters[MODULUS] ?? RSAPrivateKey2.defaultValues(MODULUS);
    this.publicExponent = parameters[PUBLIC_EXPONENT] ?? RSAPrivateKey2.defaultValues(PUBLIC_EXPONENT);
    this.privateExponent = parameters[PRIVATE_EXPONENT] ?? RSAPrivateKey2.defaultValues(PRIVATE_EXPONENT);
    this.prime1 = parameters[PRIME1] ?? RSAPrivateKey2.defaultValues(PRIME1);
    this.prime2 = parameters[PRIME2] ?? RSAPrivateKey2.defaultValues(PRIME2);
    this.exponent1 = parameters[EXPONENT1] ?? RSAPrivateKey2.defaultValues(EXPONENT1);
    this.exponent2 = parameters[EXPONENT2] ?? RSAPrivateKey2.defaultValues(EXPONENT2);
    this.coefficient = parameters[COEFFICIENT] ?? RSAPrivateKey2.defaultValues(COEFFICIENT);
    if (OTHER_PRIME_INFOS in parameters) this.otherPrimeInfos = parameters[OTHER_PRIME_INFOS] ?? RSAPrivateKey2.defaultValues(OTHER_PRIME_INFOS);
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$20:
        return 0;
      case MODULUS:
        return new Integer();
      case PUBLIC_EXPONENT:
        return new Integer();
      case PRIVATE_EXPONENT:
        return new Integer();
      case PRIME1:
        return new Integer();
      case PRIME2:
        return new Integer();
      case EXPONENT1:
        return new Integer();
      case EXPONENT2:
        return new Integer();
      case COEFFICIENT:
        return new Integer();
      case OTHER_PRIME_INFOS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        new Integer({ name: names.modulus || "" }),
        new Integer({ name: names.publicExponent || "" }),
        new Integer({ name: names.privateExponent || "" }),
        new Integer({ name: names.prime1 || "" }),
        new Integer({ name: names.prime2 || "" }),
        new Integer({ name: names.exponent1 || "" }),
        new Integer({ name: names.exponent2 || "" }),
        new Integer({ name: names.coefficient || "" }),
        new Sequence({
          optional: true,
          value: [new Repeated({
            name: names.otherPrimeInfosName || "",
            value: OtherPrimeInfo.schema(names.otherPrimeInfo || {})
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$71) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RSAPrivateKey2.schema({ names: {
      version: VERSION$20,
      modulus: MODULUS,
      publicExponent: PUBLIC_EXPONENT,
      privateExponent: PRIVATE_EXPONENT,
      prime1: PRIME1,
      prime2: PRIME2,
      exponent1: EXPONENT1,
      exponent2: EXPONENT2,
      coefficient: COEFFICIENT,
      otherPrimeInfo: { names: { blockName: OTHER_PRIME_INFOS } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.modulus = asn1.result.modulus.convertFromDER(256);
    this.publicExponent = asn1.result.publicExponent;
    this.privateExponent = asn1.result.privateExponent.convertFromDER(256);
    this.prime1 = asn1.result.prime1.convertFromDER(128);
    this.prime2 = asn1.result.prime2.convertFromDER(128);
    this.exponent1 = asn1.result.exponent1.convertFromDER(128);
    this.exponent2 = asn1.result.exponent2.convertFromDER(128);
    this.coefficient = asn1.result.coefficient.convertFromDER(128);
    if (OTHER_PRIME_INFOS in asn1.result) this.otherPrimeInfos = Array.from(asn1.result.otherPrimeInfos, (element) => new OtherPrimeInfo({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    outputArray.push(this.modulus.convertToDER());
    outputArray.push(this.publicExponent);
    outputArray.push(this.privateExponent.convertToDER());
    outputArray.push(this.prime1.convertToDER());
    outputArray.push(this.prime2.convertToDER());
    outputArray.push(this.exponent1.convertToDER());
    outputArray.push(this.exponent2.convertToDER());
    outputArray.push(this.coefficient.convertToDER());
    if (this.otherPrimeInfos) outputArray.push(new Sequence({ value: Array.from(this.otherPrimeInfos, (o) => o.toSchema()) }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const jwk = {
      n: base64url_exports.encode(this.modulus.valueBlock.valueHexView),
      e: base64url_exports.encode(this.publicExponent.valueBlock.valueHexView),
      d: base64url_exports.encode(this.privateExponent.valueBlock.valueHexView),
      p: base64url_exports.encode(this.prime1.valueBlock.valueHexView),
      q: base64url_exports.encode(this.prime2.valueBlock.valueHexView),
      dp: base64url_exports.encode(this.exponent1.valueBlock.valueHexView),
      dq: base64url_exports.encode(this.exponent2.valueBlock.valueHexView),
      qi: base64url_exports.encode(this.coefficient.valueBlock.valueHexView)
    };
    if (this.otherPrimeInfos) jwk.oth = Array.from(this.otherPrimeInfos, (o) => o.toJSON());
    return jwk;
  }
  fromJSON(json) {
    ParameterError.assert("json", json, "n", "e", "d", "p", "q", "dp", "dq", "qi");
    this.modulus = new Integer({ valueHex: base64url_exports.decode(json.n) });
    this.publicExponent = new Integer({ valueHex: base64url_exports.decode(json.e) });
    this.privateExponent = new Integer({ valueHex: base64url_exports.decode(json.d) });
    this.prime1 = new Integer({ valueHex: base64url_exports.decode(json.p) });
    this.prime2 = new Integer({ valueHex: base64url_exports.decode(json.q) });
    this.exponent1 = new Integer({ valueHex: base64url_exports.decode(json.dp) });
    this.exponent2 = new Integer({ valueHex: base64url_exports.decode(json.dq) });
    this.coefficient = new Integer({ valueHex: base64url_exports.decode(json.qi) });
    if (json.oth) this.otherPrimeInfos = Array.from(json.oth, (element) => new OtherPrimeInfo({ json: element }));
  }
};
var VERSION$19 = "version";
var PRIVATE_KEY_ALGORITHM = "privateKeyAlgorithm";
var PRIVATE_KEY = "privateKey";
var ATTRIBUTES$5 = "attributes";
var PARSED_KEY = "parsedKey";
var CLEAR_PROPS$70 = [
  VERSION$19,
  PRIVATE_KEY_ALGORITHM,
  PRIVATE_KEY,
  ATTRIBUTES$5
];
var PrivateKeyInfo = class PrivateKeyInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "PrivateKeyInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$19] ?? PrivateKeyInfo2.defaultValues(VERSION$19);
    this.privateKeyAlgorithm = parameters[PRIVATE_KEY_ALGORITHM] ?? PrivateKeyInfo2.defaultValues(PRIVATE_KEY_ALGORITHM);
    this.privateKey = parameters[PRIVATE_KEY] ?? PrivateKeyInfo2.defaultValues(PRIVATE_KEY);
    if (ATTRIBUTES$5 in parameters) this.attributes = parameters[ATTRIBUTES$5] ?? PrivateKeyInfo2.defaultValues(ATTRIBUTES$5);
    if (PARSED_KEY in parameters) this.parsedKey = parameters[PARSED_KEY] ?? PrivateKeyInfo2.defaultValues(PARSED_KEY);
    if (parameters.json) this.fromJSON(parameters.json);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$19:
        return 0;
      case PRIVATE_KEY_ALGORITHM:
        return new AlgorithmIdentifier();
      case PRIVATE_KEY:
        return new OctetString();
      case ATTRIBUTES$5:
        return [];
      case PARSED_KEY:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        AlgorithmIdentifier.schema(names.privateKeyAlgorithm || {}),
        new OctetString({ name: names.privateKey || "" }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Repeated({
            name: names.attributes || "",
            value: Attribute.schema()
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$70) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PrivateKeyInfo2.schema({ names: {
      version: VERSION$19,
      privateKeyAlgorithm: { names: { blockName: PRIVATE_KEY_ALGORITHM } },
      privateKey: PRIVATE_KEY,
      attributes: ATTRIBUTES$5
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.privateKeyAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.privateKeyAlgorithm });
    this.privateKey = asn1.result.privateKey;
    if (ATTRIBUTES$5 in asn1.result) this.attributes = Array.from(asn1.result.attributes, (element) => new Attribute({ schema: element }));
    switch (this.privateKeyAlgorithm.algorithmId) {
      case "1.2.840.113549.1.1.1":
        {
          const privateKeyASN1 = fromBER(this.privateKey.valueBlock.valueHexView);
          if (privateKeyASN1.offset !== -1) this.parsedKey = new RSAPrivateKey({ schema: privateKeyASN1.result });
        }
        break;
      case "1.2.840.10045.2.1":
        if ("algorithmParams" in this.privateKeyAlgorithm) {
          if (this.privateKeyAlgorithm.algorithmParams instanceof ObjectIdentifier) {
            const privateKeyASN1 = fromBER(this.privateKey.valueBlock.valueHexView);
            if (privateKeyASN1.offset !== -1) this.parsedKey = new ECPrivateKey({
              namedCurve: this.privateKeyAlgorithm.algorithmParams.valueBlock.toString(),
              schema: privateKeyASN1.result
            });
          }
        }
    }
  }
  toSchema() {
    const outputArray = [
      new Integer({ value: this.version }),
      this.privateKeyAlgorithm.toSchema(),
      this.privateKey
    ];
    if (this.attributes) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: Array.from(this.attributes, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    if (!this.parsedKey) {
      const object = {
        version: this.version,
        privateKeyAlgorithm: this.privateKeyAlgorithm.toJSON(),
        privateKey: this.privateKey.toJSON()
      };
      if (this.attributes) object.attributes = Array.from(this.attributes, (o) => o.toJSON());
      return object;
    }
    const jwk = {};
    switch (this.privateKeyAlgorithm.algorithmId) {
      case "1.2.840.10045.2.1":
        jwk.kty = "EC";
        break;
      case "1.2.840.113549.1.1.1":
        jwk.kty = "RSA";
    }
    const publicKeyJWK = this.parsedKey.toJSON();
    Object.assign(jwk, publicKeyJWK);
    return jwk;
  }
  fromJSON(json) {
    if ("kty" in json) {
      switch (json.kty.toUpperCase()) {
        case "EC":
          this.parsedKey = new ECPrivateKey({ json });
          this.privateKeyAlgorithm = new AlgorithmIdentifier({
            algorithmId: "1.2.840.10045.2.1",
            algorithmParams: new ObjectIdentifier({ value: this.parsedKey.namedCurve })
          });
          break;
        case "RSA":
          this.parsedKey = new RSAPrivateKey({ json });
          this.privateKeyAlgorithm = new AlgorithmIdentifier({
            algorithmId: "1.2.840.113549.1.1.1",
            algorithmParams: new Null()
          });
          break;
        default:
          throw new Error(`Invalid value for "kty" parameter: ${json.kty}`);
      }
      this.privateKey = new OctetString({ valueHex: this.parsedKey.toSchema().toBER(false) });
    }
  }
};
var CONTENT_TYPE$1 = "contentType";
var CONTENT_ENCRYPTION_ALGORITHM = "contentEncryptionAlgorithm";
var ENCRYPTED_CONTENT = "encryptedContent";
var CLEAR_PROPS$69 = [
  CONTENT_TYPE$1,
  CONTENT_ENCRYPTION_ALGORITHM,
  ENCRYPTED_CONTENT
];
var PIECE_SIZE = 1024;
var EncryptedContentInfo = class EncryptedContentInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "EncryptedContentInfo";
  }
  constructor(parameters = {}) {
    super();
    this.contentType = parameters[CONTENT_TYPE$1] ?? EncryptedContentInfo2.defaultValues(CONTENT_TYPE$1);
    this.contentEncryptionAlgorithm = parameters[CONTENT_ENCRYPTION_ALGORITHM] ?? EncryptedContentInfo2.defaultValues(CONTENT_ENCRYPTION_ALGORITHM);
    if (ENCRYPTED_CONTENT in parameters && parameters.encryptedContent) {
      this.encryptedContent = parameters.encryptedContent;
      if (this.encryptedContent.idBlock.tagClass === 1 && this.encryptedContent.idBlock.tagNumber === 4) {
        if (this.encryptedContent.idBlock.isConstructed === false && !parameters.disableSplit) {
          const constrString = new OctetString({
            idBlock: { isConstructed: true },
            isConstructed: true
          });
          let offset = 0;
          const valueHex = this.encryptedContent.valueBlock.valueHexView.slice().buffer;
          let length = valueHex.byteLength;
          while (length > 0) {
            const pieceView = new Uint8Array(valueHex, offset, offset + PIECE_SIZE > valueHex.byteLength ? valueHex.byteLength - offset : PIECE_SIZE);
            const _array = new ArrayBuffer(pieceView.length);
            const _view = new Uint8Array(_array);
            for (let i = 0; i < _view.length; i++) _view[i] = pieceView[i];
            constrString.valueBlock.value.push(new OctetString({ valueHex: _array }));
            length -= pieceView.length;
            offset += pieceView.length;
          }
          this.encryptedContent = constrString;
        }
      }
    }
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CONTENT_TYPE$1:
        return "";
      case CONTENT_ENCRYPTION_ALGORITHM:
        return new AlgorithmIdentifier();
      case ENCRYPTED_CONTENT:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case CONTENT_TYPE$1:
        return memberValue === "";
      case CONTENT_ENCRYPTION_ALGORITHM:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case ENCRYPTED_CONTENT:
        return memberValue.isEqual(EncryptedContentInfo2.defaultValues(ENCRYPTED_CONTENT));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new ObjectIdentifier({ name: names.contentType || "" }),
        AlgorithmIdentifier.schema(names.contentEncryptionAlgorithm || {}),
        new Choice({ value: [new Constructed({
          name: names.encryptedContent || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Repeated({ value: new OctetString() })]
        }), new Primitive({
          name: names.encryptedContent || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          }
        })] })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$69) delete schema[prop];
    const asn1 = compareSchema(schema, schema, EncryptedContentInfo2.schema({ names: {
      contentType: CONTENT_TYPE$1,
      contentEncryptionAlgorithm: { names: { blockName: CONTENT_ENCRYPTION_ALGORITHM } },
      encryptedContent: ENCRYPTED_CONTENT
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.contentType = asn1.result.contentType.valueBlock.toString();
    this.contentEncryptionAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.contentEncryptionAlgorithm });
    if (ENCRYPTED_CONTENT in asn1.result) {
      this.encryptedContent = asn1.result.encryptedContent;
      this.encryptedContent.idBlock.tagClass = 1;
      this.encryptedContent.idBlock.tagNumber = 4;
    }
  }
  toSchema() {
    const sequenceLengthBlock = { isIndefiniteForm: false };
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.contentType }));
    outputArray.push(this.contentEncryptionAlgorithm.toSchema());
    if (this.encryptedContent) {
      sequenceLengthBlock.isIndefiniteForm = this.encryptedContent.idBlock.isConstructed;
      const encryptedValue = this.encryptedContent;
      encryptedValue.idBlock.tagClass = 3;
      encryptedValue.idBlock.tagNumber = 0;
      encryptedValue.lenBlock.isIndefiniteForm = this.encryptedContent.idBlock.isConstructed;
      outputArray.push(encryptedValue);
    }
    return new Sequence({
      lenBlock: sequenceLengthBlock,
      value: outputArray
    });
  }
  toJSON() {
    const res = {
      contentType: this.contentType,
      contentEncryptionAlgorithm: this.contentEncryptionAlgorithm.toJSON()
    };
    if (this.encryptedContent) res.encryptedContent = this.encryptedContent.toJSON();
    return res;
  }
  getEncryptedContent() {
    if (!this.encryptedContent) throw new Error("Parameter 'encryptedContent' is undefined");
    return OctetString.prototype.getValue.call(this.encryptedContent);
  }
};
var HASH_ALGORITHM$4 = "hashAlgorithm";
var MASK_GEN_ALGORITHM$1 = "maskGenAlgorithm";
var SALT_LENGTH = "saltLength";
var TRAILER_FIELD = "trailerField";
var CLEAR_PROPS$68 = [
  HASH_ALGORITHM$4,
  MASK_GEN_ALGORITHM$1,
  SALT_LENGTH,
  TRAILER_FIELD
];
var RSASSAPSSParams = class RSASSAPSSParams2 extends PkiObject {
  static {
    this.CLASS_NAME = "RSASSAPSSParams";
  }
  constructor(parameters = {}) {
    super();
    this.hashAlgorithm = parameters[HASH_ALGORITHM$4] ?? RSASSAPSSParams2.defaultValues(HASH_ALGORITHM$4);
    this.maskGenAlgorithm = parameters[MASK_GEN_ALGORITHM$1] ?? RSASSAPSSParams2.defaultValues(MASK_GEN_ALGORITHM$1);
    this.saltLength = parameters[SALT_LENGTH] ?? RSASSAPSSParams2.defaultValues(SALT_LENGTH);
    this.trailerField = parameters[TRAILER_FIELD] ?? RSASSAPSSParams2.defaultValues(TRAILER_FIELD);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case HASH_ALGORITHM$4:
        return new AlgorithmIdentifier({
          algorithmId: "1.3.14.3.2.26",
          algorithmParams: new Null()
        });
      case MASK_GEN_ALGORITHM$1:
        return new AlgorithmIdentifier({
          algorithmId: "1.2.840.113549.1.1.8",
          algorithmParams: new AlgorithmIdentifier({
            algorithmId: "1.3.14.3.2.26",
            algorithmParams: new Null()
          }).toSchema()
        });
      case SALT_LENGTH:
        return 20;
      case TRAILER_FIELD:
        return 1;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          optional: true,
          value: [AlgorithmIdentifier.schema(names.hashAlgorithm || {})]
        }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          optional: true,
          value: [AlgorithmIdentifier.schema(names.maskGenAlgorithm || {})]
        }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          optional: true,
          value: [new Integer({ name: names.saltLength || "" })]
        }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 3
          },
          optional: true,
          value: [new Integer({ name: names.trailerField || "" })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$68) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RSASSAPSSParams2.schema({ names: {
      hashAlgorithm: { names: { blockName: HASH_ALGORITHM$4 } },
      maskGenAlgorithm: { names: { blockName: MASK_GEN_ALGORITHM$1 } },
      saltLength: SALT_LENGTH,
      trailerField: TRAILER_FIELD
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (HASH_ALGORITHM$4 in asn1.result) this.hashAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.hashAlgorithm });
    if (MASK_GEN_ALGORITHM$1 in asn1.result) this.maskGenAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.maskGenAlgorithm });
    if (SALT_LENGTH in asn1.result) this.saltLength = asn1.result.saltLength.valueBlock.valueDec;
    if (TRAILER_FIELD in asn1.result) this.trailerField = asn1.result.trailerField.valueBlock.valueDec;
  }
  toSchema() {
    const outputArray = [];
    if (!this.hashAlgorithm.isEqual(RSASSAPSSParams2.defaultValues(HASH_ALGORITHM$4))) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.hashAlgorithm.toSchema()]
    }));
    if (!this.maskGenAlgorithm.isEqual(RSASSAPSSParams2.defaultValues(MASK_GEN_ALGORITHM$1))) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: [this.maskGenAlgorithm.toSchema()]
    }));
    if (this.saltLength !== RSASSAPSSParams2.defaultValues(SALT_LENGTH)) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      value: [new Integer({ value: this.saltLength })]
    }));
    if (this.trailerField !== RSASSAPSSParams2.defaultValues(TRAILER_FIELD)) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 3
      },
      value: [new Integer({ value: this.trailerField })]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {};
    if (!this.hashAlgorithm.isEqual(RSASSAPSSParams2.defaultValues(HASH_ALGORITHM$4))) res.hashAlgorithm = this.hashAlgorithm.toJSON();
    if (!this.maskGenAlgorithm.isEqual(RSASSAPSSParams2.defaultValues(MASK_GEN_ALGORITHM$1))) res.maskGenAlgorithm = this.maskGenAlgorithm.toJSON();
    if (this.saltLength !== RSASSAPSSParams2.defaultValues(SALT_LENGTH)) res.saltLength = this.saltLength;
    if (this.trailerField !== RSASSAPSSParams2.defaultValues(TRAILER_FIELD)) res.trailerField = this.trailerField;
    return res;
  }
};
var SALT = "salt";
var ITERATION_COUNT = "iterationCount";
var KEY_LENGTH = "keyLength";
var PRF = "prf";
var CLEAR_PROPS$67 = [
  SALT,
  ITERATION_COUNT,
  KEY_LENGTH,
  PRF
];
var PBKDF2Params = class PBKDF2Params2 extends PkiObject {
  static {
    this.CLASS_NAME = "PBKDF2Params";
  }
  constructor(parameters = {}) {
    super();
    this.salt = parameters[SALT] ?? PBKDF2Params2.defaultValues(SALT);
    this.iterationCount = parameters[ITERATION_COUNT] ?? PBKDF2Params2.defaultValues(ITERATION_COUNT);
    if (KEY_LENGTH in parameters) this.keyLength = parameters[KEY_LENGTH] ?? PBKDF2Params2.defaultValues(KEY_LENGTH);
    if (PRF in parameters) this.prf = parameters[PRF] ?? PBKDF2Params2.defaultValues(PRF);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SALT:
        return {};
      case ITERATION_COUNT:
        return -1;
      case KEY_LENGTH:
        return 0;
      case PRF:
        return new AlgorithmIdentifier({
          algorithmId: "1.3.14.3.2.26",
          algorithmParams: new Null()
        });
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Choice({ value: [new OctetString({ name: names.saltPrimitive || "" }), AlgorithmIdentifier.schema(names.saltConstructed || {})] }),
        new Integer({ name: names.iterationCount || "" }),
        new Integer({
          name: names.keyLength || "",
          optional: true
        }),
        AlgorithmIdentifier.schema(names.prf || { names: { optional: true } })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$67) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PBKDF2Params2.schema({ names: {
      saltPrimitive: SALT,
      saltConstructed: { names: { blockName: SALT } },
      iterationCount: ITERATION_COUNT,
      keyLength: KEY_LENGTH,
      prf: { names: {
        blockName: PRF,
        optional: true
      } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.salt = asn1.result.salt;
    this.iterationCount = asn1.result.iterationCount.valueBlock.valueDec;
    if (KEY_LENGTH in asn1.result) this.keyLength = asn1.result.keyLength.valueBlock.valueDec;
    if (PRF in asn1.result) this.prf = new AlgorithmIdentifier({ schema: asn1.result.prf });
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.salt);
    outputArray.push(new Integer({ value: this.iterationCount }));
    if (KEY_LENGTH in this) {
      if (PBKDF2Params2.defaultValues(KEY_LENGTH) !== this.keyLength) outputArray.push(new Integer({ value: this.keyLength }));
    }
    if (this.prf) {
      if (PBKDF2Params2.defaultValues(PRF).isEqual(this.prf) === false) outputArray.push(this.prf.toSchema());
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      salt: this.salt.toJSON(),
      iterationCount: this.iterationCount
    };
    if (KEY_LENGTH in this) {
      if (PBKDF2Params2.defaultValues(KEY_LENGTH) !== this.keyLength) res.keyLength = this.keyLength;
    }
    if (this.prf) {
      if (PBKDF2Params2.defaultValues(PRF).isEqual(this.prf) === false) res.prf = this.prf.toJSON();
    }
    return res;
  }
};
var KEY_DERIVATION_FUNC = "keyDerivationFunc";
var ENCRYPTION_SCHEME = "encryptionScheme";
var CLEAR_PROPS$66 = [KEY_DERIVATION_FUNC, ENCRYPTION_SCHEME];
var PBES2Params = class PBES2Params2 extends PkiObject {
  static {
    this.CLASS_NAME = "PBES2Params";
  }
  constructor(parameters = {}) {
    super();
    this.keyDerivationFunc = parameters[KEY_DERIVATION_FUNC] ?? PBES2Params2.defaultValues(KEY_DERIVATION_FUNC);
    this.encryptionScheme = parameters[ENCRYPTION_SCHEME] ?? PBES2Params2.defaultValues(ENCRYPTION_SCHEME);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case KEY_DERIVATION_FUNC:
        return new AlgorithmIdentifier();
      case ENCRYPTION_SCHEME:
        return new AlgorithmIdentifier();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [AlgorithmIdentifier.schema(names.keyDerivationFunc || {}), AlgorithmIdentifier.schema(names.encryptionScheme || {})]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$66) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PBES2Params2.schema({ names: {
      keyDerivationFunc: { names: { blockName: KEY_DERIVATION_FUNC } },
      encryptionScheme: { names: { blockName: ENCRYPTION_SCHEME } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.keyDerivationFunc = new AlgorithmIdentifier({ schema: asn1.result.keyDerivationFunc });
    this.encryptionScheme = new AlgorithmIdentifier({ schema: asn1.result.encryptionScheme });
  }
  toSchema() {
    return new Sequence({ value: [this.keyDerivationFunc.toSchema(), this.encryptionScheme.toSchema()] });
  }
  toJSON() {
    return {
      keyDerivationFunc: this.keyDerivationFunc.toJSON(),
      encryptionScheme: this.encryptionScheme.toJSON()
    };
  }
};
var AbstractCryptoEngine = class {
  constructor(parameters) {
    this.crypto = parameters.crypto;
    this.subtle = "webkitSubtle" in parameters.crypto ? parameters.crypto.webkitSubtle : parameters.crypto.subtle;
    this.name = parameters.name ?? "";
  }
  async encrypt(...args) {
    return this.subtle.encrypt(...args);
  }
  async decrypt(...args) {
    return this.subtle.decrypt(...args);
  }
  sign(...args) {
    return this.subtle.sign(...args);
  }
  async verify(...args) {
    return this.subtle.verify(...args);
  }
  async digest(...args) {
    return this.subtle.digest(...args);
  }
  async generateKey(...args) {
    return this.subtle.generateKey(...args);
  }
  async deriveKey(...args) {
    return this.subtle.deriveKey(...args);
  }
  async deriveBits(...args) {
    return this.subtle.deriveBits(...args);
  }
  async wrapKey(...args) {
    return this.subtle.wrapKey(...args);
  }
  async unwrapKey(...args) {
    return this.subtle.unwrapKey(...args);
  }
  exportKey(...args) {
    return this.subtle.exportKey(...args);
  }
  importKey(...args) {
    return this.subtle.importKey(...args);
  }
  getRandomValues(array) {
    if (array === null) throw new Error('Argument "array" must not be null');
    return this.crypto.getRandomValues(array);
  }
};
async function makePKCS12B2Key(hashAlgorithm, keyLength, password, salt, iterationCount) {
  let u;
  let v;
  let md;
  switch (hashAlgorithm.toUpperCase()) {
    case "SHA-1":
      u = 20;
      v = 64;
      md = sha1;
      break;
    case "SHA-256":
      u = 32;
      v = 64;
      md = sha256;
      break;
    case "SHA-384":
      u = 48;
      v = 128;
      md = sha384;
      break;
    case "SHA-512":
      u = 64;
      v = 128;
      md = sha512;
      break;
    default:
      throw new Error("Unsupported hashing algorithm");
  }
  const originalPassword = new Uint8Array(password);
  let decodedPassword = new TextDecoder().decode(password);
  if (new TextEncoder().encode(decodedPassword).some((byte, i) => byte !== originalPassword[i])) decodedPassword = String.fromCharCode(...originalPassword);
  const passwordTransformed = new Uint8Array(decodedPassword.length * 2 + 2);
  const passwordView = new DataView(passwordTransformed.buffer);
  for (let i = 0; i < decodedPassword.length; i++) passwordView.setUint16(i * 2, decodedPassword.charCodeAt(i), false);
  passwordView.setUint16(decodedPassword.length * 2, 0, false);
  const D = new Uint8Array(v).fill(3);
  const saltView = new Uint8Array(salt);
  const S = new Uint8Array(v * Math.ceil(saltView.length / v)).map((_, i) => saltView[i % saltView.length]);
  const P = new Uint8Array(v * Math.ceil(passwordTransformed.length / v)).map((_, i) => passwordTransformed[i % passwordTransformed.length]);
  let I = new Uint8Array(S.length + P.length);
  I.set(S);
  I.set(P, S.length);
  const c = Math.ceil((keyLength >> 3) / u);
  const result = [];
  for (let i = 0; i < c; i++) {
    let A = new Uint8Array(D.length + I.length);
    A.set(D);
    A.set(I, D.length);
    for (let j = 0; j < iterationCount; j++) A = md(A);
    const B = new Uint8Array(v).map((_, i2) => A[i2 % A.length]);
    const k = Math.ceil(saltView.length / v) + Math.ceil(passwordTransformed.length / v);
    const iRound = [];
    for (let j = 0; j < k; j++) {
      const chunk = Array.from(I.slice(j * v, (j + 1) * v));
      let x = 511;
      for (let l = B.length - 1; l >= 0; l--) {
        x >>= 8;
        x += B[l] + (chunk[l] || 0);
        chunk[l] = x & 255;
      }
      iRound.push(...chunk);
    }
    I = new Uint8Array(iRound);
    result.push(...A);
  }
  return new Uint8Array(result.slice(0, keyLength >> 3)).buffer;
}
function prepareAlgorithm(data) {
  const res = typeof data === "string" ? { name: data } : data;
  if ("hash" in res) return {
    ...res,
    hash: prepareAlgorithm(res.hash)
  };
  return res;
}
var CryptoEngine = class extends AbstractCryptoEngine {
  async importKey(format2, keyData, algorithm, extractable, keyUsages) {
    let jwk = {};
    const alg = prepareAlgorithm(algorithm);
    switch (format2.toLowerCase()) {
      case "raw":
        return this.subtle.importKey("raw", keyData, algorithm, extractable, keyUsages);
      case "spki":
        {
          const asn1 = fromBER(toArrayBuffer(keyData));
          AsnError.assert(asn1, "keyData");
          const publicKeyInfo = new PublicKeyInfo();
          try {
            publicKeyInfo.fromSchema(asn1.result);
          } catch {
            throw new ArgumentError("Incorrect keyData");
          }
          switch (alg.name.toUpperCase()) {
            case "RSA-PSS":
              {
                keyUsages = ["verify"];
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                if (!["1.2.840.113549.1.1.1", "1.2.840.113549.1.1.10"].includes(publicKeyInfo.algorithm.algorithmId)) throw new Error(`Incorrect public key algorithm: ${publicKeyInfo.algorithm.algorithmId}`);
                if (!alg.hash) throw new ParameterError("hash", "algorithm.hash", "Incorrect hash algorithm: Hash algorithm is missed");
                switch (alg.hash.name.toUpperCase()) {
                  case "SHA-1":
                    jwk.alg = "PS1";
                    break;
                  case "SHA-256":
                    jwk.alg = "PS256";
                    break;
                  case "SHA-384":
                    jwk.alg = "PS384";
                    break;
                  case "SHA-512":
                    jwk.alg = "PS512";
                    break;
                  default:
                    throw new Error(`Incorrect hash algorithm: ${alg.hash.name.toUpperCase()}`);
                }
                const rsaPssPublicKeyJSON = publicKeyInfo.toJSON();
                Object.assign(jwk, rsaPssPublicKeyJSON);
              }
              break;
            case "RSASSA-PKCS1-V1_5":
              {
                keyUsages = ["verify"];
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                if (publicKeyInfo.algorithm.algorithmId !== "1.2.840.113549.1.1.1") throw new Error(`Incorrect public key algorithm: ${publicKeyInfo.algorithm.algorithmId}`);
                if (!alg.hash) throw new ParameterError("hash", "algorithm.hash", "Incorrect hash algorithm: Hash algorithm is missed");
                switch (alg.hash.name.toUpperCase()) {
                  case "SHA-1":
                    jwk.alg = "RS1";
                    break;
                  case "SHA-256":
                    jwk.alg = "RS256";
                    break;
                  case "SHA-384":
                    jwk.alg = "RS384";
                    break;
                  case "SHA-512":
                    jwk.alg = "RS512";
                    break;
                  default:
                    throw new Error(`Incorrect hash algorithm: ${alg.hash.name.toUpperCase()}`);
                }
                const rsaPublicKeyJSON = publicKeyInfo.toJSON();
                Object.assign(jwk, rsaPublicKeyJSON);
              }
              break;
            case "ECDSA":
              keyUsages = ["verify"];
            case "ECDH":
              {
                jwk = {
                  kty: "EC",
                  ext: extractable,
                  key_ops: keyUsages
                };
                if (publicKeyInfo.algorithm.algorithmId !== "1.2.840.10045.2.1") throw new Error(`Incorrect public key algorithm: ${publicKeyInfo.algorithm.algorithmId}`);
                const publicKeyJSON = publicKeyInfo.toJSON();
                Object.assign(jwk, publicKeyJSON);
              }
              break;
            case "RSA-OAEP":
              {
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                if (this.name.toLowerCase() === "safari") jwk.alg = "RSA-OAEP";
                else {
                  if (!alg.hash) throw new ParameterError("hash", "algorithm.hash", "Incorrect hash algorithm: Hash algorithm is missed");
                  switch (alg.hash.name.toUpperCase()) {
                    case "SHA-1":
                      jwk.alg = "RSA-OAEP";
                      break;
                    case "SHA-256":
                      jwk.alg = "RSA-OAEP-256";
                      break;
                    case "SHA-384":
                      jwk.alg = "RSA-OAEP-384";
                      break;
                    case "SHA-512":
                      jwk.alg = "RSA-OAEP-512";
                      break;
                    default:
                      throw new Error(`Incorrect hash algorithm: ${alg.hash.name.toUpperCase()}`);
                  }
                }
                const publicKeyJSON = publicKeyInfo.toJSON();
                Object.assign(jwk, publicKeyJSON);
              }
              break;
            case "RSAES-PKCS1-V1_5":
              {
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                jwk.alg = "PS1";
                const publicKeyJSON = publicKeyInfo.toJSON();
                Object.assign(jwk, publicKeyJSON);
              }
              break;
            default:
              throw new Error(`Incorrect algorithm name: ${alg.name.toUpperCase()}`);
          }
        }
        break;
      case "pkcs8":
        {
          const privateKeyInfo = new PrivateKeyInfo();
          const asn1 = fromBER(toArrayBuffer(keyData));
          AsnError.assert(asn1, "keyData");
          try {
            privateKeyInfo.fromSchema(asn1.result);
          } catch {
            throw new Error("Incorrect keyData");
          }
          if (!privateKeyInfo.parsedKey) throw new Error("Incorrect keyData");
          switch (alg.name.toUpperCase()) {
            case "RSA-PSS":
              switch (alg.hash?.name.toUpperCase()) {
                case "SHA-1":
                  jwk.alg = "PS1";
                  break;
                case "SHA-256":
                  jwk.alg = "PS256";
                  break;
                case "SHA-384":
                  jwk.alg = "PS384";
                  break;
                case "SHA-512":
                  jwk.alg = "PS512";
                  break;
                default:
                  throw new Error(`Incorrect hash algorithm: ${alg.hash?.name.toUpperCase()}`);
              }
            case "RSASSA-PKCS1-V1_5":
              {
                keyUsages = ["sign"];
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                if (privateKeyInfo.privateKeyAlgorithm.algorithmId !== "1.2.840.113549.1.1.1") throw new Error(`Incorrect private key algorithm: ${privateKeyInfo.privateKeyAlgorithm.algorithmId}`);
                if ("alg" in jwk === false) switch (alg.hash?.name.toUpperCase()) {
                  case "SHA-1":
                    jwk.alg = "RS1";
                    break;
                  case "SHA-256":
                    jwk.alg = "RS256";
                    break;
                  case "SHA-384":
                    jwk.alg = "RS384";
                    break;
                  case "SHA-512":
                    jwk.alg = "RS512";
                    break;
                  default:
                    throw new Error(`Incorrect hash algorithm: ${alg.hash?.name.toUpperCase()}`);
                }
                const privateKeyJSON = privateKeyInfo.toJSON();
                Object.assign(jwk, privateKeyJSON);
              }
              break;
            case "ECDSA":
              keyUsages = ["sign"];
            case "ECDH":
              {
                jwk = {
                  kty: "EC",
                  ext: extractable,
                  key_ops: keyUsages
                };
                if (privateKeyInfo.privateKeyAlgorithm.algorithmId !== "1.2.840.10045.2.1") throw new Error(`Incorrect algorithm: ${privateKeyInfo.privateKeyAlgorithm.algorithmId}`);
                const privateKeyJSON = privateKeyInfo.toJSON();
                Object.assign(jwk, privateKeyJSON);
              }
              break;
            case "RSA-OAEP":
              {
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                if (this.name.toLowerCase() === "safari") jwk.alg = "RSA-OAEP";
                else switch (alg.hash?.name.toUpperCase()) {
                  case "SHA-1":
                    jwk.alg = "RSA-OAEP";
                    break;
                  case "SHA-256":
                    jwk.alg = "RSA-OAEP-256";
                    break;
                  case "SHA-384":
                    jwk.alg = "RSA-OAEP-384";
                    break;
                  case "SHA-512":
                    jwk.alg = "RSA-OAEP-512";
                    break;
                  default:
                    throw new Error(`Incorrect hash algorithm: ${alg.hash?.name.toUpperCase()}`);
                }
                const privateKeyJSON = privateKeyInfo.toJSON();
                Object.assign(jwk, privateKeyJSON);
              }
              break;
            case "RSAES-PKCS1-V1_5":
              {
                keyUsages = ["decrypt"];
                jwk.kty = "RSA";
                jwk.ext = extractable;
                jwk.key_ops = keyUsages;
                jwk.alg = "PS1";
                const privateKeyJSON = privateKeyInfo.toJSON();
                Object.assign(jwk, privateKeyJSON);
              }
              break;
            default:
              throw new Error(`Incorrect algorithm name: ${alg.name.toUpperCase()}`);
          }
        }
        break;
      case "jwk":
        jwk = keyData;
        break;
      default:
        throw new Error(`Incorrect format: ${format2}`);
    }
    if (this.name.toLowerCase() === "safari") try {
      return this.subtle.importKey("jwk", binary_exports.decode(JSON.stringify(jwk)).buffer, algorithm, extractable, keyUsages);
    } catch {
      return this.subtle.importKey("jwk", jwk, algorithm, extractable, keyUsages);
    }
    return this.subtle.importKey("jwk", jwk, algorithm, extractable, keyUsages);
  }
  async exportKey(format2, key) {
    let jwk = await this.subtle.exportKey("jwk", key);
    if (this.name.toLowerCase() === "safari") {
      if (jwk instanceof ArrayBuffer) jwk = JSON.parse(binary_exports.encode(jwk));
    }
    switch (format2.toLowerCase()) {
      case "raw":
        return this.subtle.exportKey("raw", key);
      case "spki": {
        const publicKeyInfo = new PublicKeyInfo();
        try {
          publicKeyInfo.fromJSON(jwk);
        } catch {
          throw new Error("Incorrect key data");
        }
        return publicKeyInfo.toSchema().toBER(false);
      }
      case "pkcs8": {
        const privateKeyInfo = new PrivateKeyInfo();
        try {
          privateKeyInfo.fromJSON(jwk);
        } catch {
          throw new Error("Incorrect key data");
        }
        return privateKeyInfo.toSchema().toBER(false);
      }
      case "jwk":
        return jwk;
      default:
        throw new Error(`Incorrect format: ${format2}`);
    }
  }
  async convert(inputFormat, outputFormat, keyData, algorithm, extractable, keyUsages) {
    if (inputFormat.toLowerCase() === outputFormat.toLowerCase()) return keyData;
    const key = await this.importKey(inputFormat, keyData, algorithm, extractable, keyUsages);
    return this.exportKey(outputFormat, key);
  }
  getAlgorithmByOID(oid, safety = false, target) {
    switch (oid) {
      case "1.2.840.113549.1.1.1":
        return { name: "RSAES-PKCS1-v1_5" };
      case "1.2.840.113549.1.1.5":
        return {
          name: "RSASSA-PKCS1-v1_5",
          hash: { name: "SHA-1" }
        };
      case "1.2.840.113549.1.1.11":
        return {
          name: "RSASSA-PKCS1-v1_5",
          hash: { name: "SHA-256" }
        };
      case "1.2.840.113549.1.1.12":
        return {
          name: "RSASSA-PKCS1-v1_5",
          hash: { name: "SHA-384" }
        };
      case "1.2.840.113549.1.1.13":
        return {
          name: "RSASSA-PKCS1-v1_5",
          hash: { name: "SHA-512" }
        };
      case "1.2.840.113549.1.1.10":
        return { name: "RSA-PSS" };
      case "1.2.840.113549.1.1.7":
        return { name: "RSA-OAEP" };
      case "1.2.840.10045.2.1":
      case "1.2.840.10045.4.1":
        return {
          name: "ECDSA",
          hash: { name: "SHA-1" }
        };
      case "1.2.840.10045.4.3.2":
        return {
          name: "ECDSA",
          hash: { name: "SHA-256" }
        };
      case "1.2.840.10045.4.3.3":
        return {
          name: "ECDSA",
          hash: { name: "SHA-384" }
        };
      case "1.2.840.10045.4.3.4":
        return {
          name: "ECDSA",
          hash: { name: "SHA-512" }
        };
      case "1.3.133.16.840.63.0.2":
        return {
          name: "ECDH",
          kdf: "SHA-1"
        };
      case "1.3.132.1.11.1":
        return {
          name: "ECDH",
          kdf: "SHA-256"
        };
      case "1.3.132.1.11.2":
        return {
          name: "ECDH",
          kdf: "SHA-384"
        };
      case "1.3.132.1.11.3":
        return {
          name: "ECDH",
          kdf: "SHA-512"
        };
      case "2.16.840.1.101.3.4.1.2":
        return {
          name: "AES-CBC",
          length: 128
        };
      case "2.16.840.1.101.3.4.1.22":
        return {
          name: "AES-CBC",
          length: 192
        };
      case "2.16.840.1.101.3.4.1.42":
        return {
          name: "AES-CBC",
          length: 256
        };
      case "2.16.840.1.101.3.4.1.6":
        return {
          name: "AES-GCM",
          length: 128
        };
      case "2.16.840.1.101.3.4.1.26":
        return {
          name: "AES-GCM",
          length: 192
        };
      case "2.16.840.1.101.3.4.1.46":
        return {
          name: "AES-GCM",
          length: 256
        };
      case "2.16.840.1.101.3.4.1.4":
        return {
          name: "AES-CFB",
          length: 128
        };
      case "2.16.840.1.101.3.4.1.24":
        return {
          name: "AES-CFB",
          length: 192
        };
      case "2.16.840.1.101.3.4.1.44":
        return {
          name: "AES-CFB",
          length: 256
        };
      case "2.16.840.1.101.3.4.1.5":
        return {
          name: "AES-KW",
          length: 128
        };
      case "2.16.840.1.101.3.4.1.25":
        return {
          name: "AES-KW",
          length: 192
        };
      case "2.16.840.1.101.3.4.1.45":
        return {
          name: "AES-KW",
          length: 256
        };
      case "1.2.840.113549.2.7":
        return {
          name: "HMAC",
          hash: { name: "SHA-1" }
        };
      case "1.2.840.113549.2.9":
        return {
          name: "HMAC",
          hash: { name: "SHA-256" }
        };
      case "1.2.840.113549.2.10":
        return {
          name: "HMAC",
          hash: { name: "SHA-384" }
        };
      case "1.2.840.113549.2.11":
        return {
          name: "HMAC",
          hash: { name: "SHA-512" }
        };
      case "1.2.840.113549.1.9.16.3.5":
        return { name: "DH" };
      case "1.3.14.3.2.26":
        return { name: "SHA-1" };
      case "2.16.840.1.101.3.4.2.1":
        return { name: "SHA-256" };
      case "2.16.840.1.101.3.4.2.2":
        return { name: "SHA-384" };
      case "2.16.840.1.101.3.4.2.3":
        return { name: "SHA-512" };
      case "1.2.840.113549.1.5.12":
        return { name: "PBKDF2" };
      case "1.2.840.10045.3.1.7":
        return { name: "P-256" };
      case "1.3.132.0.34":
        return { name: "P-384" };
      case "1.3.132.0.35":
        return { name: "P-521" };
    }
    if (safety) throw new Error(`Unsupported algorithm identifier ${target ? `for ${target} ` : ""}: ${oid}`);
    return {};
  }
  getOIDByAlgorithm(algorithm, safety = false, target) {
    let result = "";
    switch (algorithm.name.toUpperCase()) {
      case "RSAES-PKCS1-V1_5":
        result = "1.2.840.113549.1.1.1";
        break;
      case "RSASSA-PKCS1-V1_5":
        switch (algorithm.hash.name.toUpperCase()) {
          case "SHA-1":
            result = "1.2.840.113549.1.1.5";
            break;
          case "SHA-256":
            result = "1.2.840.113549.1.1.11";
            break;
          case "SHA-384":
            result = "1.2.840.113549.1.1.12";
            break;
          case "SHA-512":
            result = "1.2.840.113549.1.1.13";
        }
        break;
      case "RSA-PSS":
        result = "1.2.840.113549.1.1.10";
        break;
      case "RSA-OAEP":
        result = "1.2.840.113549.1.1.7";
        break;
      case "ECDSA":
        switch (algorithm.hash.name.toUpperCase()) {
          case "SHA-1":
            result = "1.2.840.10045.4.1";
            break;
          case "SHA-256":
            result = "1.2.840.10045.4.3.2";
            break;
          case "SHA-384":
            result = "1.2.840.10045.4.3.3";
            break;
          case "SHA-512":
            result = "1.2.840.10045.4.3.4";
        }
        break;
      case "ECDH":
        switch (algorithm.kdf.toUpperCase()) {
          case "SHA-1":
            result = "1.3.133.16.840.63.0.2";
            break;
          case "SHA-256":
            result = "1.3.132.1.11.1";
            break;
          case "SHA-384":
            result = "1.3.132.1.11.2";
            break;
          case "SHA-512":
            result = "1.3.132.1.11.3";
        }
        break;
      case "AES-CTR":
        break;
      case "AES-CBC":
        switch (algorithm.length) {
          case 128:
            result = "2.16.840.1.101.3.4.1.2";
            break;
          case 192:
            result = "2.16.840.1.101.3.4.1.22";
            break;
          case 256:
            result = "2.16.840.1.101.3.4.1.42";
        }
        break;
      case "AES-CMAC":
        break;
      case "AES-GCM":
        switch (algorithm.length) {
          case 128:
            result = "2.16.840.1.101.3.4.1.6";
            break;
          case 192:
            result = "2.16.840.1.101.3.4.1.26";
            break;
          case 256:
            result = "2.16.840.1.101.3.4.1.46";
        }
        break;
      case "AES-CFB":
        switch (algorithm.length) {
          case 128:
            result = "2.16.840.1.101.3.4.1.4";
            break;
          case 192:
            result = "2.16.840.1.101.3.4.1.24";
            break;
          case 256:
            result = "2.16.840.1.101.3.4.1.44";
        }
        break;
      case "AES-KW":
        switch (algorithm.length) {
          case 128:
            result = "2.16.840.1.101.3.4.1.5";
            break;
          case 192:
            result = "2.16.840.1.101.3.4.1.25";
            break;
          case 256:
            result = "2.16.840.1.101.3.4.1.45";
        }
        break;
      case "HMAC":
        switch (algorithm.hash.name.toUpperCase()) {
          case "SHA-1":
            result = "1.2.840.113549.2.7";
            break;
          case "SHA-256":
            result = "1.2.840.113549.2.9";
            break;
          case "SHA-384":
            result = "1.2.840.113549.2.10";
            break;
          case "SHA-512":
            result = "1.2.840.113549.2.11";
        }
        break;
      case "DH":
        result = "1.2.840.113549.1.9.16.3.5";
        break;
      case "SHA-1":
        result = "1.3.14.3.2.26";
        break;
      case "SHA-256":
        result = "2.16.840.1.101.3.4.2.1";
        break;
      case "SHA-384":
        result = "2.16.840.1.101.3.4.2.2";
        break;
      case "SHA-512":
        result = "2.16.840.1.101.3.4.2.3";
        break;
      case "CONCAT":
        break;
      case "HKDF":
        break;
      case "PBKDF2":
        result = "1.2.840.113549.1.5.12";
        break;
      case "P-256":
        result = "1.2.840.10045.3.1.7";
        break;
      case "P-384":
        result = "1.3.132.0.34";
        break;
      case "P-521":
        result = "1.3.132.0.35";
    }
    if (!result && safety) throw new Error(`Unsupported algorithm ${target ? `for ${target} ` : ""}: ${algorithm.name}`);
    return result;
  }
  getAlgorithmParameters(algorithmName, operation) {
    let result = {
      algorithm: {},
      usages: []
    };
    switch (algorithmName.toUpperCase()) {
      case "RSAES-PKCS1-V1_5":
      case "RSASSA-PKCS1-V1_5":
        switch (operation.toLowerCase()) {
          case "generatekey":
            result = {
              algorithm: {
                name: "RSASSA-PKCS1-v1_5",
                modulusLength: 2048,
                publicExponent: new Uint8Array([
                  1,
                  0,
                  1
                ]),
                hash: { name: "SHA-256" }
              },
              usages: ["sign", "verify"]
            };
            break;
          case "verify":
          case "sign":
          case "importkey":
            result = {
              algorithm: {
                name: "RSASSA-PKCS1-v1_5",
                hash: { name: "SHA-256" }
              },
              usages: ["verify"]
            };
            break;
          default:
            return {
              algorithm: { name: "RSASSA-PKCS1-v1_5" },
              usages: []
            };
        }
        break;
      case "RSA-PSS":
        switch (operation.toLowerCase()) {
          case "sign":
          case "verify":
            result = {
              algorithm: {
                name: "RSA-PSS",
                hash: { name: "SHA-1" },
                saltLength: 20
              },
              usages: ["sign", "verify"]
            };
            break;
          case "generatekey":
            result = {
              algorithm: {
                name: "RSA-PSS",
                modulusLength: 2048,
                publicExponent: new Uint8Array([
                  1,
                  0,
                  1
                ]),
                hash: { name: "SHA-1" }
              },
              usages: ["sign", "verify"]
            };
            break;
          case "importkey":
            result = {
              algorithm: {
                name: "RSA-PSS",
                hash: { name: "SHA-1" }
              },
              usages: ["verify"]
            };
            break;
          default:
            return {
              algorithm: { name: "RSA-PSS" },
              usages: []
            };
        }
        break;
      case "RSA-OAEP":
        switch (operation.toLowerCase()) {
          case "encrypt":
          case "decrypt":
            result = {
              algorithm: { name: "RSA-OAEP" },
              usages: ["encrypt", "decrypt"]
            };
            break;
          case "generatekey":
            result = {
              algorithm: {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([
                  1,
                  0,
                  1
                ]),
                hash: { name: "SHA-256" }
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          case "importkey":
            result = {
              algorithm: {
                name: "RSA-OAEP",
                hash: { name: "SHA-256" }
              },
              usages: ["encrypt"]
            };
            break;
          default:
            return {
              algorithm: { name: "RSA-OAEP" },
              usages: []
            };
        }
        break;
      case "ECDSA":
        switch (operation.toLowerCase()) {
          case "generatekey":
            result = {
              algorithm: {
                name: "ECDSA",
                namedCurve: "P-256"
              },
              usages: ["sign", "verify"]
            };
            break;
          case "importkey":
            result = {
              algorithm: {
                name: "ECDSA",
                namedCurve: "P-256"
              },
              usages: ["verify"]
            };
            break;
          case "verify":
          case "sign":
            result = {
              algorithm: {
                name: "ECDSA",
                hash: { name: "SHA-256" }
              },
              usages: ["sign"]
            };
            break;
          default:
            return {
              algorithm: { name: "ECDSA" },
              usages: []
            };
        }
        break;
      case "ECDH":
        switch (operation.toLowerCase()) {
          case "exportkey":
          case "importkey":
          case "generatekey":
            result = {
              algorithm: {
                name: "ECDH",
                namedCurve: "P-256"
              },
              usages: ["deriveKey", "deriveBits"]
            };
            break;
          case "derivekey":
          case "derivebits":
            result = {
              algorithm: {
                name: "ECDH",
                namedCurve: "P-256",
                public: []
              },
              usages: ["encrypt", "decrypt"]
            };
            break;
          default:
            return {
              algorithm: { name: "ECDH" },
              usages: []
            };
        }
        break;
      case "AES-CTR":
        switch (operation.toLowerCase()) {
          case "importkey":
          case "exportkey":
          case "generatekey":
            result = {
              algorithm: {
                name: "AES-CTR",
                length: 256
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          case "decrypt":
          case "encrypt":
            result = {
              algorithm: {
                name: "AES-CTR",
                counter: /* @__PURE__ */ new Uint8Array(16),
                length: 10
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          default:
            return {
              algorithm: { name: "AES-CTR" },
              usages: []
            };
        }
        break;
      case "AES-CBC":
        switch (operation.toLowerCase()) {
          case "importkey":
          case "exportkey":
          case "generatekey":
            result = {
              algorithm: {
                name: "AES-CBC",
                length: 256
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          case "decrypt":
          case "encrypt":
            result = {
              algorithm: {
                name: "AES-CBC",
                iv: this.getRandomValues(/* @__PURE__ */ new Uint8Array(16))
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          default:
            return {
              algorithm: { name: "AES-CBC" },
              usages: []
            };
        }
        break;
      case "AES-GCM":
        switch (operation.toLowerCase()) {
          case "importkey":
          case "exportkey":
          case "generatekey":
            result = {
              algorithm: {
                name: "AES-GCM",
                length: 256
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          case "decrypt":
          case "encrypt":
            result = {
              algorithm: {
                name: "AES-GCM",
                iv: this.getRandomValues(/* @__PURE__ */ new Uint8Array(16))
              },
              usages: [
                "encrypt",
                "decrypt",
                "wrapKey",
                "unwrapKey"
              ]
            };
            break;
          default:
            return {
              algorithm: { name: "AES-GCM" },
              usages: []
            };
        }
        break;
      case "AES-KW":
        switch (operation.toLowerCase()) {
          case "importkey":
          case "exportkey":
          case "generatekey":
          case "wrapkey":
          case "unwrapkey":
            result = {
              algorithm: {
                name: "AES-KW",
                length: 256
              },
              usages: ["wrapKey", "unwrapKey"]
            };
            break;
          default:
            return {
              algorithm: { name: "AES-KW" },
              usages: []
            };
        }
        break;
      case "HMAC":
        switch (operation.toLowerCase()) {
          case "sign":
          case "verify":
            result = {
              algorithm: { name: "HMAC" },
              usages: ["sign", "verify"]
            };
            break;
          case "importkey":
          case "exportkey":
          case "generatekey":
            result = {
              algorithm: {
                name: "HMAC",
                length: 32,
                hash: { name: "SHA-256" }
              },
              usages: ["sign", "verify"]
            };
            break;
          default:
            return {
              algorithm: { name: "HMAC" },
              usages: []
            };
        }
        break;
      case "HKDF":
        switch (operation.toLowerCase()) {
          case "derivekey":
            result = {
              algorithm: {
                name: "HKDF",
                hash: "SHA-256",
                salt: new Uint8Array([]),
                info: new Uint8Array([])
              },
              usages: ["encrypt", "decrypt"]
            };
            break;
          default:
            return {
              algorithm: { name: "HKDF" },
              usages: []
            };
        }
        break;
      case "PBKDF2":
        switch (operation.toLowerCase()) {
          case "derivekey":
            result = {
              algorithm: {
                name: "PBKDF2",
                hash: { name: "SHA-256" },
                salt: new Uint8Array([]),
                iterations: 1e4
              },
              usages: ["encrypt", "decrypt"]
            };
            break;
          default:
            return {
              algorithm: { name: "PBKDF2" },
              usages: []
            };
        }
    }
    return result;
  }
  getHashAlgorithm(signatureAlgorithm) {
    let result = "";
    switch (signatureAlgorithm.algorithmId) {
      case "1.2.840.10045.4.1":
      case "1.2.840.113549.1.1.5":
        result = "SHA-1";
        break;
      case "1.2.840.10045.4.3.2":
      case "1.2.840.113549.1.1.11":
        result = "SHA-256";
        break;
      case "1.2.840.10045.4.3.3":
      case "1.2.840.113549.1.1.12":
        result = "SHA-384";
        break;
      case "1.2.840.10045.4.3.4":
      case "1.2.840.113549.1.1.13":
        result = "SHA-512";
        break;
      case "1.2.840.113549.1.1.10":
        try {
          const params = new RSASSAPSSParams({ schema: signatureAlgorithm.algorithmParams });
          if (params.hashAlgorithm) {
            const algorithm = this.getAlgorithmByOID(params.hashAlgorithm.algorithmId);
            if ("name" in algorithm) result = algorithm.name;
            else return "";
          } else result = "SHA-1";
        } catch {
        }
    }
    return result;
  }
  async encryptEncryptedContentInfo(parameters) {
    ParameterError.assert(parameters, "password", "contentEncryptionAlgorithm", "hmacHashAlgorithm", "iterationCount", "contentToEncrypt", "contentToEncrypt", "contentType");
    const contentEncryptionOID = this.getOIDByAlgorithm(parameters.contentEncryptionAlgorithm, true, "contentEncryptionAlgorithm");
    const pbkdf2OID = this.getOIDByAlgorithm({ name: "PBKDF2" }, true, "PBKDF2");
    const hmacOID = this.getOIDByAlgorithm({
      name: "HMAC",
      hash: { name: parameters.hmacHashAlgorithm }
    }, true, "hmacHashAlgorithm");
    const ivBuffer = /* @__PURE__ */ new ArrayBuffer(16);
    const ivView = new Uint8Array(ivBuffer);
    this.getRandomValues(ivView);
    const saltBuffer = /* @__PURE__ */ new ArrayBuffer(64);
    const saltView = new Uint8Array(saltBuffer);
    this.getRandomValues(saltView);
    const contentView = new Uint8Array(parameters.contentToEncrypt);
    const pbkdf2Params = new PBKDF2Params({
      salt: new OctetString({ valueHex: saltBuffer }),
      iterationCount: parameters.iterationCount,
      prf: new AlgorithmIdentifier({
        algorithmId: hmacOID,
        algorithmParams: new Null()
      })
    });
    const passwordView = new Uint8Array(parameters.password);
    const pbkdfKey = await this.importKey("raw", passwordView, "PBKDF2", false, ["deriveKey"]);
    const derivedKey = await this.deriveKey({
      name: "PBKDF2",
      hash: { name: parameters.hmacHashAlgorithm },
      salt: saltView,
      iterations: parameters.iterationCount
    }, pbkdfKey, parameters.contentEncryptionAlgorithm, false, ["encrypt"]);
    const encryptedData = await this.encrypt({
      name: parameters.contentEncryptionAlgorithm.name,
      iv: ivView
    }, derivedKey, contentView);
    const pbes2Parameters = new PBES2Params({
      keyDerivationFunc: new AlgorithmIdentifier({
        algorithmId: pbkdf2OID,
        algorithmParams: pbkdf2Params.toSchema()
      }),
      encryptionScheme: new AlgorithmIdentifier({
        algorithmId: contentEncryptionOID,
        algorithmParams: new OctetString({ valueHex: ivBuffer })
      })
    });
    return new EncryptedContentInfo({
      contentType: parameters.contentType,
      contentEncryptionAlgorithm: new AlgorithmIdentifier({
        algorithmId: "1.2.840.113549.1.5.13",
        algorithmParams: pbes2Parameters.toSchema()
      }),
      encryptedContent: new OctetString({ valueHex: encryptedData })
    });
  }
  async decryptEncryptedContentInfo(parameters) {
    ParameterError.assert(parameters, "password", "encryptedContentInfo");
    if (parameters.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId !== "1.2.840.113549.1.5.13") throw new Error(`Unknown "contentEncryptionAlgorithm": ${parameters.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId}`);
    let pbes2Parameters;
    try {
      pbes2Parameters = new PBES2Params({ schema: parameters.encryptedContentInfo.contentEncryptionAlgorithm.algorithmParams });
    } catch {
      throw new Error('Incorrectly encoded "pbes2Parameters"');
    }
    let pbkdf2Params;
    try {
      pbkdf2Params = new PBKDF2Params({ schema: pbes2Parameters.keyDerivationFunc.algorithmParams });
    } catch {
      throw new Error('Incorrectly encoded "pbkdf2Params"');
    }
    const contentEncryptionAlgorithm = this.getAlgorithmByOID(pbes2Parameters.encryptionScheme.algorithmId, true);
    const ivBuffer = pbes2Parameters.encryptionScheme.algorithmParams.valueBlock.valueHex;
    const ivView = new Uint8Array(ivBuffer);
    const saltBuffer = pbkdf2Params.salt.valueBlock.valueHex;
    const saltView = new Uint8Array(saltBuffer);
    const iterationCount = pbkdf2Params.iterationCount;
    let hmacHashAlgorithm = "SHA-1";
    if (pbkdf2Params.prf) hmacHashAlgorithm = this.getAlgorithmByOID(pbkdf2Params.prf.algorithmId, true).hash.name;
    const pbkdfKey = await this.importKey("raw", parameters.password, "PBKDF2", false, ["deriveKey"]);
    const result = await this.deriveKey({
      name: "PBKDF2",
      hash: { name: hmacHashAlgorithm },
      salt: saltView,
      iterations: iterationCount
    }, pbkdfKey, contentEncryptionAlgorithm, false, ["decrypt"]);
    const dataBuffer = parameters.encryptedContentInfo.getEncryptedContent();
    return this.decrypt({
      name: contentEncryptionAlgorithm.name,
      iv: ivView
    }, result, dataBuffer);
  }
  async stampDataWithPassword(parameters) {
    if (parameters instanceof Object === false) throw new Error('Parameters must have type "Object"');
    ParameterError.assert(parameters, "password", "hashAlgorithm", "iterationCount", "salt", "contentToStamp");
    let length;
    switch (parameters.hashAlgorithm.toLowerCase()) {
      case "sha-1":
        length = 160;
        break;
      case "sha-256":
        length = 256;
        break;
      case "sha-384":
        length = 384;
        break;
      case "sha-512":
        length = 512;
        break;
      default:
        throw new Error(`Incorrect "parameters.hashAlgorithm" parameter: ${parameters.hashAlgorithm}`);
    }
    const hmacAlgorithm = {
      name: "HMAC",
      length,
      hash: { name: parameters.hashAlgorithm }
    };
    const pkcsKey = await makePKCS12B2Key(parameters.hashAlgorithm, length, parameters.password, parameters.salt, parameters.iterationCount);
    const hmacKey = await this.importKey("raw", new Uint8Array(pkcsKey), hmacAlgorithm, false, ["sign"]);
    return this.sign(hmacAlgorithm, hmacKey, new Uint8Array(parameters.contentToStamp));
  }
  async verifyDataStampedWithPassword(parameters) {
    ParameterError.assert(parameters, "password", "hashAlgorithm", "salt", "iterationCount", "contentToVerify", "signatureToVerify");
    let length = 0;
    switch (parameters.hashAlgorithm.toLowerCase()) {
      case "sha-1":
        length = 160;
        break;
      case "sha-256":
        length = 256;
        break;
      case "sha-384":
        length = 384;
        break;
      case "sha-512":
        length = 512;
        break;
      default:
        throw new Error(`Incorrect "parameters.hashAlgorithm" parameter: ${parameters.hashAlgorithm}`);
    }
    const hmacAlgorithm = {
      name: "HMAC",
      length,
      hash: { name: parameters.hashAlgorithm }
    };
    const pkcsKey = await makePKCS12B2Key(parameters.hashAlgorithm, length, parameters.password, parameters.salt, parameters.iterationCount);
    const hmacKey = await this.importKey("raw", new Uint8Array(pkcsKey), hmacAlgorithm, false, ["verify"]);
    return this.verify(hmacAlgorithm, hmacKey, new Uint8Array(parameters.signatureToVerify), new Uint8Array(parameters.contentToVerify));
  }
  async getSignatureParameters(privateKey, hashAlgorithm = "SHA-1") {
    this.getOIDByAlgorithm({ name: hashAlgorithm }, true, "hashAlgorithm");
    const signatureAlgorithm = new AlgorithmIdentifier();
    const parameters = this.getAlgorithmParameters(privateKey.algorithm.name, "sign");
    if (!Object.keys(parameters.algorithm).length) throw new Error("Parameter 'algorithm' is empty");
    const algorithm = parameters.algorithm;
    if ("hash" in privateKey.algorithm && privateKey.algorithm.hash && privateKey.algorithm.hash.name) algorithm.hash.name = privateKey.algorithm.hash.name;
    else algorithm.hash.name = hashAlgorithm;
    switch (privateKey.algorithm.name.toUpperCase()) {
      case "RSASSA-PKCS1-V1_5":
      case "ECDSA":
        signatureAlgorithm.algorithmId = this.getOIDByAlgorithm(algorithm, true);
        break;
      case "RSA-PSS":
        {
          switch (algorithm.hash.name.toUpperCase()) {
            case "SHA-256":
              algorithm.saltLength = 32;
              break;
            case "SHA-384":
              algorithm.saltLength = 48;
              break;
            case "SHA-512":
              algorithm.saltLength = 64;
          }
          const paramsObject = {};
          if (algorithm.hash.name.toUpperCase() !== "SHA-1") {
            paramsObject.hashAlgorithm = new AlgorithmIdentifier({
              algorithmId: this.getOIDByAlgorithm({ name: algorithm.hash.name }, true, "hashAlgorithm"),
              algorithmParams: new Null()
            });
            paramsObject.maskGenAlgorithm = new AlgorithmIdentifier({
              algorithmId: "1.2.840.113549.1.1.8",
              algorithmParams: paramsObject.hashAlgorithm.toSchema()
            });
          }
          if (algorithm.saltLength !== 20) paramsObject.saltLength = algorithm.saltLength;
          const pssParameters = new RSASSAPSSParams(paramsObject);
          signatureAlgorithm.algorithmId = "1.2.840.113549.1.1.10";
          signatureAlgorithm.algorithmParams = pssParameters.toSchema();
        }
        break;
      default:
        throw new Error(`Unsupported signature algorithm: ${privateKey.algorithm.name}`);
    }
    return {
      signatureAlgorithm,
      parameters
    };
  }
  async signWithPrivateKey(data, privateKey, parameters) {
    const signature = await this.sign(parameters.algorithm, privateKey, data);
    if (parameters.algorithm.name === "ECDSA") return createCMSECDSASignature(signature);
    return signature;
  }
  fillPublicKeyParameters(publicKeyInfo, signatureAlgorithm) {
    const parameters = {};
    const shaAlgorithm = this.getHashAlgorithm(signatureAlgorithm);
    if (shaAlgorithm === "") throw new Error(`Unsupported signature algorithm: ${signatureAlgorithm.algorithmId}`);
    let algorithmId;
    if (signatureAlgorithm.algorithmId === "1.2.840.113549.1.1.10") algorithmId = signatureAlgorithm.algorithmId;
    else algorithmId = publicKeyInfo.algorithm.algorithmId;
    const algorithmObject = this.getAlgorithmByOID(algorithmId, true);
    parameters.algorithm = this.getAlgorithmParameters(algorithmObject.name, "importKey");
    if ("hash" in parameters.algorithm.algorithm) parameters.algorithm.algorithm.hash.name = shaAlgorithm;
    if (algorithmObject.name === "ECDSA") {
      const publicKeyAlgorithm = publicKeyInfo.algorithm;
      if (!publicKeyAlgorithm.algorithmParams) throw new Error("Algorithm parameters for ECDSA public key are missed");
      const publicKeyAlgorithmParams = publicKeyAlgorithm.algorithmParams;
      if ("idBlock" in publicKeyAlgorithm.algorithmParams) {
        if (!(publicKeyAlgorithmParams.idBlock.tagClass === 1 && publicKeyAlgorithmParams.idBlock.tagNumber === 6)) throw new Error("Incorrect type for ECDSA public key parameters");
      }
      const curveObject = this.getAlgorithmByOID(publicKeyAlgorithmParams.valueBlock.toString(), true);
      parameters.algorithm.algorithm.namedCurve = curveObject.name;
    }
    return parameters;
  }
  async getPublicKey(publicKeyInfo, signatureAlgorithm, parameters) {
    if (!parameters) parameters = this.fillPublicKeyParameters(publicKeyInfo, signatureAlgorithm);
    const publicKeyInfoBuffer = publicKeyInfo.toSchema().toBER(false);
    return this.importKey("spki", publicKeyInfoBuffer, parameters.algorithm.algorithm, true, parameters.algorithm.usages);
  }
  async verifyWithPublicKey(data, signature, publicKeyInfo, signatureAlgorithm, shaAlgorithm) {
    let publicKey;
    if (!shaAlgorithm) {
      shaAlgorithm = this.getHashAlgorithm(signatureAlgorithm);
      if (!shaAlgorithm) throw new Error(`Unsupported signature algorithm: ${signatureAlgorithm.algorithmId}`);
      publicKey = await this.getPublicKey(publicKeyInfo, signatureAlgorithm);
    } else {
      const parameters = {};
      let algorithmId;
      if (signatureAlgorithm.algorithmId === "1.2.840.113549.1.1.10") algorithmId = signatureAlgorithm.algorithmId;
      else algorithmId = publicKeyInfo.algorithm.algorithmId;
      const algorithmObject = this.getAlgorithmByOID(algorithmId, true);
      parameters.algorithm = this.getAlgorithmParameters(algorithmObject.name, "importKey");
      if ("hash" in parameters.algorithm.algorithm) parameters.algorithm.algorithm.hash.name = shaAlgorithm;
      if (algorithmObject.name === "ECDSA") {
        let algorithmParamsChecked = false;
        if ("algorithmParams" in publicKeyInfo.algorithm === true) {
          if ("idBlock" in publicKeyInfo.algorithm.algorithmParams) {
            if (publicKeyInfo.algorithm.algorithmParams.idBlock.tagClass === 1 && publicKeyInfo.algorithm.algorithmParams.idBlock.tagNumber === 6) algorithmParamsChecked = true;
          }
        }
        if (algorithmParamsChecked === false) throw new Error("Incorrect type for ECDSA public key parameters");
        const curveObject = this.getAlgorithmByOID(publicKeyInfo.algorithm.algorithmParams.valueBlock.toString(), true);
        parameters.algorithm.algorithm.namedCurve = curveObject.name;
      }
      publicKey = await this.getPublicKey(publicKeyInfo, null, parameters);
    }
    const algorithm = this.getAlgorithmParameters(publicKey.algorithm.name, "verify");
    if ("hash" in algorithm.algorithm) algorithm.algorithm.hash.name = shaAlgorithm;
    let signatureValue = signature.valueBlock.valueHexView;
    if (publicKey.algorithm.name === "ECDSA") {
      const namedCurve = ECNamedCurves.find(publicKey.algorithm.namedCurve);
      if (!namedCurve) throw new Error("Unsupported named curve in use");
      const asn1 = fromBER(signatureValue);
      AsnError.assert(asn1, "Signature value");
      signatureValue = createECDSASignatureFromCMS(asn1.result, namedCurve.size);
    }
    if (publicKey.algorithm.name === "RSA-PSS") {
      const pssParameters = new RSASSAPSSParams({ schema: signatureAlgorithm.algorithmParams });
      if ("saltLength" in pssParameters) algorithm.algorithm.saltLength = pssParameters.saltLength;
      else algorithm.algorithm.saltLength = 20;
      let hashAlgo = "SHA-1";
      if ("hashAlgorithm" in pssParameters) hashAlgo = this.getAlgorithmByOID(pssParameters.hashAlgorithm.algorithmId, true).name;
      algorithm.algorithm.hash.name = hashAlgo;
    }
    return this.verify(algorithm.algorithm, publicKey, signatureValue, data);
  }
};
var engine = {
  name: "none",
  crypto: null
};
function isCryptoEngine(engine2) {
  return engine2 && typeof engine2 === "object" && "crypto" in engine2 ? true : false;
}
function getEngineGlobalKey() {
  return typeof process !== "undefined" && Number.isInteger(process.pid) ? process.pid : /* @__PURE__ */ Symbol.for("pkijs.engine");
}
function setEngine(name, ...args) {
  let crypto2 = null;
  if (args.length < 2) {
    if (args.length) crypto2 = args[0];
    else crypto2 = typeof self !== "undefined" && self.crypto ? new CryptoEngine({
      name: "browser",
      crypto: self.crypto
    }) : null;
  } else {
    const cryptoArg = args[0];
    const subtleArg = args[1];
    if (isCryptoEngine(subtleArg)) crypto2 = subtleArg;
    else if (isCryptoEngine(cryptoArg)) crypto2 = cryptoArg;
    else if ("subtle" in cryptoArg && "getRandomValues" in cryptoArg) crypto2 = new CryptoEngine({ crypto: cryptoArg });
  }
  if (typeof process !== "undefined" && "pid" in process && typeof global !== "undefined" && typeof window === "undefined") {
    const engineKey = getEngineGlobalKey();
    if (typeof global[engineKey] === "undefined") global[engineKey] = {};
    else if (typeof global[engineKey] !== "object") throw new Error(`Name global.${String(engineKey)} already exists and it is not an object`);
    if (typeof global[engineKey].pkijs === "undefined") global[engineKey].pkijs = {};
    else if (typeof global[engineKey].pkijs !== "object") throw new Error(`Name global.${String(engineKey)}.pkijs already exists and it is not an object`);
    global[engineKey].pkijs.engine = {
      name,
      crypto: crypto2
    };
  } else engine = {
    name,
    crypto: crypto2
  };
}
function getEngine() {
  if (typeof process !== "undefined" && "pid" in process && typeof global !== "undefined" && typeof window === "undefined") {
    let _engine;
    try {
      _engine = global[getEngineGlobalKey()].pkijs.engine;
    } catch {
      throw new Error("Please call 'setEngine' before call to 'getEngine'");
    }
    return _engine;
  }
  return engine;
}
function getCrypto(safety = false) {
  const _engine = getEngine();
  if (!_engine.crypto && safety) throw new Error("Unable to create WebCrypto object");
  return _engine.crypto;
}
function createCMSECDSASignature(signatureBuffer) {
  if (signatureBuffer.byteLength % 2 !== 0) return EMPTY_BUFFER2;
  const length = signatureBuffer.byteLength / 2;
  const rInteger = new Integer({ valueHex: toMinimalUnsignedInteger(new Uint8Array(signatureBuffer, 0, length)) });
  const sInteger = new Integer({ valueHex: toMinimalUnsignedInteger(new Uint8Array(signatureBuffer, length, length)) });
  return new Sequence({ value: [rInteger, sInteger] }).toBER(false);
}
function createECDSASignatureFromCMS(cmsSignature, pointSize) {
  if (!(cmsSignature instanceof Sequence && cmsSignature.valueBlock.value.length === 2 && cmsSignature.valueBlock.value[0] instanceof Integer && cmsSignature.valueBlock.value[1] instanceof Integer)) return EMPTY_BUFFER2;
  const rValueView = cmsSignature.valueBlock.value[0].convertFromDER().valueBlock.valueHexView;
  const sValueView = cmsSignature.valueBlock.value[1].convertFromDER().valueBlock.valueHexView;
  const res = new Uint8Array(pointSize * 2);
  res.set(rValueView, pointSize - rValueView.byteLength);
  res.set(sValueView, 2 * pointSize - sValueView.byteLength);
  return res.buffer;
}
async function kdfWithCounter(hashFunction, zBuffer, Counter, SharedInfo, crypto2) {
  switch (hashFunction.toUpperCase()) {
    case "SHA-1":
    case "SHA-256":
    case "SHA-384":
    case "SHA-512":
      break;
    default:
      throw new ArgumentError(`Unknown hash function: ${hashFunction}`);
  }
  ArgumentError.assert(zBuffer, "zBuffer", "ArrayBuffer");
  if (zBuffer.byteLength === 0) throw new ArgumentError("'zBuffer' has zero length, error");
  ArgumentError.assert(SharedInfo, "SharedInfo", "ArrayBuffer");
  if (Counter > 255) throw new ArgumentError("Please set 'Counter' argument to value less or equal to 255");
  const counterBuffer = /* @__PURE__ */ new ArrayBuffer(4);
  const counterView = new Uint8Array(counterBuffer);
  counterView[0] = 0;
  counterView[1] = 0;
  counterView[2] = 0;
  counterView[3] = Counter;
  const combinedBuffer = bytes_exports.concat(zBuffer, counterBuffer, SharedInfo);
  return {
    counter: Counter,
    result: await crypto2.digest({ name: hashFunction }, combinedBuffer)
  };
}
async function kdf(hashFunction, Zbuffer, keydatalen, SharedInfo, crypto2 = getCrypto(true)) {
  let hashLength;
  let maxCounter = 1;
  switch (hashFunction.toUpperCase()) {
    case "SHA-1":
      hashLength = 160;
      break;
    case "SHA-256":
      hashLength = 256;
      break;
    case "SHA-384":
      hashLength = 384;
      break;
    case "SHA-512":
      hashLength = 512;
      break;
    default:
      throw new ArgumentError(`Unknown hash function: ${hashFunction}`);
  }
  ArgumentError.assert(Zbuffer, "Zbuffer", "ArrayBuffer");
  if (Zbuffer.byteLength === 0) throw new ArgumentError("'Zbuffer' has zero length, error");
  ArgumentError.assert(SharedInfo, "SharedInfo", "ArrayBuffer");
  const quotient = keydatalen / hashLength;
  if (Math.floor(quotient) > 0) {
    maxCounter = Math.floor(quotient);
    if (quotient - maxCounter > 0) maxCounter++;
  }
  const incomingResult = [];
  for (let i = 1; i <= maxCounter; i++) incomingResult.push(await kdfWithCounter(hashFunction, Zbuffer, i, SharedInfo, crypto2));
  const combinedBuffer = bytes_exports.concat(incomingResult.map((item) => item.result));
  keydatalen >>= 3;
  if (combinedBuffer.byteLength > keydatalen) {
    const newBuffer = new ArrayBuffer(keydatalen);
    const newView = new Uint8Array(newBuffer);
    const combinedView = new Uint8Array(combinedBuffer);
    for (let i = 0; i < keydatalen; i++) newView[i] = combinedView[i];
    return newBuffer;
  }
  return combinedBuffer;
}
function toMinimalUnsignedInteger(view) {
  let start = 0;
  while (start < view.length - 1 && view[start] === 0) start++;
  const value = view.subarray(start);
  if (value.length && value[0] & 128) {
    const res = new Uint8Array(value.length + 1);
    res.set(value, 1);
    return res;
  }
  return value.slice();
}
var TYPE$2 = "type";
var VALUE$5 = "value";
var UTC_TIME_NAME = "utcTimeName";
var GENERAL_TIME_NAME = "generalTimeName";
var CLEAR_PROPS$65 = [UTC_TIME_NAME, GENERAL_TIME_NAME];
var Time = class Time2 extends PkiObject {
  static {
    this.CLASS_NAME = "Time";
  }
  constructor(parameters = {}) {
    super();
    this.type = parameters[TYPE$2] ?? Time2.defaultValues(TYPE$2);
    this.value = parameters[VALUE$5] ?? Time2.defaultValues(VALUE$5);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TYPE$2:
        return 0;
      case VALUE$5:
        return new Date(0, 0, 0);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}, optional = false) {
    const names = parameters.names ?? {};
    return new Choice({
      optional,
      value: [new UTCTime({ name: names.utcTimeName || "" }), new GeneralizedTime({ name: names.generalTimeName || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$65) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Time2.schema({ names: {
      utcTimeName: UTC_TIME_NAME,
      generalTimeName: GENERAL_TIME_NAME
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (UTC_TIME_NAME in asn1.result) {
      this.type = 0;
      this.value = asn1.result.utcTimeName.toDate();
    }
    if (GENERAL_TIME_NAME in asn1.result) {
      this.type = 1;
      this.value = asn1.result.generalTimeName.toDate();
    }
  }
  toSchema() {
    if (this.type === 0) return new UTCTime({ valueDate: this.value });
    else if (this.type === 1) return new GeneralizedTime({ valueDate: this.value });
    return {};
  }
  toJSON() {
    return {
      type: this.type,
      value: this.value
    };
  }
};
var TBS$4 = "tbs";
var VERSION$18 = "version";
var SERIAL_NUMBER$6 = "serialNumber";
var SIGNATURE$7 = "signature";
var ISSUER$5 = "issuer";
var NOT_BEFORE = "notBefore";
var NOT_AFTER = "notAfter";
var SUBJECT$1 = "subject";
var SUBJECT_PUBLIC_KEY_INFO = "subjectPublicKeyInfo";
var ISSUER_UNIQUE_ID$2 = "issuerUniqueID";
var SUBJECT_UNIQUE_ID = "subjectUniqueID";
var EXTENSIONS$6 = "extensions";
var SIGNATURE_ALGORITHM$8 = "signatureAlgorithm";
var SIGNATURE_VALUE$4 = "signatureValue";
var TBS_CERTIFICATE = "tbsCertificate";
var TBS_CERTIFICATE_VERSION = `${TBS_CERTIFICATE}.${VERSION$18}`;
var TBS_CERTIFICATE_SERIAL_NUMBER = `${TBS_CERTIFICATE}.${SERIAL_NUMBER$6}`;
var TBS_CERTIFICATE_SIGNATURE = `${TBS_CERTIFICATE}.${SIGNATURE$7}`;
var TBS_CERTIFICATE_ISSUER = `${TBS_CERTIFICATE}.${ISSUER$5}`;
var TBS_CERTIFICATE_NOT_BEFORE = `${TBS_CERTIFICATE}.${NOT_BEFORE}`;
var TBS_CERTIFICATE_NOT_AFTER = `${TBS_CERTIFICATE}.${NOT_AFTER}`;
var TBS_CERTIFICATE_SUBJECT = `${TBS_CERTIFICATE}.${SUBJECT$1}`;
var TBS_CERTIFICATE_SUBJECT_PUBLIC_KEY = `${TBS_CERTIFICATE}.${SUBJECT_PUBLIC_KEY_INFO}`;
var TBS_CERTIFICATE_ISSUER_UNIQUE_ID = `${TBS_CERTIFICATE}.${ISSUER_UNIQUE_ID$2}`;
var TBS_CERTIFICATE_SUBJECT_UNIQUE_ID = `${TBS_CERTIFICATE}.${SUBJECT_UNIQUE_ID}`;
var TBS_CERTIFICATE_EXTENSIONS = `${TBS_CERTIFICATE}.${EXTENSIONS$6}`;
var CLEAR_PROPS$64 = [
  TBS_CERTIFICATE,
  TBS_CERTIFICATE_VERSION,
  TBS_CERTIFICATE_SERIAL_NUMBER,
  TBS_CERTIFICATE_SIGNATURE,
  TBS_CERTIFICATE_ISSUER,
  TBS_CERTIFICATE_NOT_BEFORE,
  TBS_CERTIFICATE_NOT_AFTER,
  TBS_CERTIFICATE_SUBJECT,
  TBS_CERTIFICATE_SUBJECT_PUBLIC_KEY,
  TBS_CERTIFICATE_ISSUER_UNIQUE_ID,
  TBS_CERTIFICATE_SUBJECT_UNIQUE_ID,
  TBS_CERTIFICATE_EXTENSIONS,
  SIGNATURE_ALGORITHM$8,
  SIGNATURE_VALUE$4
];
function tbsCertificate(parameters = {}) {
  const names = parameters.names ?? {};
  return new Sequence({
    name: names.blockName || TBS_CERTIFICATE,
    value: [
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Integer({ name: names.tbsCertificateVersion || TBS_CERTIFICATE_VERSION })]
      }),
      new Integer({ name: names.tbsCertificateSerialNumber || TBS_CERTIFICATE_SERIAL_NUMBER }),
      AlgorithmIdentifier.schema(names.signature || { names: { blockName: TBS_CERTIFICATE_SIGNATURE } }),
      RelativeDistinguishedNames.schema(names.issuer || { names: { blockName: TBS_CERTIFICATE_ISSUER } }),
      new Sequence({
        name: names.tbsCertificateValidity || "tbsCertificate.validity",
        value: [Time.schema(names.notBefore || { names: {
          utcTimeName: TBS_CERTIFICATE_NOT_BEFORE,
          generalTimeName: TBS_CERTIFICATE_NOT_BEFORE
        } }), Time.schema(names.notAfter || { names: {
          utcTimeName: TBS_CERTIFICATE_NOT_AFTER,
          generalTimeName: TBS_CERTIFICATE_NOT_AFTER
        } })]
      }),
      RelativeDistinguishedNames.schema(names.subject || { names: { blockName: TBS_CERTIFICATE_SUBJECT } }),
      PublicKeyInfo.schema(names.subjectPublicKeyInfo || { names: { blockName: TBS_CERTIFICATE_SUBJECT_PUBLIC_KEY } }),
      new Primitive({
        name: names.tbsCertificateIssuerUniqueID || TBS_CERTIFICATE_ISSUER_UNIQUE_ID,
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        }
      }),
      new Primitive({
        name: names.tbsCertificateSubjectUniqueID || TBS_CERTIFICATE_SUBJECT_UNIQUE_ID,
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 2
        }
      }),
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 3
        },
        value: [Extensions.schema(names.extensions || { names: { blockName: TBS_CERTIFICATE_EXTENSIONS } })]
      })
    ]
  });
}
var Certificate = class Certificate2 extends PkiObject {
  static {
    this.CLASS_NAME = "Certificate";
  }
  get tbs() {
    return toArrayBuffer(this.tbsView);
  }
  set tbs(value) {
    this.tbsView = new Uint8Array(value);
  }
  constructor(parameters = {}) {
    super();
    this.tbsView = new Uint8Array(parameters[TBS$4] ?? Certificate2.defaultValues(TBS$4));
    this.version = parameters[VERSION$18] ?? Certificate2.defaultValues(VERSION$18);
    this.serialNumber = parameters[SERIAL_NUMBER$6] ?? Certificate2.defaultValues(SERIAL_NUMBER$6);
    this.signature = parameters[SIGNATURE$7] ?? Certificate2.defaultValues(SIGNATURE$7);
    this.issuer = parameters[ISSUER$5] ?? Certificate2.defaultValues(ISSUER$5);
    this.notBefore = parameters[NOT_BEFORE] ?? Certificate2.defaultValues(NOT_BEFORE);
    this.notAfter = parameters[NOT_AFTER] ?? Certificate2.defaultValues(NOT_AFTER);
    this.subject = parameters[SUBJECT$1] ?? Certificate2.defaultValues(SUBJECT$1);
    this.subjectPublicKeyInfo = parameters[SUBJECT_PUBLIC_KEY_INFO] ?? Certificate2.defaultValues(SUBJECT_PUBLIC_KEY_INFO);
    if (ISSUER_UNIQUE_ID$2 in parameters) this.issuerUniqueID = parameters[ISSUER_UNIQUE_ID$2] ?? Certificate2.defaultValues(ISSUER_UNIQUE_ID$2);
    if (SUBJECT_UNIQUE_ID in parameters) this.subjectUniqueID = parameters[SUBJECT_UNIQUE_ID] ?? Certificate2.defaultValues(SUBJECT_UNIQUE_ID);
    if (EXTENSIONS$6 in parameters) this.extensions = parameters[EXTENSIONS$6] ?? Certificate2.defaultValues(EXTENSIONS$6);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$8] ?? Certificate2.defaultValues(SIGNATURE_ALGORITHM$8);
    this.signatureValue = parameters[SIGNATURE_VALUE$4] ?? Certificate2.defaultValues(SIGNATURE_VALUE$4);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TBS$4:
        return EMPTY_BUFFER2;
      case VERSION$18:
        return 0;
      case SERIAL_NUMBER$6:
        return new Integer();
      case SIGNATURE$7:
        return new AlgorithmIdentifier();
      case ISSUER$5:
        return new RelativeDistinguishedNames();
      case NOT_BEFORE:
        return new Time();
      case NOT_AFTER:
        return new Time();
      case SUBJECT$1:
        return new RelativeDistinguishedNames();
      case SUBJECT_PUBLIC_KEY_INFO:
        return new PublicKeyInfo();
      case ISSUER_UNIQUE_ID$2:
        return EMPTY_BUFFER2;
      case SUBJECT_UNIQUE_ID:
        return EMPTY_BUFFER2;
      case EXTENSIONS$6:
        return [];
      case SIGNATURE_ALGORITHM$8:
        return new AlgorithmIdentifier();
      case SIGNATURE_VALUE$4:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        tbsCertificate(names.tbsCertificate),
        AlgorithmIdentifier.schema(names.signatureAlgorithm || { names: { blockName: SIGNATURE_ALGORITHM$8 } }),
        new BitString({ name: names.signatureValue || SIGNATURE_VALUE$4 })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$64) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Certificate2.schema({ names: { tbsCertificate: { names: { extensions: { names: { extensions: TBS_CERTIFICATE_EXTENSIONS } } } } } }));
    AsnError.assertSchema(asn1, this.className);
    this.tbsView = asn1.result.tbsCertificate.valueBeforeDecodeView;
    if (TBS_CERTIFICATE_VERSION in asn1.result) this.version = asn1.result[TBS_CERTIFICATE_VERSION].valueBlock.valueDec;
    this.serialNumber = asn1.result[TBS_CERTIFICATE_SERIAL_NUMBER];
    this.signature = new AlgorithmIdentifier({ schema: asn1.result[TBS_CERTIFICATE_SIGNATURE] });
    this.issuer = new RelativeDistinguishedNames({ schema: asn1.result[TBS_CERTIFICATE_ISSUER] });
    this.notBefore = new Time({ schema: asn1.result[TBS_CERTIFICATE_NOT_BEFORE] });
    this.notAfter = new Time({ schema: asn1.result[TBS_CERTIFICATE_NOT_AFTER] });
    this.subject = new RelativeDistinguishedNames({ schema: asn1.result[TBS_CERTIFICATE_SUBJECT] });
    this.subjectPublicKeyInfo = new PublicKeyInfo({ schema: asn1.result[TBS_CERTIFICATE_SUBJECT_PUBLIC_KEY] });
    if (TBS_CERTIFICATE_ISSUER_UNIQUE_ID in asn1.result) this.issuerUniqueID = asn1.result[TBS_CERTIFICATE_ISSUER_UNIQUE_ID].valueBlock.valueHex;
    if (TBS_CERTIFICATE_SUBJECT_UNIQUE_ID in asn1.result) this.subjectUniqueID = asn1.result[TBS_CERTIFICATE_SUBJECT_UNIQUE_ID].valueBlock.valueHex;
    if (TBS_CERTIFICATE_EXTENSIONS in asn1.result) this.extensions = Array.from(asn1.result[TBS_CERTIFICATE_EXTENSIONS], (element) => new Extension({ schema: element }));
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.signatureAlgorithm });
    this.signatureValue = asn1.result.signatureValue;
  }
  encodeTBS() {
    const outputArray = [];
    if (VERSION$18 in this && this.version !== Certificate2.defaultValues(VERSION$18)) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [new Integer({ value: this.version })]
    }));
    outputArray.push(this.serialNumber);
    outputArray.push(this.signature.toSchema());
    outputArray.push(this.issuer.toSchema());
    outputArray.push(new Sequence({ value: [this.notBefore.toSchema(), this.notAfter.toSchema()] }));
    outputArray.push(this.subject.toSchema());
    outputArray.push(this.subjectPublicKeyInfo.toSchema());
    if (this.issuerUniqueID) outputArray.push(new Primitive({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      valueHex: this.issuerUniqueID
    }));
    if (this.subjectUniqueID) outputArray.push(new Primitive({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      valueHex: this.subjectUniqueID
    }));
    if (this.extensions) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 3
      },
      value: [new Sequence({ value: Array.from(this.extensions, (o) => o.toSchema()) })]
    }));
    return new Sequence({ value: outputArray });
  }
  toSchema(encodeFlag = false) {
    let tbsSchema;
    if (encodeFlag === false) {
      if (!this.tbsView.byteLength) return Certificate2.schema().value[0];
      const asn1 = fromBER(this.tbsView);
      AsnError.assert(asn1, "TBS Certificate");
      tbsSchema = asn1.result;
    } else tbsSchema = this.encodeTBS();
    return new Sequence({ value: [
      tbsSchema,
      this.signatureAlgorithm.toSchema(),
      this.signatureValue
    ] });
  }
  toJSON() {
    const res = {
      tbs: hex_exports.encode(this.tbsView),
      version: this.version,
      serialNumber: this.serialNumber.toJSON(),
      signature: this.signature.toJSON(),
      issuer: this.issuer.toJSON(),
      notBefore: this.notBefore.toJSON(),
      notAfter: this.notAfter.toJSON(),
      subject: this.subject.toJSON(),
      subjectPublicKeyInfo: this.subjectPublicKeyInfo.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signatureValue: this.signatureValue.toJSON()
    };
    if (VERSION$18 in this && this.version !== Certificate2.defaultValues(VERSION$18)) res.version = this.version;
    if (this.issuerUniqueID) res.issuerUniqueID = hex_exports.encode(this.issuerUniqueID);
    if (this.subjectUniqueID) res.subjectUniqueID = hex_exports.encode(this.subjectUniqueID);
    if (this.extensions) res.extensions = Array.from(this.extensions, (o) => o.toJSON());
    return res;
  }
  async getPublicKey(parameters, crypto2 = getCrypto(true)) {
    return crypto2.getPublicKey(this.subjectPublicKeyInfo, this.signatureAlgorithm, parameters);
  }
  async getKeyHash(hashAlgorithm = "SHA-1", crypto2 = getCrypto(true)) {
    return crypto2.digest({ name: hashAlgorithm }, this.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView);
  }
  async sign(privateKey, hashAlgorithm = "SHA-1", crypto2 = getCrypto(true)) {
    if (!privateKey) throw new Error("Need to provide a private key for signing");
    const signatureParameters = await crypto2.getSignatureParameters(privateKey, hashAlgorithm);
    const parameters = signatureParameters.parameters;
    this.signature = signatureParameters.signatureAlgorithm;
    this.signatureAlgorithm = signatureParameters.signatureAlgorithm;
    this.tbsView = new Uint8Array(this.encodeTBS().toBER());
    const signature = await crypto2.signWithPrivateKey(this.tbsView, privateKey, parameters);
    this.signatureValue = new BitString({ valueHex: signature });
  }
  async verify(issuerCertificate, crypto2 = getCrypto(true)) {
    let subjectPublicKeyInfo;
    if (issuerCertificate) subjectPublicKeyInfo = issuerCertificate.subjectPublicKeyInfo;
    else if (this.issuer.isEqual(this.subject)) subjectPublicKeyInfo = this.subjectPublicKeyInfo;
    if (!(subjectPublicKeyInfo instanceof PublicKeyInfo)) throw new Error("Please provide issuer certificate as a parameter");
    return crypto2.verifyWithPublicKey(this.tbsView, this.signatureValue, subjectPublicKeyInfo, this.signatureAlgorithm);
  }
};
function checkCA(cert, signerCert = null) {
  if (signerCert && cert.issuer.isEqual(signerCert.issuer) && cert.serialNumber.isEqual(signerCert.serialNumber)) return null;
  let isCA = false;
  if (cert.extensions) {
    for (const extension of cert.extensions) if (extension.extnID === "2.5.29.19" && extension.parsedValue instanceof BasicConstraints) {
      if (extension.parsedValue.cA) {
        isCA = true;
        break;
      }
    }
  }
  if (isCA) return cert;
  return null;
}
var VERSION$17 = "version";
var LOG_ID = "logID";
var EXTENSIONS$5 = "extensions";
var TIMESTAMP = "timestamp";
var HASH_ALGORITHM$3 = "hashAlgorithm";
var SIGNATURE_ALGORITHM$7 = "signatureAlgorithm";
var SIGNATURE$6 = "signature";
var NONE = "none";
var MD5 = "md5";
var SHA1 = "sha1";
var SHA224 = "sha224";
var SHA256 = "sha256";
var SHA384 = "sha384";
var SHA512 = "sha512";
var ANONYMOUS = "anonymous";
var RSA = "rsa";
var DSA = "dsa";
var ECDSA = "ecdsa";
var SignedCertificateTimestamp = class SignedCertificateTimestamp2 extends PkiObject {
  static {
    this.CLASS_NAME = "SignedCertificateTimestamp";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$17] ?? SignedCertificateTimestamp2.defaultValues(VERSION$17);
    this.logID = parameters[LOG_ID] ?? SignedCertificateTimestamp2.defaultValues(LOG_ID);
    this.timestamp = parameters[TIMESTAMP] ?? SignedCertificateTimestamp2.defaultValues(TIMESTAMP);
    this.extensions = parameters[EXTENSIONS$5] ?? SignedCertificateTimestamp2.defaultValues(EXTENSIONS$5);
    this.hashAlgorithm = parameters[HASH_ALGORITHM$3] ?? SignedCertificateTimestamp2.defaultValues(HASH_ALGORITHM$3);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$7] ?? SignedCertificateTimestamp2.defaultValues(SIGNATURE_ALGORITHM$7);
    this.signature = parameters[SIGNATURE$6] ?? SignedCertificateTimestamp2.defaultValues(SIGNATURE$6);
    if ("stream" in parameters && parameters.stream) this.fromStream(parameters.stream);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$17:
        return 0;
      case LOG_ID:
      case EXTENSIONS$5:
        return EMPTY_BUFFER2;
      case TIMESTAMP:
        return /* @__PURE__ */ new Date(0);
      case HASH_ALGORITHM$3:
      case SIGNATURE_ALGORITHM$7:
        return "";
      case SIGNATURE$6:
        return EMPTY_BUFFER2;
      default:
        return super.defaultValues(memberName);
    }
  }
  fromSchema(schema) {
    if (schema instanceof RawData === false) throw new Error("Object's schema was not verified against input data for SignedCertificateTimestamp");
    const seqStream = new SeqStream({ stream: new ByteStream({ buffer: schema.data }) });
    this.fromStream(seqStream);
  }
  fromStream(stream) {
    const blockLength = stream.getUint16();
    this.version = stream.getBlock(1)[0];
    if (this.version === 0) {
      this.logID = new Uint8Array(stream.getBlock(32)).buffer.slice(0);
      this.timestamp = new Date(Number(uint_exports.decodeBigInt(stream.getBlock(8))));
      const extensionsLength = stream.getUint16();
      this.extensions = new Uint8Array(stream.getBlock(extensionsLength)).buffer.slice(0);
      switch (stream.getBlock(1)[0]) {
        case 0:
          this.hashAlgorithm = NONE;
          break;
        case 1:
          this.hashAlgorithm = MD5;
          break;
        case 2:
          this.hashAlgorithm = SHA1;
          break;
        case 3:
          this.hashAlgorithm = SHA224;
          break;
        case 4:
          this.hashAlgorithm = SHA256;
          break;
        case 5:
          this.hashAlgorithm = SHA384;
          break;
        case 6:
          this.hashAlgorithm = SHA512;
          break;
        default:
          throw new Error("Object's stream was not correct for SignedCertificateTimestamp");
      }
      switch (stream.getBlock(1)[0]) {
        case 0:
          this.signatureAlgorithm = ANONYMOUS;
          break;
        case 1:
          this.signatureAlgorithm = RSA;
          break;
        case 2:
          this.signatureAlgorithm = DSA;
          break;
        case 3:
          this.signatureAlgorithm = ECDSA;
          break;
        default:
          throw new Error("Object's stream was not correct for SignedCertificateTimestamp");
      }
      const signatureLength = stream.getUint16();
      this.signature = new Uint8Array(stream.getBlock(signatureLength)).buffer.slice(0);
      if (blockLength !== 47 + extensionsLength + signatureLength) throw new Error("Object's stream was not correct for SignedCertificateTimestamp");
    }
  }
  toSchema() {
    const stream = this.toStream();
    return new RawData({ data: stream.stream.buffer });
  }
  toStream() {
    const stream = new SeqStream();
    stream.appendUint16(47 + this.extensions.byteLength + this.signature.byteLength);
    stream.appendChar(this.version);
    stream.appendView(new Uint8Array(this.logID));
    stream.appendView(uint_exports.encode(this.timestamp.valueOf(), { length: 8 }));
    stream.appendUint16(this.extensions.byteLength);
    if (this.extensions.byteLength) stream.appendView(new Uint8Array(this.extensions));
    let _hashAlgorithm;
    switch (this.hashAlgorithm.toLowerCase()) {
      case NONE:
        _hashAlgorithm = 0;
        break;
      case MD5:
        _hashAlgorithm = 1;
        break;
      case SHA1:
        _hashAlgorithm = 2;
        break;
      case SHA224:
        _hashAlgorithm = 3;
        break;
      case SHA256:
        _hashAlgorithm = 4;
        break;
      case SHA384:
        _hashAlgorithm = 5;
        break;
      case SHA512:
        _hashAlgorithm = 6;
        break;
      default:
        throw new Error(`Incorrect data for hashAlgorithm: ${this.hashAlgorithm}`);
    }
    stream.appendChar(_hashAlgorithm);
    let _signatureAlgorithm;
    switch (this.signatureAlgorithm.toLowerCase()) {
      case ANONYMOUS:
        _signatureAlgorithm = 0;
        break;
      case RSA:
        _signatureAlgorithm = 1;
        break;
      case DSA:
        _signatureAlgorithm = 2;
        break;
      case ECDSA:
        _signatureAlgorithm = 3;
        break;
      default:
        throw new Error(`Incorrect data for signatureAlgorithm: ${this.signatureAlgorithm}`);
    }
    stream.appendChar(_signatureAlgorithm);
    stream.appendUint16(this.signature.byteLength);
    stream.appendView(new Uint8Array(this.signature));
    return stream;
  }
  toJSON() {
    return {
      version: this.version,
      logID: hex_exports.encode(this.logID, { case: "upper" }),
      timestamp: this.timestamp,
      extensions: hex_exports.encode(this.extensions, { case: "upper" }),
      hashAlgorithm: this.hashAlgorithm,
      signatureAlgorithm: this.signatureAlgorithm,
      signature: hex_exports.encode(this.signature, { case: "upper" })
    };
  }
  async verify(logs, data, dataType = 0, crypto2 = getCrypto(true)) {
    const logId = base64_exports.encode(this.logID);
    let publicKeyBase64 = null;
    const stream = new SeqStream();
    for (const log of logs) if (log.log_id === logId) {
      publicKeyBase64 = log.key;
      break;
    }
    if (!publicKeyBase64) throw new Error(`Public key not found for CT with logId: ${logId}`);
    const pki = toArrayBuffer(base64_exports.decode(publicKeyBase64));
    const publicKeyInfo = PublicKeyInfo.fromBER(pki);
    stream.appendChar(0);
    stream.appendChar(0);
    stream.appendView(uint_exports.encode(this.timestamp.valueOf(), { length: 8 }));
    stream.appendUint16(dataType);
    if (dataType === 0) stream.appendUint24(data.byteLength);
    stream.appendView(new Uint8Array(data));
    stream.appendUint16(this.extensions.byteLength);
    if (this.extensions.byteLength !== 0) stream.appendView(new Uint8Array(this.extensions));
    return crypto2.verifyWithPublicKey(stream.buffer.slice(0, stream.length), new OctetString({ valueHex: this.signature }), publicKeyInfo, { algorithmId: "" }, "SHA-256");
  }
};
var SCT_EXTENSION_OID = new ObjectIdentifier({ value: id_SignedCertificateTimestampList }).valueBlock.toBER(false);
var TIMESTAMPS = "timestamps";
var SignedCertificateTimestampList = class SignedCertificateTimestampList2 extends PkiObject {
  static {
    this.CLASS_NAME = "SignedCertificateTimestampList";
  }
  constructor(parameters = {}) {
    super();
    this.timestamps = parameters[TIMESTAMPS] ?? SignedCertificateTimestampList2.defaultValues(TIMESTAMPS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TIMESTAMPS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TIMESTAMPS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    names.optional ??= false;
    return new OctetString({
      name: names.blockName || "SignedCertificateTimestampList",
      optional: names.optional
    });
  }
  fromSchema(schema) {
    if (schema instanceof OctetString === false) throw new Error("Object's schema was not verified against input data for SignedCertificateTimestampList");
    const seqStream = new SeqStream({ stream: new ByteStream({ buffer: schema.valueBlock.valueHex }) });
    if (seqStream.getUint16() !== seqStream.length) throw new Error("Object's schema was not verified against input data for SignedCertificateTimestampList");
    while (seqStream.length) this.timestamps.push(new SignedCertificateTimestamp({ stream: seqStream }));
  }
  toSchema() {
    const stream = new SeqStream();
    let overallLength = 0;
    const timestampsData = [];
    for (const timestamp of this.timestamps) {
      const timestampStream = timestamp.toStream();
      timestampsData.push(timestampStream);
      overallLength += timestampStream.stream.buffer.byteLength;
    }
    stream.appendUint16(overallLength);
    for (const timestamp of timestampsData) stream.appendView(timestamp.stream.view);
    return new OctetString({ valueHex: stream.stream.buffer.slice(0) });
  }
  toJSON() {
    return { timestamps: Array.from(this.timestamps, (o) => o.toJSON()) };
  }
};
var ATTRIBUTES$4 = "attributes";
var CLEAR_PROPS$63 = [ATTRIBUTES$4];
var SubjectDirectoryAttributes = class SubjectDirectoryAttributes2 extends PkiObject {
  static {
    this.CLASS_NAME = "SubjectDirectoryAttributes";
  }
  constructor(parameters = {}) {
    super();
    this.attributes = parameters[ATTRIBUTES$4] ?? SubjectDirectoryAttributes2.defaultValues(ATTRIBUTES$4);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ATTRIBUTES$4:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.attributes || "",
        value: Attribute.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$63) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SubjectDirectoryAttributes2.schema({ names: { attributes: ATTRIBUTES$4 } }));
    AsnError.assertSchema(asn1, this.className);
    this.attributes = Array.from(asn1.result.attributes, (element) => new Attribute({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.attributes, (o) => o.toSchema()) });
  }
  toJSON() {
    return { attributes: Array.from(this.attributes, (o) => o.toJSON()) };
  }
};
var ExtensionValueFactory = class ExtensionValueFactory2 {
  static getItems() {
    if (!this.types) {
      this.types = {};
      ExtensionValueFactory2.register(id_SubjectAltName, "SubjectAltName", AltName);
      ExtensionValueFactory2.register(id_IssuerAltName, "IssuerAltName", AltName);
      ExtensionValueFactory2.register(id_AuthorityKeyIdentifier, "AuthorityKeyIdentifier", AuthorityKeyIdentifier);
      ExtensionValueFactory2.register(id_BasicConstraints, "BasicConstraints", BasicConstraints);
      ExtensionValueFactory2.register(id_MicrosoftCaVersion, "MicrosoftCaVersion", CAVersion);
      ExtensionValueFactory2.register(id_CertificatePolicies, "CertificatePolicies", CertificatePolicies);
      ExtensionValueFactory2.register(id_MicrosoftAppPolicies, "CertificatePoliciesMicrosoft", CertificatePolicies);
      ExtensionValueFactory2.register(id_MicrosoftCertTemplateV2, "MicrosoftCertTemplateV2", CertificateTemplate);
      ExtensionValueFactory2.register(id_CRLDistributionPoints, "CRLDistributionPoints", CRLDistributionPoints);
      ExtensionValueFactory2.register(id_FreshestCRL, "FreshestCRL", CRLDistributionPoints);
      ExtensionValueFactory2.register(id_ExtKeyUsage, "ExtKeyUsage", ExtKeyUsage);
      ExtensionValueFactory2.register(id_CertificateIssuer, "CertificateIssuer", GeneralNames);
      ExtensionValueFactory2.register(id_AuthorityInfoAccess, "AuthorityInfoAccess", InfoAccess);
      ExtensionValueFactory2.register(id_SubjectInfoAccess, "SubjectInfoAccess", InfoAccess);
      ExtensionValueFactory2.register(id_IssuingDistributionPoint, "IssuingDistributionPoint", IssuingDistributionPoint);
      ExtensionValueFactory2.register(id_NameConstraints, "NameConstraints", NameConstraints);
      ExtensionValueFactory2.register(id_PolicyConstraints, "PolicyConstraints", PolicyConstraints);
      ExtensionValueFactory2.register(id_PolicyMappings, "PolicyMappings", PolicyMappings);
      ExtensionValueFactory2.register(id_PrivateKeyUsagePeriod, "PrivateKeyUsagePeriod", PrivateKeyUsagePeriod);
      ExtensionValueFactory2.register(id_QCStatements, "QCStatements", QCStatements);
      ExtensionValueFactory2.register(id_SignedCertificateTimestampList, "SignedCertificateTimestampList", SignedCertificateTimestampList);
      ExtensionValueFactory2.register(id_SubjectDirectoryAttributes, "SubjectDirectoryAttributes", SubjectDirectoryAttributes);
    }
    return this.types;
  }
  static fromBER(id, raw) {
    const asn1 = fromBER(raw);
    if (asn1.offset === -1) return null;
    const item = this.find(id);
    if (item) try {
      return new item.type({ schema: asn1.result });
    } catch {
      const res = new item.type();
      res.parsingError = `Incorrectly formatted value of extension ${item.name} (${id})`;
      return res;
    }
    return asn1.result;
  }
  static find(id) {
    return this.getItems()[id] || null;
  }
  static register(id, name, type) {
    this.getItems()[id] = {
      name,
      type
    };
  }
};
var EXTN_ID = "extnID";
var CRITICAL = "critical";
var EXTN_VALUE = "extnValue";
var PARSED_VALUE$5 = "parsedValue";
var CLEAR_PROPS$62 = [
  EXTN_ID,
  CRITICAL,
  EXTN_VALUE
];
var Extension = class Extension2 extends PkiObject {
  static {
    this.CLASS_NAME = "Extension";
  }
  get parsedValue() {
    if (this._parsedValue === void 0) {
      const parsedValue = ExtensionValueFactory.fromBER(this.extnID, this.extnValue.valueBlock.valueHexView);
      this._parsedValue = parsedValue;
    }
    return this._parsedValue || void 0;
  }
  set parsedValue(value) {
    this._parsedValue = value;
  }
  constructor(parameters = {}) {
    super();
    this.extnID = parameters[EXTN_ID] ?? Extension2.defaultValues(EXTN_ID);
    this.critical = parameters[CRITICAL] ?? Extension2.defaultValues(CRITICAL);
    if (EXTN_VALUE in parameters) this.extnValue = new OctetString({ valueHex: parameters.extnValue });
    else this.extnValue = Extension2.defaultValues(EXTN_VALUE);
    if (PARSED_VALUE$5 in parameters) this.parsedValue = parameters[PARSED_VALUE$5] ?? Extension2.defaultValues(PARSED_VALUE$5);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case EXTN_ID:
        return "";
      case CRITICAL:
        return false;
      case EXTN_VALUE:
        return new OctetString();
      case PARSED_VALUE$5:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new ObjectIdentifier({ name: names.extnID || "" }),
        new Boolean2({
          name: names.critical || "",
          optional: true
        }),
        new OctetString({ name: names.extnValue || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$62) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Extension2.schema({ names: {
      extnID: EXTN_ID,
      critical: CRITICAL,
      extnValue: EXTN_VALUE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.extnID = asn1.result.extnID.valueBlock.toString();
    if (CRITICAL in asn1.result) this.critical = asn1.result.critical.valueBlock.value;
    this.extnValue = asn1.result.extnValue;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.extnID }));
    if (this.critical !== Extension2.defaultValues(CRITICAL)) outputArray.push(new Boolean2({ value: this.critical }));
    outputArray.push(this.extnValue);
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const object = {
      extnID: this.extnID,
      extnValue: this.extnValue.toJSON()
    };
    if (this.critical !== Extension2.defaultValues(CRITICAL)) object.critical = this.critical;
    if (this.parsedValue && this.parsedValue.toJSON) object.parsedValue = this.parsedValue.toJSON();
    return object;
  }
};
var EXTENSIONS$4 = "extensions";
var CLEAR_PROPS$61 = [EXTENSIONS$4];
var Extensions = class Extensions2 extends PkiObject {
  static {
    this.CLASS_NAME = "Extensions";
  }
  constructor(parameters = {}) {
    super();
    this.extensions = parameters[EXTENSIONS$4] ?? Extensions2.defaultValues(EXTENSIONS$4);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case EXTENSIONS$4:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}, optional = false) {
    const names = parameters.names ?? {};
    return new Sequence({
      optional,
      name: names.blockName || "",
      value: [new Repeated({
        name: names.extensions || "",
        value: Extension.schema(names.extension || {})
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$61) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Extensions2.schema({ names: { extensions: EXTENSIONS$4 } }));
    AsnError.assertSchema(asn1, this.className);
    this.extensions = Array.from(asn1.result.extensions, (element) => new Extension({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.extensions, (o) => o.toSchema()) });
  }
  toJSON() {
    return { extensions: this.extensions.map((o) => o.toJSON()) };
  }
};
var ISSUER$4 = "issuer";
var SERIAL_NUMBER$5 = "serialNumber";
var ISSUER_UID = "issuerUID";
var CLEAR_PROPS$60 = [
  ISSUER$4,
  SERIAL_NUMBER$5,
  ISSUER_UID
];
var IssuerSerial = class IssuerSerial2 extends PkiObject {
  static {
    this.CLASS_NAME = "IssuerSerial";
  }
  constructor(parameters = {}) {
    super();
    this.issuer = parameters[ISSUER$4] ?? IssuerSerial2.defaultValues(ISSUER$4);
    this.serialNumber = parameters[SERIAL_NUMBER$5] ?? IssuerSerial2.defaultValues(SERIAL_NUMBER$5);
    if (ISSUER_UID in parameters) this.issuerUID = parameters[ISSUER_UID] ?? IssuerSerial2.defaultValues(ISSUER_UID);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ISSUER$4:
        return new GeneralNames();
      case SERIAL_NUMBER$5:
        return new Integer();
      case ISSUER_UID:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        GeneralNames.schema(names.issuer || {}),
        new Integer({ name: names.serialNumber || "" }),
        new BitString({
          optional: true,
          name: names.issuerUID || ""
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$60) delete schema[prop];
    const asn1 = compareSchema(schema, schema, IssuerSerial2.schema({ names: {
      issuer: { names: { blockName: ISSUER$4 } },
      serialNumber: SERIAL_NUMBER$5,
      issuerUID: ISSUER_UID
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.issuer = new GeneralNames({ schema: asn1.result.issuer });
    this.serialNumber = asn1.result.serialNumber;
    if (ISSUER_UID in asn1.result) this.issuerUID = asn1.result.issuerUID;
  }
  toSchema() {
    const result = new Sequence({ value: [this.issuer.toSchema(), this.serialNumber] });
    if (this.issuerUID) result.valueBlock.value.push(this.issuerUID);
    return result;
  }
  toJSON() {
    const result = {
      issuer: this.issuer.toJSON(),
      serialNumber: this.serialNumber.toJSON()
    };
    if (this.issuerUID) result.issuerUID = this.issuerUID.toJSON();
    return result;
  }
};
var VERSION$16 = "version";
var BASE_CERTIFICATE_ID$2 = "baseCertificateID";
var SUBJECT_NAME = "subjectName";
var ISSUER$3 = "issuer";
var SIGNATURE$5 = "signature";
var SERIAL_NUMBER$4 = "serialNumber";
var ATTR_CERT_VALIDITY_PERIOD$1 = "attrCertValidityPeriod";
var ATTRIBUTES$3 = "attributes";
var ISSUER_UNIQUE_ID$1 = "issuerUniqueID";
var EXTENSIONS$3 = "extensions";
var CLEAR_PROPS$59 = [
  VERSION$16,
  BASE_CERTIFICATE_ID$2,
  SUBJECT_NAME,
  ISSUER$3,
  SIGNATURE$5,
  SERIAL_NUMBER$4,
  ATTR_CERT_VALIDITY_PERIOD$1,
  ATTRIBUTES$3,
  ISSUER_UNIQUE_ID$1,
  EXTENSIONS$3
];
var AttributeCertificateInfoV1 = class AttributeCertificateInfoV12 extends PkiObject {
  static {
    this.CLASS_NAME = "AttributeCertificateInfoV1";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$16] ?? AttributeCertificateInfoV12.defaultValues(VERSION$16);
    if (BASE_CERTIFICATE_ID$2 in parameters) this.baseCertificateID = parameters[BASE_CERTIFICATE_ID$2] ?? AttributeCertificateInfoV12.defaultValues(BASE_CERTIFICATE_ID$2);
    if (SUBJECT_NAME in parameters) this.subjectName = parameters[SUBJECT_NAME] ?? AttributeCertificateInfoV12.defaultValues(SUBJECT_NAME);
    this.issuer = parameters[ISSUER$3] ?? AttributeCertificateInfoV12.defaultValues(ISSUER$3);
    this.signature = parameters[SIGNATURE$5] ?? AttributeCertificateInfoV12.defaultValues(SIGNATURE$5);
    this.serialNumber = parameters[SERIAL_NUMBER$4] ?? AttributeCertificateInfoV12.defaultValues(SERIAL_NUMBER$4);
    this.attrCertValidityPeriod = parameters[ATTR_CERT_VALIDITY_PERIOD$1] ?? AttributeCertificateInfoV12.defaultValues(ATTR_CERT_VALIDITY_PERIOD$1);
    this.attributes = parameters[ATTRIBUTES$3] ?? AttributeCertificateInfoV12.defaultValues(ATTRIBUTES$3);
    if (ISSUER_UNIQUE_ID$1 in parameters) this.issuerUniqueID = parameters[ISSUER_UNIQUE_ID$1] ?? AttributeCertificateInfoV12.defaultValues(ISSUER_UNIQUE_ID$1);
    if (EXTENSIONS$3 in parameters) this.extensions = parameters[EXTENSIONS$3] ?? AttributeCertificateInfoV12.defaultValues(EXTENSIONS$3);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$16:
        return 0;
      case BASE_CERTIFICATE_ID$2:
        return new IssuerSerial();
      case SUBJECT_NAME:
        return new GeneralNames();
      case ISSUER$3:
        return new GeneralNames();
      case SIGNATURE$5:
        return new AlgorithmIdentifier();
      case SERIAL_NUMBER$4:
        return new Integer();
      case ATTR_CERT_VALIDITY_PERIOD$1:
        return new AttCertValidityPeriod();
      case ATTRIBUTES$3:
        return [];
      case ISSUER_UNIQUE_ID$1:
        return new BitString();
      case EXTENSIONS$3:
        return new Extensions();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        new Choice({ value: [new Constructed({
          name: names.baseCertificateID || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: IssuerSerial.schema().valueBlock.value
        }), new Constructed({
          name: names.subjectName || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: GeneralNames.schema().valueBlock.value
        })] }),
        GeneralNames.schema({ names: { blockName: names.issuer || "" } }),
        AlgorithmIdentifier.schema(names.signature || {}),
        new Integer({ name: names.serialNumber || "" }),
        AttCertValidityPeriod.schema(names.attrCertValidityPeriod || {}),
        new Sequence({
          name: names.attributes || "",
          value: [new Repeated({ value: Attribute.schema() })]
        }),
        new BitString({
          optional: true,
          name: names.issuerUniqueID || ""
        }),
        Extensions.schema(names.extensions || {}, true)
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$59) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AttributeCertificateInfoV12.schema({ names: {
      version: VERSION$16,
      baseCertificateID: BASE_CERTIFICATE_ID$2,
      subjectName: SUBJECT_NAME,
      issuer: ISSUER$3,
      signature: { names: { blockName: SIGNATURE$5 } },
      serialNumber: SERIAL_NUMBER$4,
      attrCertValidityPeriod: { names: { blockName: ATTR_CERT_VALIDITY_PERIOD$1 } },
      attributes: ATTRIBUTES$3,
      issuerUniqueID: ISSUER_UNIQUE_ID$1,
      extensions: { names: { blockName: EXTENSIONS$3 } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    if (BASE_CERTIFICATE_ID$2 in asn1.result) this.baseCertificateID = new IssuerSerial({ schema: new Sequence({ value: asn1.result.baseCertificateID.valueBlock.value }) });
    if (SUBJECT_NAME in asn1.result) this.subjectName = new GeneralNames({ schema: new Sequence({ value: asn1.result.subjectName.valueBlock.value }) });
    this.issuer = asn1.result.issuer;
    this.signature = new AlgorithmIdentifier({ schema: asn1.result.signature });
    this.serialNumber = asn1.result.serialNumber;
    this.attrCertValidityPeriod = new AttCertValidityPeriod({ schema: asn1.result.attrCertValidityPeriod });
    this.attributes = Array.from(asn1.result.attributes.valueBlock.value, (element) => new Attribute({ schema: element }));
    if (ISSUER_UNIQUE_ID$1 in asn1.result) this.issuerUniqueID = asn1.result.issuerUniqueID;
    if (EXTENSIONS$3 in asn1.result) this.extensions = new Extensions({ schema: asn1.result.extensions });
  }
  toSchema() {
    const result = new Sequence({ value: [new Integer({ value: this.version })] });
    if (this.baseCertificateID) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: this.baseCertificateID.toSchema().valueBlock.value
    }));
    if (this.subjectName) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: this.subjectName.toSchema().valueBlock.value
    }));
    result.valueBlock.value.push(this.issuer.toSchema());
    result.valueBlock.value.push(this.signature.toSchema());
    result.valueBlock.value.push(this.serialNumber);
    result.valueBlock.value.push(this.attrCertValidityPeriod.toSchema());
    result.valueBlock.value.push(new Sequence({ value: Array.from(this.attributes, (o) => o.toSchema()) }));
    if (this.issuerUniqueID) result.valueBlock.value.push(this.issuerUniqueID);
    if (this.extensions) result.valueBlock.value.push(this.extensions.toSchema());
    return result;
  }
  toJSON() {
    const result = { version: this.version };
    if (this.baseCertificateID) result.baseCertificateID = this.baseCertificateID.toJSON();
    if (this.subjectName) result.subjectName = this.subjectName.toJSON();
    result.issuer = this.issuer.toJSON();
    result.signature = this.signature.toJSON();
    result.serialNumber = this.serialNumber.toJSON();
    result.attrCertValidityPeriod = this.attrCertValidityPeriod.toJSON();
    result.attributes = Array.from(this.attributes, (o) => o.toJSON());
    if (this.issuerUniqueID) result.issuerUniqueID = this.issuerUniqueID.toJSON();
    if (this.extensions) result.extensions = this.extensions.toJSON();
    return result;
  }
};
var ACINFO$1 = "acinfo";
var SIGNATURE_ALGORITHM$6 = "signatureAlgorithm";
var SIGNATURE_VALUE$3 = "signatureValue";
var CLEAR_PROPS$58 = [
  ACINFO$1,
  SIGNATURE_VALUE$3,
  SIGNATURE_ALGORITHM$6
];
var AttributeCertificateV1 = class AttributeCertificateV12 extends PkiObject {
  static {
    this.CLASS_NAME = "AttributeCertificateV1";
  }
  constructor(parameters = {}) {
    super();
    this.acinfo = parameters[ACINFO$1] ?? AttributeCertificateV12.defaultValues(ACINFO$1);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$6] ?? AttributeCertificateV12.defaultValues(SIGNATURE_ALGORITHM$6);
    this.signatureValue = parameters[SIGNATURE_VALUE$3] ?? AttributeCertificateV12.defaultValues(SIGNATURE_VALUE$3);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ACINFO$1:
        return new AttributeCertificateInfoV1();
      case SIGNATURE_ALGORITHM$6:
        return new AlgorithmIdentifier();
      case SIGNATURE_VALUE$3:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        AttributeCertificateInfoV1.schema(names.acinfo || {}),
        AlgorithmIdentifier.schema(names.signatureAlgorithm || {}),
        new BitString({ name: names.signatureValue || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$58) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AttributeCertificateV12.schema({ names: {
      acinfo: { names: { blockName: ACINFO$1 } },
      signatureAlgorithm: { names: { blockName: SIGNATURE_ALGORITHM$6 } },
      signatureValue: SIGNATURE_VALUE$3
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.acinfo = new AttributeCertificateInfoV1({ schema: asn1.result.acinfo });
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.signatureAlgorithm });
    this.signatureValue = asn1.result.signatureValue;
  }
  toSchema() {
    return new Sequence({ value: [
      this.acinfo.toSchema(),
      this.signatureAlgorithm.toSchema(),
      this.signatureValue
    ] });
  }
  toJSON() {
    return {
      acinfo: this.acinfo.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signatureValue: this.signatureValue.toJSON()
    };
  }
};
var DIGESTED_OBJECT_TYPE = "digestedObjectType";
var OTHER_OBJECT_TYPE_ID = "otherObjectTypeID";
var DIGEST_ALGORITHM$2 = "digestAlgorithm";
var OBJECT_DIGEST = "objectDigest";
var CLEAR_PROPS$57 = [
  DIGESTED_OBJECT_TYPE,
  OTHER_OBJECT_TYPE_ID,
  DIGEST_ALGORITHM$2,
  OBJECT_DIGEST
];
var ObjectDigestInfo = class ObjectDigestInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "ObjectDigestInfo";
  }
  constructor(parameters = {}) {
    super();
    this.digestedObjectType = parameters[DIGESTED_OBJECT_TYPE] ?? ObjectDigestInfo2.defaultValues(DIGESTED_OBJECT_TYPE);
    if (OTHER_OBJECT_TYPE_ID in parameters) this.otherObjectTypeID = parameters[OTHER_OBJECT_TYPE_ID] ?? ObjectDigestInfo2.defaultValues(OTHER_OBJECT_TYPE_ID);
    this.digestAlgorithm = parameters[DIGEST_ALGORITHM$2] ?? ObjectDigestInfo2.defaultValues(DIGEST_ALGORITHM$2);
    this.objectDigest = parameters[OBJECT_DIGEST] ?? ObjectDigestInfo2.defaultValues(OBJECT_DIGEST);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case DIGESTED_OBJECT_TYPE:
        return new Enumerated();
      case OTHER_OBJECT_TYPE_ID:
        return new ObjectIdentifier();
      case DIGEST_ALGORITHM$2:
        return new AlgorithmIdentifier();
      case OBJECT_DIGEST:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Enumerated({ name: names.digestedObjectType || "" }),
        new ObjectIdentifier({
          optional: true,
          name: names.otherObjectTypeID || ""
        }),
        AlgorithmIdentifier.schema(names.digestAlgorithm || {}),
        new BitString({ name: names.objectDigest || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$57) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ObjectDigestInfo2.schema({ names: {
      digestedObjectType: DIGESTED_OBJECT_TYPE,
      otherObjectTypeID: OTHER_OBJECT_TYPE_ID,
      digestAlgorithm: { names: { blockName: DIGEST_ALGORITHM$2 } },
      objectDigest: OBJECT_DIGEST
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.digestedObjectType = asn1.result.digestedObjectType;
    if (OTHER_OBJECT_TYPE_ID in asn1.result) this.otherObjectTypeID = asn1.result.otherObjectTypeID;
    this.digestAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.digestAlgorithm });
    this.objectDigest = asn1.result.objectDigest;
  }
  toSchema() {
    const result = new Sequence({ value: [this.digestedObjectType] });
    if (this.otherObjectTypeID) result.valueBlock.value.push(this.otherObjectTypeID);
    result.valueBlock.value.push(this.digestAlgorithm.toSchema());
    result.valueBlock.value.push(this.objectDigest);
    return result;
  }
  toJSON() {
    const result = {
      digestedObjectType: this.digestedObjectType.toJSON(),
      digestAlgorithm: this.digestAlgorithm.toJSON(),
      objectDigest: this.objectDigest.toJSON()
    };
    if (this.otherObjectTypeID) result.otherObjectTypeID = this.otherObjectTypeID.toJSON();
    return result;
  }
};
var ISSUER_NAME = "issuerName";
var BASE_CERTIFICATE_ID$1 = "baseCertificateID";
var OBJECT_DIGEST_INFO$1 = "objectDigestInfo";
var CLEAR_PROPS$56 = [
  ISSUER_NAME,
  BASE_CERTIFICATE_ID$1,
  OBJECT_DIGEST_INFO$1
];
var V2Form = class V2Form2 extends PkiObject {
  static {
    this.CLASS_NAME = "V2Form";
  }
  constructor(parameters = {}) {
    super();
    if (ISSUER_NAME in parameters) this.issuerName = parameters[ISSUER_NAME] ?? V2Form2.defaultValues(ISSUER_NAME);
    if (BASE_CERTIFICATE_ID$1 in parameters) this.baseCertificateID = parameters[BASE_CERTIFICATE_ID$1] ?? V2Form2.defaultValues(BASE_CERTIFICATE_ID$1);
    if (OBJECT_DIGEST_INFO$1 in parameters) this.objectDigestInfo = parameters[OBJECT_DIGEST_INFO$1] ?? V2Form2.defaultValues(OBJECT_DIGEST_INFO$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ISSUER_NAME:
        return new GeneralNames();
      case BASE_CERTIFICATE_ID$1:
        return new IssuerSerial();
      case OBJECT_DIGEST_INFO$1:
        return new ObjectDigestInfo();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        GeneralNames.schema({ names: { blockName: names.issuerName } }, true),
        new Constructed({
          optional: true,
          name: names.baseCertificateID || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: IssuerSerial.schema().valueBlock.value
        }),
        new Constructed({
          optional: true,
          name: names.objectDigestInfo || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: ObjectDigestInfo.schema().valueBlock.value
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$56) delete schema[prop];
    const asn1 = compareSchema(schema, schema, V2Form2.schema({ names: {
      issuerName: ISSUER_NAME,
      baseCertificateID: BASE_CERTIFICATE_ID$1,
      objectDigestInfo: OBJECT_DIGEST_INFO$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (ISSUER_NAME in asn1.result) this.issuerName = new GeneralNames({ schema: asn1.result.issuerName });
    if (BASE_CERTIFICATE_ID$1 in asn1.result) this.baseCertificateID = new IssuerSerial({ schema: new Sequence({ value: asn1.result.baseCertificateID.valueBlock.value }) });
    if (OBJECT_DIGEST_INFO$1 in asn1.result) this.objectDigestInfo = new ObjectDigestInfo({ schema: new Sequence({ value: asn1.result.objectDigestInfo.valueBlock.value }) });
  }
  toSchema() {
    const result = new Sequence();
    if (this.issuerName) result.valueBlock.value.push(this.issuerName.toSchema());
    if (this.baseCertificateID) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: this.baseCertificateID.toSchema().valueBlock.value
    }));
    if (this.objectDigestInfo) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: this.objectDigestInfo.toSchema().valueBlock.value
    }));
    return result;
  }
  toJSON() {
    const result = {};
    if (this.issuerName) result.issuerName = this.issuerName.toJSON();
    if (this.baseCertificateID) result.baseCertificateID = this.baseCertificateID.toJSON();
    if (this.objectDigestInfo) result.objectDigestInfo = this.objectDigestInfo.toJSON();
    return result;
  }
};
var BASE_CERTIFICATE_ID = "baseCertificateID";
var ENTITY_NAME = "entityName";
var OBJECT_DIGEST_INFO = "objectDigestInfo";
var CLEAR_PROPS$55 = [
  BASE_CERTIFICATE_ID,
  ENTITY_NAME,
  OBJECT_DIGEST_INFO
];
var Holder = class Holder2 extends PkiObject {
  static {
    this.CLASS_NAME = "Holder";
  }
  constructor(parameters = {}) {
    super();
    if (BASE_CERTIFICATE_ID in parameters) this.baseCertificateID = parameters[BASE_CERTIFICATE_ID] ?? Holder2.defaultValues(BASE_CERTIFICATE_ID);
    if (ENTITY_NAME in parameters) this.entityName = parameters[ENTITY_NAME] ?? Holder2.defaultValues(ENTITY_NAME);
    if (OBJECT_DIGEST_INFO in parameters) this.objectDigestInfo = parameters[OBJECT_DIGEST_INFO] ?? Holder2.defaultValues(OBJECT_DIGEST_INFO);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case BASE_CERTIFICATE_ID:
        return new IssuerSerial();
      case ENTITY_NAME:
        return new GeneralNames();
      case OBJECT_DIGEST_INFO:
        return new ObjectDigestInfo();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Constructed({
          optional: true,
          name: names.baseCertificateID || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: IssuerSerial.schema().valueBlock.value
        }),
        new Constructed({
          optional: true,
          name: names.entityName || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: GeneralNames.schema().valueBlock.value
        }),
        new Constructed({
          optional: true,
          name: names.objectDigestInfo || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          value: ObjectDigestInfo.schema().valueBlock.value
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$55) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Holder2.schema({ names: {
      baseCertificateID: BASE_CERTIFICATE_ID,
      entityName: ENTITY_NAME,
      objectDigestInfo: OBJECT_DIGEST_INFO
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (BASE_CERTIFICATE_ID in asn1.result) this.baseCertificateID = new IssuerSerial({ schema: new Sequence({ value: asn1.result.baseCertificateID.valueBlock.value }) });
    if (ENTITY_NAME in asn1.result) this.entityName = new GeneralNames({ schema: new Sequence({ value: asn1.result.entityName.valueBlock.value }) });
    if (OBJECT_DIGEST_INFO in asn1.result) this.objectDigestInfo = new ObjectDigestInfo({ schema: new Sequence({ value: asn1.result.objectDigestInfo.valueBlock.value }) });
  }
  toSchema() {
    const result = new Sequence();
    if (this.baseCertificateID) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: this.baseCertificateID.toSchema().valueBlock.value
    }));
    if (this.entityName) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: this.entityName.toSchema().valueBlock.value
    }));
    if (this.objectDigestInfo) result.valueBlock.value.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      value: this.objectDigestInfo.toSchema().valueBlock.value
    }));
    return result;
  }
  toJSON() {
    const result = {};
    if (this.baseCertificateID) result.baseCertificateID = this.baseCertificateID.toJSON();
    if (this.entityName) result.entityName = this.entityName.toJSON();
    if (this.objectDigestInfo) result.objectDigestInfo = this.objectDigestInfo.toJSON();
    return result;
  }
};
var VERSION$15 = "version";
var HOLDER = "holder";
var ISSUER$2 = "issuer";
var SIGNATURE$4 = "signature";
var SERIAL_NUMBER$3 = "serialNumber";
var ATTR_CERT_VALIDITY_PERIOD = "attrCertValidityPeriod";
var ATTRIBUTES$2 = "attributes";
var ISSUER_UNIQUE_ID = "issuerUniqueID";
var EXTENSIONS$2 = "extensions";
var CLEAR_PROPS$54 = [
  VERSION$15,
  HOLDER,
  ISSUER$2,
  SIGNATURE$4,
  SERIAL_NUMBER$3,
  ATTR_CERT_VALIDITY_PERIOD,
  ATTRIBUTES$2,
  ISSUER_UNIQUE_ID,
  EXTENSIONS$2
];
var AttributeCertificateInfoV2 = class AttributeCertificateInfoV22 extends PkiObject {
  static {
    this.CLASS_NAME = "AttributeCertificateInfoV2";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$15] ?? AttributeCertificateInfoV22.defaultValues(VERSION$15);
    this.holder = parameters[HOLDER] ?? AttributeCertificateInfoV22.defaultValues(HOLDER);
    this.issuer = parameters[ISSUER$2] ?? AttributeCertificateInfoV22.defaultValues(ISSUER$2);
    this.signature = parameters[SIGNATURE$4] ?? AttributeCertificateInfoV22.defaultValues(SIGNATURE$4);
    this.serialNumber = parameters[SERIAL_NUMBER$3] ?? AttributeCertificateInfoV22.defaultValues(SERIAL_NUMBER$3);
    this.attrCertValidityPeriod = parameters[ATTR_CERT_VALIDITY_PERIOD] ?? AttributeCertificateInfoV22.defaultValues(ATTR_CERT_VALIDITY_PERIOD);
    this.attributes = parameters[ATTRIBUTES$2] ?? AttributeCertificateInfoV22.defaultValues(ATTRIBUTES$2);
    if (ISSUER_UNIQUE_ID in parameters) this.issuerUniqueID = parameters[ISSUER_UNIQUE_ID] ?? AttributeCertificateInfoV22.defaultValues(ISSUER_UNIQUE_ID);
    if (EXTENSIONS$2 in parameters) this.extensions = parameters[EXTENSIONS$2] ?? AttributeCertificateInfoV22.defaultValues(EXTENSIONS$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$15:
        return 1;
      case HOLDER:
        return new Holder();
      case ISSUER$2:
        return {};
      case SIGNATURE$4:
        return new AlgorithmIdentifier();
      case SERIAL_NUMBER$3:
        return new Integer();
      case ATTR_CERT_VALIDITY_PERIOD:
        return new AttCertValidityPeriod();
      case ATTRIBUTES$2:
        return [];
      case ISSUER_UNIQUE_ID:
        return new BitString();
      case EXTENSIONS$2:
        return new Extensions();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        Holder.schema(names.holder || {}),
        new Choice({ value: [GeneralNames.schema({ names: { blockName: names.issuer || "" } }), new Constructed({
          name: names.issuer || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: V2Form.schema().valueBlock.value
        })] }),
        AlgorithmIdentifier.schema(names.signature || {}),
        new Integer({ name: names.serialNumber || "" }),
        AttCertValidityPeriod.schema(names.attrCertValidityPeriod || {}),
        new Sequence({
          name: names.attributes || "",
          value: [new Repeated({ value: Attribute.schema() })]
        }),
        new BitString({
          optional: true,
          name: names.issuerUniqueID || ""
        }),
        Extensions.schema(names.extensions || {}, true)
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$54) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AttributeCertificateInfoV22.schema({ names: {
      version: VERSION$15,
      holder: { names: { blockName: HOLDER } },
      issuer: ISSUER$2,
      signature: { names: { blockName: SIGNATURE$4 } },
      serialNumber: SERIAL_NUMBER$3,
      attrCertValidityPeriod: { names: { blockName: ATTR_CERT_VALIDITY_PERIOD } },
      attributes: ATTRIBUTES$2,
      issuerUniqueID: ISSUER_UNIQUE_ID,
      extensions: { names: { blockName: EXTENSIONS$2 } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.holder = new Holder({ schema: asn1.result.holder });
    switch (asn1.result.issuer.idBlock.tagClass) {
      case 3:
        this.issuer = new V2Form({ schema: new Sequence({ value: asn1.result.issuer.valueBlock.value }) });
        break;
      default:
        throw new Error("Incorrect value for 'issuer' in AttributeCertificateInfoV2");
    }
    this.signature = new AlgorithmIdentifier({ schema: asn1.result.signature });
    this.serialNumber = asn1.result.serialNumber;
    this.attrCertValidityPeriod = new AttCertValidityPeriod({ schema: asn1.result.attrCertValidityPeriod });
    this.attributes = Array.from(asn1.result.attributes.valueBlock.value, (element) => new Attribute({ schema: element }));
    if (ISSUER_UNIQUE_ID in asn1.result) this.issuerUniqueID = asn1.result.issuerUniqueID;
    if (EXTENSIONS$2 in asn1.result) this.extensions = new Extensions({ schema: asn1.result.extensions });
  }
  toSchema() {
    const result = new Sequence({ value: [
      new Integer({ value: this.version }),
      this.holder.toSchema(),
      new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: this.issuer.toSchema().valueBlock.value
      }),
      this.signature.toSchema(),
      this.serialNumber,
      this.attrCertValidityPeriod.toSchema(),
      new Sequence({ value: Array.from(this.attributes, (o) => o.toSchema()) })
    ] });
    if (this.issuerUniqueID) result.valueBlock.value.push(this.issuerUniqueID);
    if (this.extensions) result.valueBlock.value.push(this.extensions.toSchema());
    return result;
  }
  toJSON() {
    const result = {
      version: this.version,
      holder: this.holder.toJSON(),
      issuer: this.issuer.toJSON(),
      signature: this.signature.toJSON(),
      serialNumber: this.serialNumber.toJSON(),
      attrCertValidityPeriod: this.attrCertValidityPeriod.toJSON(),
      attributes: Array.from(this.attributes, (o) => o.toJSON())
    };
    if (this.issuerUniqueID) result.issuerUniqueID = this.issuerUniqueID.toJSON();
    if (this.extensions) result.extensions = this.extensions.toJSON();
    return result;
  }
};
var ACINFO = "acinfo";
var SIGNATURE_ALGORITHM$5 = "signatureAlgorithm";
var SIGNATURE_VALUE$2 = "signatureValue";
var CLEAR_PROPS$53 = [
  ACINFO,
  SIGNATURE_ALGORITHM$5,
  SIGNATURE_VALUE$2
];
var AttributeCertificateV2 = class AttributeCertificateV22 extends PkiObject {
  static {
    this.CLASS_NAME = "AttributeCertificateV2";
  }
  constructor(parameters = {}) {
    super();
    this.acinfo = parameters[ACINFO] ?? AttributeCertificateV22.defaultValues(ACINFO);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$5] ?? AttributeCertificateV22.defaultValues(SIGNATURE_ALGORITHM$5);
    this.signatureValue = parameters[SIGNATURE_VALUE$2] ?? AttributeCertificateV22.defaultValues(SIGNATURE_VALUE$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ACINFO:
        return new AttributeCertificateInfoV2();
      case SIGNATURE_ALGORITHM$5:
        return new AlgorithmIdentifier();
      case SIGNATURE_VALUE$2:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        AttributeCertificateInfoV2.schema(names.acinfo || {}),
        AlgorithmIdentifier.schema(names.signatureAlgorithm || {}),
        new BitString({ name: names.signatureValue || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$53) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AttributeCertificateV22.schema({ names: {
      acinfo: { names: { blockName: ACINFO } },
      signatureAlgorithm: { names: { blockName: SIGNATURE_ALGORITHM$5 } },
      signatureValue: SIGNATURE_VALUE$2
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.acinfo = new AttributeCertificateInfoV2({ schema: asn1.result.acinfo });
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.signatureAlgorithm });
    this.signatureValue = asn1.result.signatureValue;
  }
  toSchema() {
    return new Sequence({ value: [
      this.acinfo.toSchema(),
      this.signatureAlgorithm.toSchema(),
      this.signatureValue
    ] });
  }
  toJSON() {
    return {
      acinfo: this.acinfo.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signatureValue: this.signatureValue.toJSON()
    };
  }
};
var CONTENT_TYPE = "contentType";
var CONTENT = "content";
var CLEAR_PROPS$52 = [CONTENT_TYPE, CONTENT];
var ContentInfo = class ContentInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "ContentInfo";
  }
  static {
    this.DATA = id_ContentType_Data;
  }
  static {
    this.SIGNED_DATA = id_ContentType_SignedData;
  }
  static {
    this.ENVELOPED_DATA = id_ContentType_EnvelopedData;
  }
  static {
    this.ENCRYPTED_DATA = id_ContentType_EncryptedData;
  }
  constructor(parameters = {}) {
    super();
    this.contentType = parameters[CONTENT_TYPE] ?? ContentInfo2.defaultValues(CONTENT_TYPE);
    this.content = parameters[CONTENT] ?? ContentInfo2.defaultValues(CONTENT);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CONTENT_TYPE:
        return "";
      case CONTENT:
        return new Any();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case CONTENT_TYPE:
        return typeof memberValue === "string" && memberValue === this.defaultValues(CONTENT_TYPE);
      case CONTENT:
        return memberValue instanceof Any;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    if ("optional" in names === false) names.optional = false;
    return new Sequence({
      name: names.blockName || "ContentInfo",
      optional: names.optional,
      value: [new ObjectIdentifier({ name: names.contentType || CONTENT_TYPE }), new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Any({ name: names.content || CONTENT })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$52) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ContentInfo2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.contentType = asn1.result.contentType.valueBlock.toString();
    this.content = asn1.result.content;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.contentType }), new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.content]
    })] });
  }
  toJSON() {
    const object = { contentType: this.contentType };
    if (!(this.content instanceof Any)) object.content = this.content.toJSON();
    return object;
  }
};
var CERT_ID$1 = "certId";
var CERT_VALUE = "certValue";
var PARSED_VALUE$4 = "parsedValue";
var CLEAR_PROPS$51 = [CERT_ID$1, CERT_VALUE];
var CertBag = class CertBag2 extends PkiObject {
  static {
    this.CLASS_NAME = "CertBag";
  }
  constructor(parameters = {}) {
    super();
    this.certId = parameters[CERT_ID$1] ?? CertBag2.defaultValues(CERT_ID$1);
    this.certValue = parameters[CERT_VALUE] ?? CertBag2.defaultValues(CERT_VALUE);
    if (PARSED_VALUE$4 in parameters) this.parsedValue = parameters[PARSED_VALUE$4] ?? CertBag2.defaultValues(PARSED_VALUE$4);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CERT_ID$1:
        return "";
      case CERT_VALUE:
        return new Any();
      case PARSED_VALUE$4:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case CERT_ID$1:
        return memberValue === "";
      case CERT_VALUE:
        return memberValue instanceof Any;
      case PARSED_VALUE$4:
        return memberValue instanceof Object && Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.id || "id" }), new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Any({ name: names.value || "value" })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$51) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertBag2.schema({ names: {
      id: CERT_ID$1,
      value: CERT_VALUE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.certId = asn1.result.certId.valueBlock.toString();
    this.certValue = asn1.result.certValue;
    const certValueHex = this.certValue.valueBlock.valueHexView;
    switch (this.certId) {
      case id_CertBag_X509Certificate:
        try {
          this.parsedValue = Certificate.fromBER(certValueHex);
        } catch {
          AttributeCertificateV2.fromBER(certValueHex);
        }
        break;
      case id_CertBag_AttributeCertificate:
        this.parsedValue = AttributeCertificateV2.fromBER(certValueHex);
        break;
      case id_CertBag_SDSICertificate:
      default:
        throw new Error(`Incorrect CERT_ID value in CertBag: ${this.certId}`);
    }
  }
  toSchema() {
    if (PARSED_VALUE$4 in this) {
      if ("acinfo" in this.parsedValue) this.certId = id_CertBag_AttributeCertificate;
      else this.certId = id_CertBag_X509Certificate;
      this.certValue = new OctetString({ valueHex: this.parsedValue.toSchema().toBER(false) });
    }
    return new Sequence({ value: [new ObjectIdentifier({ value: this.certId }), new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: ["toSchema" in this.certValue ? this.certValue.toSchema() : this.certValue]
    })] });
  }
  toJSON() {
    return {
      certId: this.certId,
      certValue: this.certValue.toJSON()
    };
  }
};
var USER_CERTIFICATE = "userCertificate";
var REVOCATION_DATE = "revocationDate";
var CRL_ENTRY_EXTENSIONS = "crlEntryExtensions";
var CLEAR_PROPS$50 = [
  USER_CERTIFICATE,
  REVOCATION_DATE,
  CRL_ENTRY_EXTENSIONS
];
var RevokedCertificate = class RevokedCertificate2 extends PkiObject {
  static {
    this.CLASS_NAME = "RevokedCertificate";
  }
  constructor(parameters = {}) {
    super();
    this.userCertificate = parameters[USER_CERTIFICATE] ?? RevokedCertificate2.defaultValues(USER_CERTIFICATE);
    this.revocationDate = parameters[REVOCATION_DATE] ?? RevokedCertificate2.defaultValues(REVOCATION_DATE);
    if (CRL_ENTRY_EXTENSIONS in parameters) this.crlEntryExtensions = parameters[CRL_ENTRY_EXTENSIONS] ?? RevokedCertificate2.defaultValues(CRL_ENTRY_EXTENSIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case USER_CERTIFICATE:
        return new Integer();
      case REVOCATION_DATE:
        return new Time();
      case CRL_ENTRY_EXTENSIONS:
        return new Extensions();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.userCertificate || USER_CERTIFICATE }),
        Time.schema({ names: {
          utcTimeName: names.revocationDate || REVOCATION_DATE,
          generalTimeName: names.revocationDate || REVOCATION_DATE
        } }),
        Extensions.schema({ names: { blockName: names.crlEntryExtensions || CRL_ENTRY_EXTENSIONS } }, true)
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$50) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RevokedCertificate2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.userCertificate = asn1.result.userCertificate;
    this.revocationDate = new Time({ schema: asn1.result.revocationDate });
    if (CRL_ENTRY_EXTENSIONS in asn1.result) this.crlEntryExtensions = new Extensions({ schema: asn1.result.crlEntryExtensions });
  }
  toSchema() {
    const outputArray = [this.userCertificate, this.revocationDate.toSchema()];
    if (this.crlEntryExtensions) outputArray.push(this.crlEntryExtensions.toSchema());
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      userCertificate: this.userCertificate.toJSON(),
      revocationDate: this.revocationDate.toJSON()
    };
    if (this.crlEntryExtensions) res.crlEntryExtensions = this.crlEntryExtensions.toJSON();
    return res;
  }
};
var TBS$3 = "tbs";
var VERSION$14 = "version";
var SIGNATURE$3 = "signature";
var ISSUER$1 = "issuer";
var THIS_UPDATE$1 = "thisUpdate";
var NEXT_UPDATE$1 = "nextUpdate";
var REVOKED_CERTIFICATES = "revokedCertificates";
var CRL_EXTENSIONS = "crlExtensions";
var SIGNATURE_ALGORITHM$4 = "signatureAlgorithm";
var SIGNATURE_VALUE$1 = "signatureValue";
var TBS_CERT_LIST = "tbsCertList";
var TBS_CERT_LIST_VERSION = `${TBS_CERT_LIST}.version`;
var TBS_CERT_LIST_SIGNATURE = `${TBS_CERT_LIST}.signature`;
var TBS_CERT_LIST_ISSUER = `${TBS_CERT_LIST}.issuer`;
var TBS_CERT_LIST_THIS_UPDATE = `${TBS_CERT_LIST}.thisUpdate`;
var TBS_CERT_LIST_NEXT_UPDATE = `${TBS_CERT_LIST}.nextUpdate`;
var TBS_CERT_LIST_REVOKED_CERTIFICATES = `${TBS_CERT_LIST}.revokedCertificates`;
var TBS_CERT_LIST_EXTENSIONS = `${TBS_CERT_LIST}.extensions`;
var CLEAR_PROPS$49 = [
  TBS_CERT_LIST,
  TBS_CERT_LIST_VERSION,
  TBS_CERT_LIST_SIGNATURE,
  TBS_CERT_LIST_ISSUER,
  TBS_CERT_LIST_THIS_UPDATE,
  TBS_CERT_LIST_NEXT_UPDATE,
  TBS_CERT_LIST_REVOKED_CERTIFICATES,
  TBS_CERT_LIST_EXTENSIONS,
  SIGNATURE_ALGORITHM$4,
  SIGNATURE_VALUE$1
];
function tbsCertList(parameters = {}) {
  const names = parameters.names ?? {};
  return new Sequence({
    name: names.blockName || TBS_CERT_LIST,
    value: [
      new Integer({
        optional: true,
        name: names.tbsCertListVersion || TBS_CERT_LIST_VERSION,
        value: 2
      }),
      AlgorithmIdentifier.schema(names.signature || { names: { blockName: TBS_CERT_LIST_SIGNATURE } }),
      RelativeDistinguishedNames.schema(names.issuer || { names: { blockName: TBS_CERT_LIST_ISSUER } }),
      Time.schema(names.tbsCertListThisUpdate || { names: {
        utcTimeName: TBS_CERT_LIST_THIS_UPDATE,
        generalTimeName: TBS_CERT_LIST_THIS_UPDATE
      } }),
      Time.schema(names.tbsCertListNextUpdate || { names: {
        utcTimeName: TBS_CERT_LIST_NEXT_UPDATE,
        generalTimeName: TBS_CERT_LIST_NEXT_UPDATE
      } }, true),
      new Sequence({
        optional: true,
        value: [new Repeated({
          name: names.tbsCertListRevokedCertificates || TBS_CERT_LIST_REVOKED_CERTIFICATES,
          value: new Sequence({ value: [
            new Integer(),
            Time.schema(),
            Extensions.schema({}, true)
          ] })
        })]
      }),
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [Extensions.schema(names.crlExtensions || { names: { blockName: TBS_CERT_LIST_EXTENSIONS } })]
      })
    ]
  });
}
var WELL_KNOWN_EXTENSIONS = [
  id_AuthorityKeyIdentifier,
  id_IssuerAltName,
  id_CRLNumber,
  id_BaseCRLNumber,
  id_IssuingDistributionPoint,
  id_FreshestCRL,
  id_AuthorityInfoAccess,
  id_CRLReason,
  id_InvalidityDate,
  id_CertificateIssuer
];
var CertificateRevocationList = class CertificateRevocationList2 extends PkiObject {
  static {
    this.CLASS_NAME = "CertificateRevocationList";
  }
  get tbs() {
    return toArrayBuffer(this.tbsView);
  }
  set tbs(value) {
    this.tbsView = new Uint8Array(value);
  }
  constructor(parameters = {}) {
    super();
    this.tbsView = new Uint8Array(parameters[TBS$3] ?? CertificateRevocationList2.defaultValues(TBS$3));
    this.version = parameters[VERSION$14] ?? CertificateRevocationList2.defaultValues(VERSION$14);
    this.signature = parameters[SIGNATURE$3] ?? CertificateRevocationList2.defaultValues(SIGNATURE$3);
    this.issuer = parameters[ISSUER$1] ?? CertificateRevocationList2.defaultValues(ISSUER$1);
    this.thisUpdate = parameters[THIS_UPDATE$1] ?? CertificateRevocationList2.defaultValues(THIS_UPDATE$1);
    if (NEXT_UPDATE$1 in parameters) this.nextUpdate = parameters[NEXT_UPDATE$1] ?? CertificateRevocationList2.defaultValues(NEXT_UPDATE$1);
    if (REVOKED_CERTIFICATES in parameters) this.revokedCertificates = parameters[REVOKED_CERTIFICATES] ?? CertificateRevocationList2.defaultValues(REVOKED_CERTIFICATES);
    if (CRL_EXTENSIONS in parameters) this.crlExtensions = parameters[CRL_EXTENSIONS] ?? CertificateRevocationList2.defaultValues(CRL_EXTENSIONS);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$4] ?? CertificateRevocationList2.defaultValues(SIGNATURE_ALGORITHM$4);
    this.signatureValue = parameters[SIGNATURE_VALUE$1] ?? CertificateRevocationList2.defaultValues(SIGNATURE_VALUE$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TBS$3:
        return EMPTY_BUFFER2;
      case VERSION$14:
        return 0;
      case SIGNATURE$3:
        return new AlgorithmIdentifier();
      case ISSUER$1:
        return new RelativeDistinguishedNames();
      case THIS_UPDATE$1:
        return new Time();
      case NEXT_UPDATE$1:
        return new Time();
      case REVOKED_CERTIFICATES:
        return [];
      case CRL_EXTENSIONS:
        return new Extensions();
      case SIGNATURE_ALGORITHM$4:
        return new AlgorithmIdentifier();
      case SIGNATURE_VALUE$1:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "CertificateList",
      value: [
        tbsCertList(parameters),
        AlgorithmIdentifier.schema(names.signatureAlgorithm || { names: { blockName: SIGNATURE_ALGORITHM$4 } }),
        new BitString({ name: names.signatureValue || SIGNATURE_VALUE$1 })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$49) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertificateRevocationList2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.tbsView = asn1.result.tbsCertList.valueBeforeDecodeView;
    if (TBS_CERT_LIST_VERSION in asn1.result) this.version = asn1.result[TBS_CERT_LIST_VERSION].valueBlock.valueDec;
    this.signature = new AlgorithmIdentifier({ schema: asn1.result[TBS_CERT_LIST_SIGNATURE] });
    this.issuer = new RelativeDistinguishedNames({ schema: asn1.result[TBS_CERT_LIST_ISSUER] });
    this.thisUpdate = new Time({ schema: asn1.result[TBS_CERT_LIST_THIS_UPDATE] });
    if (TBS_CERT_LIST_NEXT_UPDATE in asn1.result) this.nextUpdate = new Time({ schema: asn1.result[TBS_CERT_LIST_NEXT_UPDATE] });
    if (TBS_CERT_LIST_REVOKED_CERTIFICATES in asn1.result) this.revokedCertificates = Array.from(asn1.result[TBS_CERT_LIST_REVOKED_CERTIFICATES], (element) => new RevokedCertificate({ schema: element }));
    if (TBS_CERT_LIST_EXTENSIONS in asn1.result) this.crlExtensions = new Extensions({ schema: asn1.result[TBS_CERT_LIST_EXTENSIONS] });
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.signatureAlgorithm });
    this.signatureValue = asn1.result.signatureValue;
  }
  encodeTBS() {
    const outputArray = [];
    if (this.version !== CertificateRevocationList2.defaultValues(VERSION$14)) outputArray.push(new Integer({ value: this.version }));
    outputArray.push(this.signature.toSchema());
    outputArray.push(this.issuer.toSchema());
    outputArray.push(this.thisUpdate.toSchema());
    if (this.nextUpdate) outputArray.push(this.nextUpdate.toSchema());
    if (this.revokedCertificates) outputArray.push(new Sequence({ value: Array.from(this.revokedCertificates, (o) => o.toSchema()) }));
    if (this.crlExtensions) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.crlExtensions.toSchema()]
    }));
    return new Sequence({ value: outputArray });
  }
  toSchema(encodeFlag = false) {
    let tbsSchema;
    if (!encodeFlag) {
      if (!this.tbsView.byteLength) return CertificateRevocationList2.schema();
      const asn1 = fromBER(this.tbsView);
      AsnError.assert(asn1, "TBS Certificate Revocation List");
      tbsSchema = asn1.result;
    } else tbsSchema = this.encodeTBS();
    return new Sequence({ value: [
      tbsSchema,
      this.signatureAlgorithm.toSchema(),
      this.signatureValue
    ] });
  }
  toJSON() {
    const res = {
      tbs: hex_exports.encode(this.tbsView),
      version: this.version,
      signature: this.signature.toJSON(),
      issuer: this.issuer.toJSON(),
      thisUpdate: this.thisUpdate.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signatureValue: this.signatureValue.toJSON()
    };
    if (this.version !== CertificateRevocationList2.defaultValues(VERSION$14)) res.version = this.version;
    if (this.nextUpdate) res.nextUpdate = this.nextUpdate.toJSON();
    if (this.revokedCertificates) res.revokedCertificates = Array.from(this.revokedCertificates, (o) => o.toJSON());
    if (this.crlExtensions) res.crlExtensions = this.crlExtensions.toJSON();
    return res;
  }
  isCertificateRevoked(certificate) {
    if (!this.issuer.isEqual(certificate.issuer)) return false;
    if (!this.revokedCertificates) return false;
    for (const revokedCertificate of this.revokedCertificates) if (revokedCertificate.userCertificate.isEqual(certificate.serialNumber)) return true;
    return false;
  }
  async sign(privateKey, hashAlgorithm = "SHA-1", crypto2 = getCrypto(true)) {
    if (!privateKey) throw new Error("Need to provide a private key for signing");
    const signatureParameters = await crypto2.getSignatureParameters(privateKey, hashAlgorithm);
    const { parameters } = signatureParameters;
    this.signature = signatureParameters.signatureAlgorithm;
    this.signatureAlgorithm = signatureParameters.signatureAlgorithm;
    this.tbsView = new Uint8Array(this.encodeTBS().toBER());
    const signature = await crypto2.signWithPrivateKey(this.tbsView, privateKey, parameters);
    this.signatureValue = new BitString({ valueHex: signature });
  }
  async verify(parameters = {}, crypto2 = getCrypto(true)) {
    let subjectPublicKeyInfo;
    if (parameters.issuerCertificate) {
      subjectPublicKeyInfo = parameters.issuerCertificate.subjectPublicKeyInfo;
      if (!this.issuer.isEqual(parameters.issuerCertificate.subject)) return false;
    }
    if (parameters.publicKeyInfo) subjectPublicKeyInfo = parameters.publicKeyInfo;
    if (!subjectPublicKeyInfo) throw new Error("Issuer's certificate must be provided as an input parameter");
    if (this.crlExtensions) {
      for (const extension of this.crlExtensions.extensions) if (extension.critical) {
        if (!WELL_KNOWN_EXTENSIONS.includes(extension.extnID)) return false;
      }
    }
    return crypto2.verifyWithPublicKey(this.tbsView, this.signatureValue, subjectPublicKeyInfo, this.signatureAlgorithm);
  }
};
var CRL_ID = "crlId";
var CRL_VALUE = "crlValue";
var PARSED_VALUE$3 = "parsedValue";
var CLEAR_PROPS$48 = [CRL_ID, CRL_VALUE];
var CRLBag = class CRLBag2 extends PkiObject {
  static {
    this.CLASS_NAME = "CRLBag";
  }
  constructor(parameters = {}) {
    super();
    this.crlId = parameters[CRL_ID] ?? CRLBag2.defaultValues(CRL_ID);
    this.crlValue = parameters[CRL_VALUE] ?? CRLBag2.defaultValues(CRL_VALUE);
    if (PARSED_VALUE$3 in parameters) this.parsedValue = parameters[PARSED_VALUE$3] ?? CRLBag2.defaultValues(PARSED_VALUE$3);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CRL_ID:
        return "";
      case CRL_VALUE:
        return new Any();
      case PARSED_VALUE$3:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case CRL_ID:
        return memberValue === "";
      case CRL_VALUE:
        return memberValue instanceof Any;
      case PARSED_VALUE$3:
        return memberValue instanceof Object && Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.id || "id" }), new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Any({ name: names.value || "value" })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$48) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CRLBag2.schema({ names: {
      id: CRL_ID,
      value: CRL_VALUE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.crlId = asn1.result.crlId.valueBlock.toString();
    this.crlValue = asn1.result.crlValue;
    switch (this.crlId) {
      case id_CRLBag_X509CRL:
        this.parsedValue = CertificateRevocationList.fromBER(this.certValue.valueBlock.valueHex);
        break;
      default:
        throw new Error(`Incorrect CRL_ID value in CRLBag: ${this.crlId}`);
    }
  }
  toSchema() {
    if (this.parsedValue) {
      this.crlId = id_CRLBag_X509CRL;
      this.crlValue = new OctetString({ valueHex: this.parsedValue.toSchema().toBER(false) });
    }
    return new Sequence({ value: [new ObjectIdentifier({ value: this.crlId }), new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.crlValue.toSchema()]
    })] });
  }
  toJSON() {
    return {
      crlId: this.crlId,
      crlValue: this.crlValue.toJSON()
    };
  }
};
var VERSION$13 = "version";
var ENCRYPTED_CONTENT_INFO$1 = "encryptedContentInfo";
var UNPROTECTED_ATTRS$1 = "unprotectedAttrs";
var CLEAR_PROPS$47 = [
  VERSION$13,
  ENCRYPTED_CONTENT_INFO$1,
  UNPROTECTED_ATTRS$1
];
var EncryptedData = class EncryptedData2 extends PkiObject {
  static {
    this.CLASS_NAME = "EncryptedData";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$13] ?? EncryptedData2.defaultValues(VERSION$13);
    this.encryptedContentInfo = parameters[ENCRYPTED_CONTENT_INFO$1] ?? EncryptedData2.defaultValues(ENCRYPTED_CONTENT_INFO$1);
    if (UNPROTECTED_ATTRS$1 in parameters) this.unprotectedAttrs = parameters[UNPROTECTED_ATTRS$1] ?? EncryptedData2.defaultValues(UNPROTECTED_ATTRS$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$13:
        return 0;
      case ENCRYPTED_CONTENT_INFO$1:
        return new EncryptedContentInfo();
      case UNPROTECTED_ATTRS$1:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$13:
        return memberValue === 0;
      case ENCRYPTED_CONTENT_INFO$1:
        return EncryptedContentInfo.compareWithDefault("contentType", memberValue.contentType) && EncryptedContentInfo.compareWithDefault("contentEncryptionAlgorithm", memberValue.contentEncryptionAlgorithm) && EncryptedContentInfo.compareWithDefault("encryptedContent", memberValue.encryptedContent);
      case UNPROTECTED_ATTRS$1:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        EncryptedContentInfo.schema(names.encryptedContentInfo || {}),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new Repeated({
            name: names.unprotectedAttrs || "",
            value: Attribute.schema()
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$47) delete schema[prop];
    const asn1 = compareSchema(schema, schema, EncryptedData2.schema({ names: {
      version: VERSION$13,
      encryptedContentInfo: { names: { blockName: ENCRYPTED_CONTENT_INFO$1 } },
      unprotectedAttrs: UNPROTECTED_ATTRS$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.encryptedContentInfo = new EncryptedContentInfo({ schema: asn1.result.encryptedContentInfo });
    if (UNPROTECTED_ATTRS$1 in asn1.result) this.unprotectedAttrs = Array.from(asn1.result.unprotectedAttrs, (element) => new Attribute({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    outputArray.push(this.encryptedContentInfo.toSchema());
    if (this.unprotectedAttrs) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: Array.from(this.unprotectedAttrs, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      encryptedContentInfo: this.encryptedContentInfo.toJSON()
    };
    if (this.unprotectedAttrs) res.unprotectedAttrs = Array.from(this.unprotectedAttrs, (o) => o.toJSON());
    return res;
  }
  async encrypt(parameters, crypto2 = getCrypto(true)) {
    ArgumentError.assert(parameters, "parameters", "object");
    const encryptParams = {
      ...parameters,
      contentType: "1.2.840.113549.1.7.1"
    };
    this.encryptedContentInfo = await crypto2.encryptEncryptedContentInfo(encryptParams);
  }
  async decrypt(parameters, crypto2 = getCrypto(true)) {
    ArgumentError.assert(parameters, "parameters", "object");
    const decryptParams = {
      ...parameters,
      encryptedContentInfo: this.encryptedContentInfo
    };
    return crypto2.decryptEncryptedContentInfo(decryptParams);
  }
};
var ENCRYPTION_ALGORITHM = "encryptionAlgorithm";
var ENCRYPTED_DATA = "encryptedData";
var PARSED_VALUE$2 = "parsedValue";
var CLEAR_PROPS$46 = [ENCRYPTION_ALGORITHM, ENCRYPTED_DATA];
var PKCS8ShroudedKeyBag = class PKCS8ShroudedKeyBag2 extends PkiObject {
  static {
    this.CLASS_NAME = "PKCS8ShroudedKeyBag";
  }
  constructor(parameters = {}) {
    super();
    this.encryptionAlgorithm = parameters[ENCRYPTION_ALGORITHM] ?? PKCS8ShroudedKeyBag2.defaultValues(ENCRYPTION_ALGORITHM);
    this.encryptedData = parameters[ENCRYPTED_DATA] ?? PKCS8ShroudedKeyBag2.defaultValues(ENCRYPTED_DATA);
    if (PARSED_VALUE$2 in parameters) this.parsedValue = parameters[PARSED_VALUE$2] ?? PKCS8ShroudedKeyBag2.defaultValues(PARSED_VALUE$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ENCRYPTION_ALGORITHM:
        return new AlgorithmIdentifier();
      case ENCRYPTED_DATA:
        return new OctetString();
      case PARSED_VALUE$2:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case ENCRYPTION_ALGORITHM:
        return AlgorithmIdentifier.compareWithDefault("algorithmId", memberValue.algorithmId) && "algorithmParams" in memberValue === false;
      case ENCRYPTED_DATA:
        return memberValue.isEqual(PKCS8ShroudedKeyBag2.defaultValues(memberName));
      case PARSED_VALUE$2:
        return memberValue instanceof Object && Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [AlgorithmIdentifier.schema(names.encryptionAlgorithm || { names: { blockName: ENCRYPTION_ALGORITHM } }), new Choice({ value: [new OctetString({ name: names.encryptedData || ENCRYPTED_DATA }), new OctetString({
        idBlock: { isConstructed: true },
        name: names.encryptedData || ENCRYPTED_DATA
      })] })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$46) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PKCS8ShroudedKeyBag2.schema({ names: {
      encryptionAlgorithm: { names: { blockName: ENCRYPTION_ALGORITHM } },
      encryptedData: ENCRYPTED_DATA
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.encryptionAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.encryptionAlgorithm });
    this.encryptedData = asn1.result.encryptedData;
  }
  toSchema() {
    return new Sequence({ value: [this.encryptionAlgorithm.toSchema(), this.encryptedData] });
  }
  toJSON() {
    return {
      encryptionAlgorithm: this.encryptionAlgorithm.toJSON(),
      encryptedData: this.encryptedData.toJSON()
    };
  }
  async parseInternalValues(parameters, crypto2 = getCrypto(true)) {
    const decryptedData = await new EncryptedData({ encryptedContentInfo: new EncryptedContentInfo({
      contentEncryptionAlgorithm: this.encryptionAlgorithm,
      encryptedContent: this.encryptedData
    }) }).decrypt(parameters, crypto2);
    this.parsedValue = PrivateKeyInfo.fromBER(decryptedData);
  }
  async makeInternalValues(parameters, crypto2 = getCrypto(true)) {
    if (!this.parsedValue) throw new Error('Please initialize "parsedValue" first');
    const cmsEncrypted = new EncryptedData();
    const encryptParams = {
      ...parameters,
      contentToEncrypt: this.parsedValue.toSchema().toBER(false)
    };
    await cmsEncrypted.encrypt(encryptParams, crypto2);
    if (!cmsEncrypted.encryptedContentInfo.encryptedContent) throw new Error("The filed `encryptedContent` in EncryptedContentInfo is empty");
    this.encryptionAlgorithm = cmsEncrypted.encryptedContentInfo.contentEncryptionAlgorithm;
    this.encryptedData = cmsEncrypted.encryptedContentInfo.encryptedContent;
  }
};
var SECRET_TYPE_ID = "secretTypeId";
var SECRET_VALUE = "secretValue";
var CLEAR_PROPS$45 = [SECRET_TYPE_ID, SECRET_VALUE];
var SecretBag = class SecretBag2 extends PkiObject {
  static {
    this.CLASS_NAME = "SecretBag";
  }
  constructor(parameters = {}) {
    super();
    this.secretTypeId = parameters[SECRET_TYPE_ID] ?? SecretBag2.defaultValues(SECRET_TYPE_ID);
    this.secretValue = parameters[SECRET_VALUE] ?? SecretBag2.defaultValues(SECRET_VALUE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SECRET_TYPE_ID:
        return "";
      case SECRET_VALUE:
        return new Any();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case SECRET_TYPE_ID:
        return memberValue === "";
      case SECRET_VALUE:
        return memberValue instanceof Any;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.id || "id" }), new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Any({ name: names.value || "value" })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$45) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SecretBag2.schema({ names: {
      id: SECRET_TYPE_ID,
      value: SECRET_VALUE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.secretTypeId = asn1.result.secretTypeId.valueBlock.toString();
    this.secretValue = asn1.result.secretValue;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.secretTypeId }), new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.secretValue.toSchema()]
    })] });
  }
  toJSON() {
    return {
      secretTypeId: this.secretTypeId,
      secretValue: this.secretValue.toJSON()
    };
  }
};
var SafeBagValueFactory = class SafeBagValueFactory2 {
  static getItems() {
    if (!this.items) {
      this.items = {};
      SafeBagValueFactory2.register("1.2.840.113549.1.12.10.1.1", PrivateKeyInfo);
      SafeBagValueFactory2.register("1.2.840.113549.1.12.10.1.2", PKCS8ShroudedKeyBag);
      SafeBagValueFactory2.register("1.2.840.113549.1.12.10.1.3", CertBag);
      SafeBagValueFactory2.register("1.2.840.113549.1.12.10.1.4", CRLBag);
      SafeBagValueFactory2.register("1.2.840.113549.1.12.10.1.5", SecretBag);
      SafeBagValueFactory2.register("1.2.840.113549.1.12.10.1.6", SafeContents);
    }
    return this.items;
  }
  static register(id, type) {
    this.getItems()[id] = type;
  }
  static find(id) {
    return this.getItems()[id] || null;
  }
};
var BAG_ID = "bagId";
var BAG_VALUE = "bagValue";
var BAG_ATTRIBUTES = "bagAttributes";
var CLEAR_PROPS$44 = [
  BAG_ID,
  BAG_VALUE,
  BAG_ATTRIBUTES
];
var SafeBag = class SafeBag2 extends PkiObject {
  static {
    this.CLASS_NAME = "SafeBag";
  }
  constructor(parameters = {}) {
    super();
    this.bagId = parameters[BAG_ID] ?? SafeBag2.defaultValues(BAG_ID);
    this.bagValue = parameters[BAG_VALUE] ?? SafeBag2.defaultValues(BAG_VALUE);
    if (BAG_ATTRIBUTES in parameters) this.bagAttributes = parameters[BAG_ATTRIBUTES] ?? SafeBag2.defaultValues(BAG_ATTRIBUTES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case BAG_ID:
        return "";
      case BAG_VALUE:
        return new Any();
      case BAG_ATTRIBUTES:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case BAG_ID:
        return memberValue === "";
      case BAG_VALUE:
        return memberValue instanceof Any;
      case BAG_ATTRIBUTES:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new ObjectIdentifier({ name: names.bagId || BAG_ID }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Any({ name: names.bagValue || BAG_VALUE })]
        }),
        new Set2({
          optional: true,
          value: [new Repeated({
            name: names.bagAttributes || BAG_ATTRIBUTES,
            value: Attribute.schema()
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$44) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SafeBag2.schema({ names: {
      bagId: BAG_ID,
      bagValue: BAG_VALUE,
      bagAttributes: BAG_ATTRIBUTES
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.bagId = asn1.result.bagId.valueBlock.toString();
    const bagType = SafeBagValueFactory.find(this.bagId);
    if (!bagType) throw new Error(`Invalid BAG_ID for SafeBag: ${this.bagId}`);
    this.bagValue = new bagType({ schema: asn1.result.bagValue });
    if (BAG_ATTRIBUTES in asn1.result) this.bagAttributes = Array.from(asn1.result.bagAttributes, (element) => new Attribute({ schema: element }));
  }
  toSchema() {
    const outputArray = [new ObjectIdentifier({ value: this.bagId }), new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.bagValue.toSchema()]
    })];
    if (this.bagAttributes) outputArray.push(new Set2({ value: Array.from(this.bagAttributes, (o) => o.toSchema()) }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const output = {
      bagId: this.bagId,
      bagValue: this.bagValue.toJSON()
    };
    if (this.bagAttributes) output.bagAttributes = Array.from(this.bagAttributes, (o) => o.toJSON());
    return output;
  }
};
var SAFE_BUGS = "safeBags";
var SafeContents = class SafeContents2 extends PkiObject {
  static {
    this.CLASS_NAME = "SafeContents";
  }
  constructor(parameters = {}) {
    super();
    this.safeBags = parameters[SAFE_BUGS] ?? SafeContents2.defaultValues(SAFE_BUGS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SAFE_BUGS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case SAFE_BUGS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.safeBags || "",
        value: SafeBag.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of [SAFE_BUGS]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SafeContents2.schema({ names: { safeBags: SAFE_BUGS } }));
    AsnError.assertSchema(asn1, this.className);
    this.safeBags = Array.from(asn1.result.safeBags, (element) => new SafeBag({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.safeBags, (o) => o.toSchema()) });
  }
  toJSON() {
    return { safeBags: Array.from(this.safeBags, (o) => o.toJSON()) };
  }
};
var OTHER_CERT_FORMAT = "otherCertFormat";
var OTHER_CERT = "otherCert";
var CLEAR_PROPS$43 = [OTHER_CERT_FORMAT, OTHER_CERT];
var OtherCertificateFormat = class OtherCertificateFormat2 extends PkiObject {
  constructor(parameters = {}) {
    super();
    this.otherCertFormat = parameters[OTHER_CERT_FORMAT] ?? OtherCertificateFormat2.defaultValues(OTHER_CERT_FORMAT);
    this.otherCert = parameters[OTHER_CERT] ?? OtherCertificateFormat2.defaultValues(OTHER_CERT);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case OTHER_CERT_FORMAT:
        return "";
      case OTHER_CERT:
        return new Any();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.otherCertFormat || OTHER_CERT_FORMAT }), new Any({ name: names.otherCert || OTHER_CERT })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$43) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OtherCertificateFormat2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.otherCertFormat = asn1.result.otherCertFormat.valueBlock.toString();
    this.otherCert = asn1.result.otherCert;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.otherCertFormat }), this.otherCert] });
  }
  toJSON() {
    const res = { otherCertFormat: this.otherCertFormat };
    if (!(this.otherCert instanceof Any)) res.otherCert = this.otherCert.toJSON();
    return res;
  }
};
var CERTIFICATES$1 = "certificates";
var CLEAR_PROPS$42 = [CERTIFICATES$1];
var CertificateSet = class CertificateSet2 extends PkiObject {
  static {
    this.CLASS_NAME = "CertificateSet";
  }
  constructor(parameters = {}) {
    super();
    this.certificates = parameters[CERTIFICATES$1] ?? CertificateSet2.defaultValues(CERTIFICATES$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CERTIFICATES$1:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Set2({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.certificates || CERTIFICATES$1,
        value: new Choice({ value: [
          Certificate.schema(),
          new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 0
            },
            value: [new Any()]
          }),
          new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 1
            },
            value: [new Sequence()]
          }),
          new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 2
            },
            value: AttributeCertificateV2.schema().valueBlock.value
          }),
          new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 3
            },
            value: OtherCertificateFormat.schema().valueBlock.value
          })
        ] })
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$42) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertificateSet2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.certificates = Array.from(asn1.result.certificates || [], (element) => {
      const initialTagNumber = element.idBlock.tagNumber;
      if (element.idBlock.tagClass === 1) return new Certificate({ schema: element });
      const elementSequence = new Sequence({ value: element.valueBlock.value });
      switch (initialTagNumber) {
        case 1:
          if (elementSequence.valueBlock.value[0].valueBlock.value[0].valueBlock.valueDec === 1) return new AttributeCertificateV2({ schema: elementSequence });
          else return new AttributeCertificateV1({ schema: elementSequence });
        case 2:
          return new AttributeCertificateV2({ schema: elementSequence });
        case 3:
          return new OtherCertificateFormat({ schema: elementSequence });
      }
      return element;
    });
  }
  toSchema() {
    return new Set2({ value: Array.from(this.certificates, (element) => {
      switch (true) {
        case element instanceof Certificate:
          return element.toSchema();
        case element instanceof AttributeCertificateV1:
          return new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 1
            },
            value: element.toSchema().valueBlock.value
          });
        case element instanceof AttributeCertificateV2:
          return new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 2
            },
            value: element.toSchema().valueBlock.value
          });
        case element instanceof OtherCertificateFormat:
          return new Constructed({
            idBlock: {
              tagClass: 3,
              tagNumber: 3
            },
            value: element.toSchema().valueBlock.value
          });
      }
      return element.toSchema();
    }) });
  }
  toJSON() {
    return { certificates: Array.from(this.certificates, (o) => o.toJSON()) };
  }
};
var OTHER_REV_INFO_FORMAT = "otherRevInfoFormat";
var OTHER_REV_INFO = "otherRevInfo";
var CLEAR_PROPS$41 = [OTHER_REV_INFO_FORMAT, OTHER_REV_INFO];
var OtherRevocationInfoFormat = class OtherRevocationInfoFormat2 extends PkiObject {
  static {
    this.CLASS_NAME = "OtherRevocationInfoFormat";
  }
  constructor(parameters = {}) {
    super();
    this.otherRevInfoFormat = parameters[OTHER_REV_INFO_FORMAT] ?? OtherRevocationInfoFormat2.defaultValues(OTHER_REV_INFO_FORMAT);
    this.otherRevInfo = parameters[OTHER_REV_INFO] ?? OtherRevocationInfoFormat2.defaultValues(OTHER_REV_INFO);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case OTHER_REV_INFO_FORMAT:
        return "";
      case OTHER_REV_INFO:
        return new Any();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.otherRevInfoFormat || OTHER_REV_INFO_FORMAT }), new Any({ name: names.otherRevInfo || OTHER_REV_INFO })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$41) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OtherRevocationInfoFormat2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.otherRevInfoFormat = asn1.result.otherRevInfoFormat.valueBlock.toString();
    this.otherRevInfo = asn1.result.otherRevInfo;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.otherRevInfoFormat }), this.otherRevInfo] });
  }
  toJSON() {
    const res = { otherRevInfoFormat: this.otherRevInfoFormat };
    if (!(this.otherRevInfo instanceof Any)) res.otherRevInfo = this.otherRevInfo.toJSON();
    return res;
  }
};
var CRLS$3 = "crls";
var OTHER_REVOCATION_INFOS = "otherRevocationInfos";
var CLEAR_PROPS$40 = [CRLS$3];
var RevocationInfoChoices = class RevocationInfoChoices2 extends PkiObject {
  static {
    this.CLASS_NAME = "RevocationInfoChoices";
  }
  constructor(parameters = {}) {
    super();
    this.crls = parameters[CRLS$3] ?? RevocationInfoChoices2.defaultValues(CRLS$3);
    this.otherRevocationInfos = parameters[OTHER_REVOCATION_INFOS] ?? RevocationInfoChoices2.defaultValues(OTHER_REVOCATION_INFOS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CRLS$3:
        return [];
      case OTHER_REVOCATION_INFOS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Set2({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.crls || "",
        value: new Choice({ value: [CertificateRevocationList.schema(), new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new ObjectIdentifier(), new Any()]
        })] })
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$40) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RevocationInfoChoices2.schema({ names: { crls: CRLS$3 } }));
    AsnError.assertSchema(asn1, this.className);
    if (asn1.result.crls) for (const element of asn1.result.crls) if (element.idBlock.tagClass === 1) this.crls.push(new CertificateRevocationList({ schema: element }));
    else this.otherRevocationInfos.push(new OtherRevocationInfoFormat({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(...Array.from(this.crls, (o) => o.toSchema()));
    outputArray.push(...Array.from(this.otherRevocationInfos, (element) => {
      const schema = element.toSchema();
      schema.idBlock.tagClass = 3;
      schema.idBlock.tagNumber = 1;
      return schema;
    }));
    return new Set2({ value: outputArray });
  }
  toJSON() {
    return {
      crls: Array.from(this.crls, (o) => o.toJSON()),
      otherRevocationInfos: Array.from(this.otherRevocationInfos, (o) => o.toJSON())
    };
  }
};
var CERTS$3 = "certs";
var CRLS$2 = "crls";
var CLEAR_PROPS$39 = [CERTS$3, CRLS$2];
var OriginatorInfo = class OriginatorInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "OriginatorInfo";
  }
  constructor(parameters = {}) {
    super();
    this.crls = parameters[CRLS$2] ?? OriginatorInfo2.defaultValues(CRLS$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CERTS$3:
        return new CertificateSet();
      case CRLS$2:
        return new RevocationInfoChoices();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case CERTS$3:
        return memberValue.certificates.length === 0;
      case CRLS$2:
        return memberValue.crls.length === 0 && memberValue.otherRevocationInfos.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Constructed({
        name: names.certs || "",
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: CertificateSet.schema().valueBlock.value
      }), new Constructed({
        name: names.crls || "",
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: RevocationInfoChoices.schema().valueBlock.value
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$39) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OriginatorInfo2.schema({ names: {
      certs: CERTS$3,
      crls: CRLS$2
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (CERTS$3 in asn1.result) this.certs = new CertificateSet({ schema: new Set2({ value: asn1.result.certs.valueBlock.value }) });
    if (CRLS$2 in asn1.result) this.crls = new RevocationInfoChoices({ schema: new Set2({ value: asn1.result.crls.valueBlock.value }) });
  }
  toSchema() {
    const sequenceValue = [];
    if (this.certs) sequenceValue.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: this.certs.toSchema().valueBlock.value
    }));
    if (this.crls) sequenceValue.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: this.crls.toSchema().valueBlock.value
    }));
    return new Sequence({ value: sequenceValue });
  }
  toJSON() {
    const res = {};
    if (this.certs) res.certs = this.certs.toJSON();
    if (this.crls) res.crls = this.crls.toJSON();
    return res;
  }
};
var ISSUER = "issuer";
var SERIAL_NUMBER$2 = "serialNumber";
var CLEAR_PROPS$38 = [ISSUER, SERIAL_NUMBER$2];
var IssuerAndSerialNumber = class IssuerAndSerialNumber2 extends PkiObject {
  static {
    this.CLASS_NAME = "IssuerAndSerialNumber";
  }
  constructor(parameters = {}) {
    super();
    this.issuer = parameters[ISSUER] ?? IssuerAndSerialNumber2.defaultValues(ISSUER);
    this.serialNumber = parameters[SERIAL_NUMBER$2] ?? IssuerAndSerialNumber2.defaultValues(SERIAL_NUMBER$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ISSUER:
        return new RelativeDistinguishedNames();
      case SERIAL_NUMBER$2:
        return new Integer();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [RelativeDistinguishedNames.schema(names.issuer || {}), new Integer({ name: names.serialNumber || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$38) delete schema[prop];
    const asn1 = compareSchema(schema, schema, IssuerAndSerialNumber2.schema({ names: {
      issuer: { names: { blockName: ISSUER } },
      serialNumber: SERIAL_NUMBER$2
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.issuer = new RelativeDistinguishedNames({ schema: asn1.result.issuer });
    this.serialNumber = asn1.result.serialNumber;
  }
  toSchema() {
    return new Sequence({ value: [this.issuer.toSchema(), this.serialNumber] });
  }
  toJSON() {
    return {
      issuer: this.issuer.toJSON(),
      serialNumber: this.serialNumber.toJSON()
    };
  }
};
var VARIANT$3 = "variant";
var VALUE$4 = "value";
var CLEAR_PROPS$37 = ["blockName"];
var RecipientIdentifier = class RecipientIdentifier2 extends PkiObject {
  static {
    this.CLASS_NAME = "RecipientIdentifier";
  }
  constructor(parameters = {}) {
    super();
    this.variant = parameters[VARIANT$3] ?? RecipientIdentifier2.defaultValues(VARIANT$3);
    if (VALUE$4 in parameters) this.value = parameters[VALUE$4] ?? RecipientIdentifier2.defaultValues(VALUE$4);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VARIANT$3:
        return -1;
      case VALUE$4:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VARIANT$3:
        return memberValue === -1;
      case VALUE$4:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Choice({ value: [IssuerAndSerialNumber.schema({ names: { blockName: names.blockName || "" } }), new Primitive({
      name: names.blockName || "",
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      }
    })] });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$37) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RecipientIdentifier2.schema({ names: { blockName: "blockName" } }));
    AsnError.assertSchema(asn1, this.className);
    if (asn1.result.blockName.idBlock.tagClass === 1) {
      this.variant = 1;
      this.value = new IssuerAndSerialNumber({ schema: asn1.result.blockName });
    } else {
      this.variant = 2;
      this.value = new OctetString({ valueHex: asn1.result.blockName.valueBlock.valueHex });
    }
  }
  toSchema() {
    switch (this.variant) {
      case 1:
        if (!(this.value instanceof IssuerAndSerialNumber)) throw new Error("Incorrect type of RecipientIdentifier.value. It should be IssuerAndSerialNumber.");
        return this.value.toSchema();
      case 2:
        if (!(this.value instanceof OctetString)) throw new Error("Incorrect type of RecipientIdentifier.value. It should be ASN.1 OctetString.");
        return new Primitive({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          valueHex: this.value.valueBlock.valueHexView
        });
      default:
        return new Any();
    }
  }
  toJSON() {
    const res = { variant: this.variant };
    if ((this.variant === 1 || this.variant === 2) && this.value) res.value = this.value.toJSON();
    return res;
  }
};
var VERSION$12 = "version";
var RID$1 = "rid";
var KEY_ENCRYPTION_ALGORITHM$3 = "keyEncryptionAlgorithm";
var ENCRYPTED_KEY$3 = "encryptedKey";
var RECIPIENT_CERTIFICATE$1 = "recipientCertificate";
var CLEAR_PROPS$36 = [
  VERSION$12,
  RID$1,
  KEY_ENCRYPTION_ALGORITHM$3,
  ENCRYPTED_KEY$3
];
var KeyTransRecipientInfo = class KeyTransRecipientInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "KeyTransRecipientInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$12] ?? KeyTransRecipientInfo2.defaultValues(VERSION$12);
    this.rid = parameters[RID$1] ?? KeyTransRecipientInfo2.defaultValues(RID$1);
    this.keyEncryptionAlgorithm = parameters[KEY_ENCRYPTION_ALGORITHM$3] ?? KeyTransRecipientInfo2.defaultValues(KEY_ENCRYPTION_ALGORITHM$3);
    this.encryptedKey = parameters[ENCRYPTED_KEY$3] ?? KeyTransRecipientInfo2.defaultValues(ENCRYPTED_KEY$3);
    this.recipientCertificate = parameters[RECIPIENT_CERTIFICATE$1] ?? KeyTransRecipientInfo2.defaultValues(RECIPIENT_CERTIFICATE$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$12:
        return -1;
      case RID$1:
        return {};
      case KEY_ENCRYPTION_ALGORITHM$3:
        return new AlgorithmIdentifier();
      case ENCRYPTED_KEY$3:
        return new OctetString();
      case RECIPIENT_CERTIFICATE$1:
        return new Certificate();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$12:
        return memberValue === KeyTransRecipientInfo2.defaultValues(VERSION$12);
      case RID$1:
        return Object.keys(memberValue).length === 0;
      case KEY_ENCRYPTION_ALGORITHM$3:
      case ENCRYPTED_KEY$3:
        return memberValue.isEqual(KeyTransRecipientInfo2.defaultValues(memberName));
      case RECIPIENT_CERTIFICATE$1:
        return false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        RecipientIdentifier.schema(names.rid || {}),
        AlgorithmIdentifier.schema(names.keyEncryptionAlgorithm || {}),
        new OctetString({ name: names.encryptedKey || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$36) delete schema[prop];
    const asn1 = compareSchema(schema, schema, KeyTransRecipientInfo2.schema({ names: {
      version: VERSION$12,
      rid: { names: { blockName: RID$1 } },
      keyEncryptionAlgorithm: { names: { blockName: KEY_ENCRYPTION_ALGORITHM$3 } },
      encryptedKey: ENCRYPTED_KEY$3
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    if (asn1.result.rid.idBlock.tagClass === 3) this.rid = new OctetString({ valueHex: asn1.result.rid.valueBlock.valueHex });
    else this.rid = new IssuerAndSerialNumber({ schema: asn1.result.rid });
    this.keyEncryptionAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.keyEncryptionAlgorithm });
    this.encryptedKey = asn1.result.encryptedKey;
  }
  toSchema() {
    const outputArray = [];
    if (this.rid instanceof IssuerAndSerialNumber) {
      this.version = 0;
      outputArray.push(new Integer({ value: this.version }));
      outputArray.push(this.rid.toSchema());
    } else {
      this.version = 2;
      outputArray.push(new Integer({ value: this.version }));
      outputArray.push(new Primitive({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        valueHex: this.rid.valueBlock.valueHexView
      }));
    }
    outputArray.push(this.keyEncryptionAlgorithm.toSchema());
    outputArray.push(this.encryptedKey);
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    return {
      version: this.version,
      rid: this.rid.toJSON(),
      keyEncryptionAlgorithm: this.keyEncryptionAlgorithm.toJSON(),
      encryptedKey: this.encryptedKey.toJSON()
    };
  }
};
var ALGORITHM = "algorithm";
var PUBLIC_KEY = "publicKey";
var CLEAR_PROPS$35 = [ALGORITHM, PUBLIC_KEY];
var OriginatorPublicKey = class OriginatorPublicKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "OriginatorPublicKey";
  }
  constructor(parameters = {}) {
    super();
    this.algorithm = parameters[ALGORITHM] ?? OriginatorPublicKey2.defaultValues(ALGORITHM);
    this.publicKey = parameters[PUBLIC_KEY] ?? OriginatorPublicKey2.defaultValues(PUBLIC_KEY);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ALGORITHM:
        return new AlgorithmIdentifier();
      case PUBLIC_KEY:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case ALGORITHM:
      case PUBLIC_KEY:
        return memberValue.isEqual(OriginatorPublicKey2.defaultValues(memberName));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [AlgorithmIdentifier.schema(names.algorithm || {}), new BitString({ name: names.publicKey || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$35) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OriginatorPublicKey2.schema({ names: {
      algorithm: { names: { blockName: ALGORITHM } },
      publicKey: PUBLIC_KEY
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.algorithm = new AlgorithmIdentifier({ schema: asn1.result.algorithm });
    this.publicKey = asn1.result.publicKey;
  }
  toSchema() {
    return new Sequence({ value: [this.algorithm.toSchema(), this.publicKey] });
  }
  toJSON() {
    return {
      algorithm: this.algorithm.toJSON(),
      publicKey: this.publicKey.toJSON()
    };
  }
};
var VARIANT$2 = "variant";
var VALUE$3 = "value";
var CLEAR_PROPS$34 = ["blockName"];
var OriginatorIdentifierOrKey = class OriginatorIdentifierOrKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "OriginatorIdentifierOrKey";
  }
  constructor(parameters = {}) {
    super();
    this.variant = parameters[VARIANT$2] ?? OriginatorIdentifierOrKey2.defaultValues(VARIANT$2);
    if (VALUE$3 in parameters) this.value = parameters[VALUE$3] ?? OriginatorIdentifierOrKey2.defaultValues(VALUE$3);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VARIANT$2:
        return -1;
      case VALUE$3:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VARIANT$2:
        return memberValue === -1;
      case VALUE$3:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Choice({ value: [
      IssuerAndSerialNumber.schema({ names: { blockName: names.blockName || "" } }),
      new Primitive({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        name: names.blockName || ""
      }),
      new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        name: names.blockName || "",
        value: OriginatorPublicKey.schema().valueBlock.value
      })
    ] });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$34) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OriginatorIdentifierOrKey2.schema({ names: { blockName: "blockName" } }));
    AsnError.assertSchema(asn1, this.className);
    if (asn1.result.blockName.idBlock.tagClass === 1) {
      this.variant = 1;
      this.value = new IssuerAndSerialNumber({ schema: asn1.result.blockName });
    } else if (asn1.result.blockName.idBlock.tagNumber === 0) {
      asn1.result.blockName.idBlock.tagClass = 1;
      asn1.result.blockName.idBlock.tagNumber = 4;
      this.variant = 2;
      this.value = asn1.result.blockName;
    } else {
      this.variant = 3;
      this.value = new OriginatorPublicKey({ schema: new Sequence({ value: asn1.result.blockName.valueBlock.value }) });
    }
  }
  toSchema() {
    switch (this.variant) {
      case 1:
        return this.value.toSchema();
      case 2:
        this.value.idBlock.tagClass = 3;
        this.value.idBlock.tagNumber = 0;
        return this.value;
      case 3: {
        const _schema = this.value.toSchema();
        _schema.idBlock.tagClass = 3;
        _schema.idBlock.tagNumber = 1;
        return _schema;
      }
      default:
        return new Any();
    }
  }
  toJSON() {
    const res = { variant: this.variant };
    if (this.variant === 1 || this.variant === 2 || this.variant === 3) res.value = this.value.toJSON();
    return res;
  }
};
var KEY_ATTR_ID = "keyAttrId";
var KEY_ATTR = "keyAttr";
var CLEAR_PROPS$33 = [KEY_ATTR_ID, KEY_ATTR];
var OtherKeyAttribute = class OtherKeyAttribute2 extends PkiObject {
  static {
    this.CLASS_NAME = "OtherKeyAttribute";
  }
  constructor(parameters = {}) {
    super();
    this.keyAttrId = parameters[KEY_ATTR_ID] ?? OtherKeyAttribute2.defaultValues(KEY_ATTR_ID);
    if (KEY_ATTR in parameters) this.keyAttr = parameters[KEY_ATTR] ?? OtherKeyAttribute2.defaultValues(KEY_ATTR);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case KEY_ATTR_ID:
        return "";
      case KEY_ATTR:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case KEY_ATTR_ID:
        return typeof memberValue === "string" && memberValue === "";
      case KEY_ATTR:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      optional: names.optional || true,
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.keyAttrId || "" }), new Any({
        optional: true,
        name: names.keyAttr || ""
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$33) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OtherKeyAttribute2.schema({ names: {
      keyAttrId: KEY_ATTR_ID,
      keyAttr: KEY_ATTR
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.keyAttrId = asn1.result.keyAttrId.valueBlock.toString();
    if (KEY_ATTR in asn1.result) this.keyAttr = asn1.result.keyAttr;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.keyAttrId }));
    if (KEY_ATTR in this) outputArray.push(this.keyAttr);
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { keyAttrId: this.keyAttrId };
    if (KEY_ATTR in this) res.keyAttr = this.keyAttr.toJSON();
    return res;
  }
};
var SUBJECT_KEY_IDENTIFIER = "subjectKeyIdentifier";
var DATE$1 = "date";
var OTHER$1 = "other";
var CLEAR_PROPS$32 = [
  SUBJECT_KEY_IDENTIFIER,
  DATE$1,
  OTHER$1
];
var RecipientKeyIdentifier = class RecipientKeyIdentifier2 extends PkiObject {
  static {
    this.CLASS_NAME = "RecipientKeyIdentifier";
  }
  constructor(parameters = {}) {
    super();
    this.subjectKeyIdentifier = parameters[SUBJECT_KEY_IDENTIFIER] ?? RecipientKeyIdentifier2.defaultValues(SUBJECT_KEY_IDENTIFIER);
    if (DATE$1 in parameters) this.date = parameters[DATE$1] ?? RecipientKeyIdentifier2.defaultValues(DATE$1);
    if (OTHER$1 in parameters) this.other = parameters[OTHER$1] ?? RecipientKeyIdentifier2.defaultValues(OTHER$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SUBJECT_KEY_IDENTIFIER:
        return new OctetString();
      case DATE$1:
        return new GeneralizedTime();
      case OTHER$1:
        return new OtherKeyAttribute();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case SUBJECT_KEY_IDENTIFIER:
        return memberValue.isEqual(RecipientKeyIdentifier2.defaultValues(SUBJECT_KEY_IDENTIFIER));
      case DATE$1:
        return memberValue.year === 0 && memberValue.month === 0 && memberValue.day === 0 && memberValue.hour === 0 && memberValue.minute === 0 && memberValue.second === 0 && memberValue.millisecond === 0;
      case OTHER$1:
        return memberValue.keyAttrId === "" && "keyAttr" in memberValue === false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new OctetString({ name: names.subjectKeyIdentifier || "" }),
        new GeneralizedTime({
          optional: true,
          name: names.date || ""
        }),
        OtherKeyAttribute.schema(names.other || {})
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$32) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RecipientKeyIdentifier2.schema({ names: {
      subjectKeyIdentifier: SUBJECT_KEY_IDENTIFIER,
      date: DATE$1,
      other: { names: { blockName: OTHER$1 } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.subjectKeyIdentifier = asn1.result.subjectKeyIdentifier;
    if (DATE$1 in asn1.result) this.date = asn1.result.date;
    if (OTHER$1 in asn1.result) this.other = new OtherKeyAttribute({ schema: asn1.result.other });
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.subjectKeyIdentifier);
    if (this.date) outputArray.push(this.date);
    if (this.other) outputArray.push(this.other.toSchema());
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { subjectKeyIdentifier: this.subjectKeyIdentifier.toJSON() };
    if (this.date) res.date = this.date.toJSON();
    if (this.other) res.other = this.other.toJSON();
    return res;
  }
};
var VARIANT$1 = "variant";
var VALUE$2 = "value";
var CLEAR_PROPS$31 = ["blockName"];
var KeyAgreeRecipientIdentifier = class KeyAgreeRecipientIdentifier2 extends PkiObject {
  static {
    this.CLASS_NAME = "KeyAgreeRecipientIdentifier";
  }
  constructor(parameters = {}) {
    super();
    this.variant = parameters[VARIANT$1] ?? KeyAgreeRecipientIdentifier2.defaultValues(VARIANT$1);
    this.value = parameters[VALUE$2] ?? KeyAgreeRecipientIdentifier2.defaultValues(VALUE$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VARIANT$1:
        return -1;
      case VALUE$2:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VARIANT$1:
        return memberValue === -1;
      case VALUE$2:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Choice({ value: [IssuerAndSerialNumber.schema(names.issuerAndSerialNumber || { names: { blockName: names.blockName || "" } }), new Constructed({
      name: names.blockName || "",
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: RecipientKeyIdentifier.schema(names.rKeyId || { names: { blockName: names.blockName || "" } }).valueBlock.value
    })] });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$31) delete schema[prop];
    const asn1 = compareSchema(schema, schema, KeyAgreeRecipientIdentifier2.schema({ names: { blockName: "blockName" } }));
    AsnError.assertSchema(asn1, this.className);
    if (asn1.result.blockName.idBlock.tagClass === 1) {
      this.variant = 1;
      this.value = new IssuerAndSerialNumber({ schema: asn1.result.blockName });
    } else {
      this.variant = 2;
      this.value = new RecipientKeyIdentifier({ schema: new Sequence({ value: asn1.result.blockName.valueBlock.value }) });
    }
  }
  toSchema() {
    switch (this.variant) {
      case 1:
        return this.value.toSchema();
      case 2:
        return new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: this.value.toSchema().valueBlock.value
        });
      default:
        return new Any();
    }
  }
  toJSON() {
    const res = { variant: this.variant };
    if (this.variant === 1 || this.variant === 2) res.value = this.value.toJSON();
    return res;
  }
};
var RID = "rid";
var ENCRYPTED_KEY$2 = "encryptedKey";
var CLEAR_PROPS$30 = [RID, ENCRYPTED_KEY$2];
var RecipientEncryptedKey = class RecipientEncryptedKey2 extends PkiObject {
  static {
    this.CLASS_NAME = "RecipientEncryptedKey";
  }
  constructor(parameters = {}) {
    super();
    this.rid = parameters[RID] ?? RecipientEncryptedKey2.defaultValues(RID);
    this.encryptedKey = parameters[ENCRYPTED_KEY$2] ?? RecipientEncryptedKey2.defaultValues(ENCRYPTED_KEY$2);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case RID:
        return new KeyAgreeRecipientIdentifier();
      case ENCRYPTED_KEY$2:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case RID:
        return memberValue.variant === -1 && "value" in memberValue === false;
      case ENCRYPTED_KEY$2:
        return memberValue.isEqual(RecipientEncryptedKey2.defaultValues(ENCRYPTED_KEY$2));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [KeyAgreeRecipientIdentifier.schema(names.rid || {}), new OctetString({ name: names.encryptedKey || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$30) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RecipientEncryptedKey2.schema({ names: {
      rid: { names: { blockName: RID } },
      encryptedKey: ENCRYPTED_KEY$2
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.rid = new KeyAgreeRecipientIdentifier({ schema: asn1.result.rid });
    this.encryptedKey = asn1.result.encryptedKey;
  }
  toSchema() {
    return new Sequence({ value: [this.rid.toSchema(), this.encryptedKey] });
  }
  toJSON() {
    return {
      rid: this.rid.toJSON(),
      encryptedKey: this.encryptedKey.toJSON()
    };
  }
};
var ENCRYPTED_KEYS = "encryptedKeys";
var RECIPIENT_ENCRYPTED_KEYS = "RecipientEncryptedKeys";
var CLEAR_PROPS$29 = [RECIPIENT_ENCRYPTED_KEYS];
var RecipientEncryptedKeys = class RecipientEncryptedKeys2 extends PkiObject {
  static {
    this.CLASS_NAME = "RecipientEncryptedKeys";
  }
  constructor(parameters = {}) {
    super();
    this.encryptedKeys = parameters[ENCRYPTED_KEYS] ?? RecipientEncryptedKeys2.defaultValues(ENCRYPTED_KEYS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ENCRYPTED_KEYS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case ENCRYPTED_KEYS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.RecipientEncryptedKeys || "",
        value: RecipientEncryptedKey.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$29) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RecipientEncryptedKeys2.schema({ names: { RecipientEncryptedKeys: RECIPIENT_ENCRYPTED_KEYS } }));
    AsnError.assertSchema(asn1, this.className);
    this.encryptedKeys = Array.from(asn1.result.RecipientEncryptedKeys, (element) => new RecipientEncryptedKey({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.encryptedKeys, (o) => o.toSchema()) });
  }
  toJSON() {
    return { encryptedKeys: Array.from(this.encryptedKeys, (o) => o.toJSON()) };
  }
};
var VERSION$11 = "version";
var ORIGINATOR = "originator";
var UKM = "ukm";
var KEY_ENCRYPTION_ALGORITHM$2 = "keyEncryptionAlgorithm";
var RECIPIENT_ENCRYPTED_KEY = "recipientEncryptedKeys";
var RECIPIENT_CERTIFICATE = "recipientCertificate";
var RECIPIENT_PUBLIC_KEY = "recipientPublicKey";
var CLEAR_PROPS$28 = [
  VERSION$11,
  ORIGINATOR,
  UKM,
  KEY_ENCRYPTION_ALGORITHM$2,
  RECIPIENT_ENCRYPTED_KEY
];
var KeyAgreeRecipientInfo = class KeyAgreeRecipientInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "KeyAgreeRecipientInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$11] ?? KeyAgreeRecipientInfo2.defaultValues(VERSION$11);
    this.originator = parameters[ORIGINATOR] ?? KeyAgreeRecipientInfo2.defaultValues(ORIGINATOR);
    if (UKM in parameters) this.ukm = parameters[UKM] ?? KeyAgreeRecipientInfo2.defaultValues(UKM);
    this.keyEncryptionAlgorithm = parameters[KEY_ENCRYPTION_ALGORITHM$2] ?? KeyAgreeRecipientInfo2.defaultValues(KEY_ENCRYPTION_ALGORITHM$2);
    this.recipientEncryptedKeys = parameters[RECIPIENT_ENCRYPTED_KEY] ?? KeyAgreeRecipientInfo2.defaultValues(RECIPIENT_ENCRYPTED_KEY);
    this.recipientCertificate = parameters[RECIPIENT_CERTIFICATE] ?? KeyAgreeRecipientInfo2.defaultValues(RECIPIENT_CERTIFICATE);
    this.recipientPublicKey = parameters[RECIPIENT_PUBLIC_KEY] ?? KeyAgreeRecipientInfo2.defaultValues(RECIPIENT_PUBLIC_KEY);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$11:
        return 0;
      case ORIGINATOR:
        return new OriginatorIdentifierOrKey();
      case UKM:
        return new OctetString();
      case KEY_ENCRYPTION_ALGORITHM$2:
        return new AlgorithmIdentifier();
      case RECIPIENT_ENCRYPTED_KEY:
        return new RecipientEncryptedKeys();
      case RECIPIENT_CERTIFICATE:
        return new Certificate();
      case RECIPIENT_PUBLIC_KEY:
        return null;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$11:
        return memberValue === 0;
      case ORIGINATOR:
        return memberValue.variant === -1 && "value" in memberValue === false;
      case UKM:
        return memberValue.isEqual(KeyAgreeRecipientInfo2.defaultValues(UKM));
      case KEY_ENCRYPTION_ALGORITHM$2:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case RECIPIENT_ENCRYPTED_KEY:
        return memberValue.encryptedKeys.length === 0;
      case RECIPIENT_CERTIFICATE:
        return false;
      case RECIPIENT_PUBLIC_KEY:
        return false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [OriginatorIdentifierOrKey.schema(names.originator || {})]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new OctetString({ name: names.ukm || "" })]
        }),
        AlgorithmIdentifier.schema(names.keyEncryptionAlgorithm || {}),
        RecipientEncryptedKeys.schema(names.recipientEncryptedKeys || {})
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$28) delete schema[prop];
    const asn1 = compareSchema(schema, schema, KeyAgreeRecipientInfo2.schema({ names: {
      version: VERSION$11,
      originator: { names: { blockName: ORIGINATOR } },
      ukm: UKM,
      keyEncryptionAlgorithm: { names: { blockName: KEY_ENCRYPTION_ALGORITHM$2 } },
      recipientEncryptedKeys: { names: { blockName: RECIPIENT_ENCRYPTED_KEY } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.originator = new OriginatorIdentifierOrKey({ schema: asn1.result.originator });
    if (UKM in asn1.result) this.ukm = asn1.result.ukm;
    this.keyEncryptionAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.keyEncryptionAlgorithm });
    this.recipientEncryptedKeys = new RecipientEncryptedKeys({ schema: asn1.result.recipientEncryptedKeys });
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.originator.toSchema()]
    }));
    if (this.ukm) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: [this.ukm]
    }));
    outputArray.push(this.keyEncryptionAlgorithm.toSchema());
    outputArray.push(this.recipientEncryptedKeys.toSchema());
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      originator: this.originator.toJSON(),
      keyEncryptionAlgorithm: this.keyEncryptionAlgorithm.toJSON(),
      recipientEncryptedKeys: this.recipientEncryptedKeys.toJSON()
    };
    if (this.ukm) res.ukm = this.ukm.toJSON();
    return res;
  }
};
var KEY_IDENTIFIER = "keyIdentifier";
var DATE2 = "date";
var OTHER = "other";
var CLEAR_PROPS$27 = [
  KEY_IDENTIFIER,
  DATE2,
  OTHER
];
var KEKIdentifier = class KEKIdentifier2 extends PkiObject {
  static {
    this.CLASS_NAME = "KEKIdentifier";
  }
  constructor(parameters = {}) {
    super();
    this.keyIdentifier = parameters[KEY_IDENTIFIER] ?? KEKIdentifier2.defaultValues(KEY_IDENTIFIER);
    if (DATE2 in parameters) this.date = parameters[DATE2] ?? KEKIdentifier2.defaultValues(DATE2);
    if (OTHER in parameters) this.other = parameters[OTHER] ?? KEKIdentifier2.defaultValues(OTHER);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case KEY_IDENTIFIER:
        return new OctetString();
      case DATE2:
        return new GeneralizedTime();
      case OTHER:
        return new OtherKeyAttribute();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case KEY_IDENTIFIER:
        return memberValue.isEqual(KEKIdentifier2.defaultValues(KEY_IDENTIFIER));
      case DATE2:
        return memberValue.year === 0 && memberValue.month === 0 && memberValue.day === 0 && memberValue.hour === 0 && memberValue.minute === 0 && memberValue.second === 0 && memberValue.millisecond === 0;
      case OTHER:
        return memberValue.compareWithDefault("keyAttrId", memberValue.keyAttrId) && "keyAttr" in memberValue === false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new OctetString({ name: names.keyIdentifier || "" }),
        new GeneralizedTime({
          optional: true,
          name: names.date || ""
        }),
        OtherKeyAttribute.schema(names.other || {})
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$27) delete schema[prop];
    const asn1 = compareSchema(schema, schema, KEKIdentifier2.schema({ names: {
      keyIdentifier: KEY_IDENTIFIER,
      date: DATE2,
      other: { names: { blockName: OTHER } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.keyIdentifier = asn1.result.keyIdentifier;
    if (DATE2 in asn1.result) this.date = asn1.result.date;
    if (OTHER in asn1.result) this.other = new OtherKeyAttribute({ schema: asn1.result.other });
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.keyIdentifier);
    if (this.date) outputArray.push(this.date);
    if (this.other) outputArray.push(this.other.toSchema());
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { keyIdentifier: this.keyIdentifier.toJSON() };
    if (this.date) res.date = this.date;
    if (this.other) res.other = this.other.toJSON();
    return res;
  }
};
var VERSION$10 = "version";
var KEK_ID = "kekid";
var KEY_ENCRYPTION_ALGORITHM$1 = "keyEncryptionAlgorithm";
var ENCRYPTED_KEY$1 = "encryptedKey";
var PER_DEFINED_KEK = "preDefinedKEK";
var CLEAR_PROPS$26 = [
  VERSION$10,
  KEK_ID,
  KEY_ENCRYPTION_ALGORITHM$1,
  ENCRYPTED_KEY$1
];
var KEKRecipientInfo = class KEKRecipientInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "KEKRecipientInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$10] ?? KEKRecipientInfo2.defaultValues(VERSION$10);
    this.kekid = parameters[KEK_ID] ?? KEKRecipientInfo2.defaultValues(KEK_ID);
    this.keyEncryptionAlgorithm = parameters[KEY_ENCRYPTION_ALGORITHM$1] ?? KEKRecipientInfo2.defaultValues(KEY_ENCRYPTION_ALGORITHM$1);
    this.encryptedKey = parameters[ENCRYPTED_KEY$1] ?? KEKRecipientInfo2.defaultValues(ENCRYPTED_KEY$1);
    this.preDefinedKEK = parameters[PER_DEFINED_KEK] ?? KEKRecipientInfo2.defaultValues(PER_DEFINED_KEK);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$10:
        return 0;
      case KEK_ID:
        return new KEKIdentifier();
      case KEY_ENCRYPTION_ALGORITHM$1:
        return new AlgorithmIdentifier();
      case ENCRYPTED_KEY$1:
        return new OctetString();
      case PER_DEFINED_KEK:
        return EMPTY_BUFFER2;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case "KEKRecipientInfo":
        return memberValue === KEKRecipientInfo2.defaultValues(VERSION$10);
      case KEK_ID:
        return memberValue.compareWithDefault("keyIdentifier", memberValue.keyIdentifier) && "date" in memberValue === false && "other" in memberValue === false;
      case KEY_ENCRYPTION_ALGORITHM$1:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case ENCRYPTED_KEY$1:
        return memberValue.isEqual(KEKRecipientInfo2.defaultValues(ENCRYPTED_KEY$1));
      case PER_DEFINED_KEK:
        return memberValue.byteLength === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        KEKIdentifier.schema(names.kekid || {}),
        AlgorithmIdentifier.schema(names.keyEncryptionAlgorithm || {}),
        new OctetString({ name: names.encryptedKey || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$26) delete schema[prop];
    const asn1 = compareSchema(schema, schema, KEKRecipientInfo2.schema({ names: {
      version: VERSION$10,
      kekid: { names: { blockName: KEK_ID } },
      keyEncryptionAlgorithm: { names: { blockName: KEY_ENCRYPTION_ALGORITHM$1 } },
      encryptedKey: ENCRYPTED_KEY$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.kekid = new KEKIdentifier({ schema: asn1.result.kekid });
    this.keyEncryptionAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.keyEncryptionAlgorithm });
    this.encryptedKey = asn1.result.encryptedKey;
  }
  toSchema() {
    return new Sequence({ value: [
      new Integer({ value: this.version }),
      this.kekid.toSchema(),
      this.keyEncryptionAlgorithm.toSchema(),
      this.encryptedKey
    ] });
  }
  toJSON() {
    return {
      version: this.version,
      kekid: this.kekid.toJSON(),
      keyEncryptionAlgorithm: this.keyEncryptionAlgorithm.toJSON(),
      encryptedKey: this.encryptedKey.toJSON()
    };
  }
};
var VERSION$9 = "version";
var KEY_DERIVATION_ALGORITHM = "keyDerivationAlgorithm";
var KEY_ENCRYPTION_ALGORITHM = "keyEncryptionAlgorithm";
var ENCRYPTED_KEY = "encryptedKey";
var PASSWORD = "password";
var CLEAR_PROPS$25 = [
  VERSION$9,
  KEY_DERIVATION_ALGORITHM,
  KEY_ENCRYPTION_ALGORITHM,
  ENCRYPTED_KEY
];
var PasswordRecipientinfo = class PasswordRecipientinfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "PasswordRecipientInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$9] ?? PasswordRecipientinfo2.defaultValues(VERSION$9);
    if (KEY_DERIVATION_ALGORITHM in parameters) this.keyDerivationAlgorithm = parameters[KEY_DERIVATION_ALGORITHM] ?? PasswordRecipientinfo2.defaultValues(KEY_DERIVATION_ALGORITHM);
    this.keyEncryptionAlgorithm = parameters[KEY_ENCRYPTION_ALGORITHM] ?? PasswordRecipientinfo2.defaultValues(KEY_ENCRYPTION_ALGORITHM);
    this.encryptedKey = parameters[ENCRYPTED_KEY] ?? PasswordRecipientinfo2.defaultValues(ENCRYPTED_KEY);
    this.password = parameters[PASSWORD] ?? PasswordRecipientinfo2.defaultValues(PASSWORD);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$9:
        return -1;
      case KEY_DERIVATION_ALGORITHM:
        return new AlgorithmIdentifier();
      case KEY_ENCRYPTION_ALGORITHM:
        return new AlgorithmIdentifier();
      case ENCRYPTED_KEY:
        return new OctetString();
      case PASSWORD:
        return EMPTY_BUFFER2;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$9:
        return memberValue === -1;
      case KEY_DERIVATION_ALGORITHM:
      case KEY_ENCRYPTION_ALGORITHM:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case ENCRYPTED_KEY:
        return memberValue.isEqual(PasswordRecipientinfo2.defaultValues(ENCRYPTED_KEY));
      case PASSWORD:
        return memberValue.byteLength === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        new Constructed({
          name: names.keyDerivationAlgorithm || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: AlgorithmIdentifier.schema().valueBlock.value
        }),
        AlgorithmIdentifier.schema(names.keyEncryptionAlgorithm || {}),
        new OctetString({ name: names.encryptedKey || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$25) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PasswordRecipientinfo2.schema({ names: {
      version: VERSION$9,
      keyDerivationAlgorithm: KEY_DERIVATION_ALGORITHM,
      keyEncryptionAlgorithm: { names: { blockName: KEY_ENCRYPTION_ALGORITHM } },
      encryptedKey: ENCRYPTED_KEY
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    if (KEY_DERIVATION_ALGORITHM in asn1.result) this.keyDerivationAlgorithm = new AlgorithmIdentifier({ schema: new Sequence({ value: asn1.result.keyDerivationAlgorithm.valueBlock.value }) });
    this.keyEncryptionAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.keyEncryptionAlgorithm });
    this.encryptedKey = asn1.result.encryptedKey;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    if (this.keyDerivationAlgorithm) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: this.keyDerivationAlgorithm.toSchema().valueBlock.value
    }));
    outputArray.push(this.keyEncryptionAlgorithm.toSchema());
    outputArray.push(this.encryptedKey);
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      keyEncryptionAlgorithm: this.keyEncryptionAlgorithm.toJSON(),
      encryptedKey: this.encryptedKey.toJSON()
    };
    if (this.keyDerivationAlgorithm) res.keyDerivationAlgorithm = this.keyDerivationAlgorithm.toJSON();
    return res;
  }
};
var ORI_TYPE = "oriType";
var ORI_VALUE = "oriValue";
var CLEAR_PROPS$24 = [ORI_TYPE, ORI_VALUE];
var OtherRecipientInfo = class OtherRecipientInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "OtherRecipientInfo";
  }
  constructor(parameters = {}) {
    super();
    this.oriType = parameters[ORI_TYPE] ?? OtherRecipientInfo2.defaultValues(ORI_TYPE);
    this.oriValue = parameters[ORI_VALUE] ?? OtherRecipientInfo2.defaultValues(ORI_VALUE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case ORI_TYPE:
        return "";
      case ORI_VALUE:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case ORI_TYPE:
        return memberValue === "";
      case ORI_VALUE:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.oriType || "" }), new Any({ name: names.oriValue || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$24) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OtherRecipientInfo2.schema({ names: {
      oriType: ORI_TYPE,
      oriValue: ORI_VALUE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.oriType = asn1.result.oriType.valueBlock.toString();
    this.oriValue = asn1.result.oriValue;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.oriType }), this.oriValue] });
  }
  toJSON() {
    const res = { oriType: this.oriType };
    if (!OtherRecipientInfo2.compareWithDefault(ORI_VALUE, this.oriValue)) res.oriValue = this.oriValue.toJSON();
    return res;
  }
};
var VARIANT = "variant";
var VALUE$1 = "value";
var CLEAR_PROPS$23 = ["blockName"];
var RecipientInfo = class RecipientInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "RecipientInfo";
  }
  constructor(parameters = {}) {
    super();
    this.variant = parameters[VARIANT] ?? RecipientInfo2.defaultValues(VARIANT);
    if (VALUE$1 in parameters) this.value = parameters[VALUE$1] ?? RecipientInfo2.defaultValues(VALUE$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VARIANT:
        return -1;
      case VALUE$1:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VARIANT:
        return memberValue === RecipientInfo2.defaultValues(memberName);
      case VALUE$1:
        return Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Choice({ value: [
      KeyTransRecipientInfo.schema({ names: { blockName: names.blockName || "" } }),
      new Constructed({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: KeyAgreeRecipientInfo.schema().valueBlock.value
      }),
      new Constructed({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 2
        },
        value: KEKRecipientInfo.schema().valueBlock.value
      }),
      new Constructed({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 3
        },
        value: PasswordRecipientinfo.schema().valueBlock.value
      }),
      new Constructed({
        name: names.blockName || "",
        idBlock: {
          tagClass: 3,
          tagNumber: 4
        },
        value: OtherRecipientInfo.schema().valueBlock.value
      })
    ] });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$23) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RecipientInfo2.schema({ names: { blockName: "blockName" } }));
    AsnError.assertSchema(asn1, this.className);
    if (asn1.result.blockName.idBlock.tagClass === 1) {
      this.variant = 1;
      this.value = new KeyTransRecipientInfo({ schema: asn1.result.blockName });
    } else {
      const blockSequence = new Sequence({ value: asn1.result.blockName.valueBlock.value });
      switch (asn1.result.blockName.idBlock.tagNumber) {
        case 1:
          this.variant = 2;
          this.value = new KeyAgreeRecipientInfo({ schema: blockSequence });
          break;
        case 2:
          this.variant = 3;
          this.value = new KEKRecipientInfo({ schema: blockSequence });
          break;
        case 3:
          this.variant = 4;
          this.value = new PasswordRecipientinfo({ schema: blockSequence });
          break;
        case 4:
          this.variant = 5;
          this.value = new OtherRecipientInfo({ schema: blockSequence });
          break;
        default:
          throw new Error("Incorrect structure of RecipientInfo block");
      }
    }
  }
  toSchema() {
    ParameterError.assertEmpty(this.value, "value", "RecipientInfo");
    const _schema = this.value.toSchema();
    switch (this.variant) {
      case 1:
        return _schema;
      case 2:
      case 3:
      case 4:
        _schema.idBlock.tagClass = 3;
        _schema.idBlock.tagNumber = this.variant - 1;
        return _schema;
      default:
        return new Any();
    }
  }
  toJSON() {
    const res = { variant: this.variant };
    if (this.value && this.variant >= 1 && this.variant <= 4) res.value = this.value.toJSON();
    return res;
  }
};
var HASH_ALGORITHM$2 = "hashAlgorithm";
var MASK_GEN_ALGORITHM = "maskGenAlgorithm";
var P_SOURCE_ALGORITHM = "pSourceAlgorithm";
var CLEAR_PROPS$22 = [
  HASH_ALGORITHM$2,
  MASK_GEN_ALGORITHM,
  P_SOURCE_ALGORITHM
];
var RSAESOAEPParams = class RSAESOAEPParams2 extends PkiObject {
  static {
    this.CLASS_NAME = "RSAESOAEPParams";
  }
  constructor(parameters = {}) {
    super();
    this.hashAlgorithm = parameters[HASH_ALGORITHM$2] ?? RSAESOAEPParams2.defaultValues(HASH_ALGORITHM$2);
    this.maskGenAlgorithm = parameters[MASK_GEN_ALGORITHM] ?? RSAESOAEPParams2.defaultValues(MASK_GEN_ALGORITHM);
    this.pSourceAlgorithm = parameters[P_SOURCE_ALGORITHM] ?? RSAESOAEPParams2.defaultValues(P_SOURCE_ALGORITHM);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case HASH_ALGORITHM$2:
        return new AlgorithmIdentifier({
          algorithmId: "1.3.14.3.2.26",
          algorithmParams: new Null()
        });
      case MASK_GEN_ALGORITHM:
        return new AlgorithmIdentifier({
          algorithmId: "1.2.840.113549.1.1.8",
          algorithmParams: new AlgorithmIdentifier({
            algorithmId: "1.3.14.3.2.26",
            algorithmParams: new Null()
          }).toSchema()
        });
      case P_SOURCE_ALGORITHM:
        return new AlgorithmIdentifier({
          algorithmId: "1.2.840.113549.1.1.9",
          algorithmParams: new OctetString({ valueHex: new Uint8Array([
            218,
            57,
            163,
            238,
            94,
            107,
            75,
            13,
            50,
            85,
            191,
            239,
            149,
            96,
            24,
            144,
            175,
            216,
            7,
            9
          ]).buffer })
        });
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          optional: true,
          value: [AlgorithmIdentifier.schema(names.hashAlgorithm || {})]
        }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          optional: true,
          value: [AlgorithmIdentifier.schema(names.maskGenAlgorithm || {})]
        }),
        new Constructed({
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          optional: true,
          value: [AlgorithmIdentifier.schema(names.pSourceAlgorithm || {})]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$22) delete schema[prop];
    const asn1 = compareSchema(schema, schema, RSAESOAEPParams2.schema({ names: {
      hashAlgorithm: { names: { blockName: HASH_ALGORITHM$2 } },
      maskGenAlgorithm: { names: { blockName: MASK_GEN_ALGORITHM } },
      pSourceAlgorithm: { names: { blockName: P_SOURCE_ALGORITHM } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    if (HASH_ALGORITHM$2 in asn1.result) this.hashAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.hashAlgorithm });
    if (MASK_GEN_ALGORITHM in asn1.result) this.maskGenAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.maskGenAlgorithm });
    if (P_SOURCE_ALGORITHM in asn1.result) this.pSourceAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.pSourceAlgorithm });
  }
  toSchema() {
    const outputArray = [];
    if (!this.hashAlgorithm.isEqual(RSAESOAEPParams2.defaultValues(HASH_ALGORITHM$2))) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.hashAlgorithm.toSchema()]
    }));
    if (!this.maskGenAlgorithm.isEqual(RSAESOAEPParams2.defaultValues(MASK_GEN_ALGORITHM))) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: [this.maskGenAlgorithm.toSchema()]
    }));
    if (!this.pSourceAlgorithm.isEqual(RSAESOAEPParams2.defaultValues(P_SOURCE_ALGORITHM))) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      value: [this.pSourceAlgorithm.toSchema()]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {};
    if (!this.hashAlgorithm.isEqual(RSAESOAEPParams2.defaultValues(HASH_ALGORITHM$2))) res.hashAlgorithm = this.hashAlgorithm.toJSON();
    if (!this.maskGenAlgorithm.isEqual(RSAESOAEPParams2.defaultValues(MASK_GEN_ALGORITHM))) res.maskGenAlgorithm = this.maskGenAlgorithm.toJSON();
    if (!this.pSourceAlgorithm.isEqual(RSAESOAEPParams2.defaultValues(P_SOURCE_ALGORITHM))) res.pSourceAlgorithm = this.pSourceAlgorithm.toJSON();
    return res;
  }
};
var KEY_INFO = "keyInfo";
var ENTITY_U_INFO = "entityUInfo";
var SUPP_PUB_INFO = "suppPubInfo";
var CLEAR_PROPS$21 = [
  KEY_INFO,
  ENTITY_U_INFO,
  SUPP_PUB_INFO
];
var ECCCMSSharedInfo = class ECCCMSSharedInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "ECCCMSSharedInfo";
  }
  constructor(parameters = {}) {
    super();
    this.keyInfo = parameters[KEY_INFO] ?? ECCCMSSharedInfo2.defaultValues(KEY_INFO);
    if (ENTITY_U_INFO in parameters) this.entityUInfo = parameters[ENTITY_U_INFO] ?? ECCCMSSharedInfo2.defaultValues(ENTITY_U_INFO);
    this.suppPubInfo = parameters[SUPP_PUB_INFO] ?? ECCCMSSharedInfo2.defaultValues(SUPP_PUB_INFO);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case KEY_INFO:
        return new AlgorithmIdentifier();
      case ENTITY_U_INFO:
        return new OctetString();
      case SUPP_PUB_INFO:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case KEY_INFO:
      case ENTITY_U_INFO:
      case SUPP_PUB_INFO:
        return memberValue.isEqual(ECCCMSSharedInfo2.defaultValues(memberName));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        AlgorithmIdentifier.schema(names.keyInfo || {}),
        new Constructed({
          name: names.entityUInfo || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          optional: true,
          value: [new OctetString()]
        }),
        new Constructed({
          name: names.suppPubInfo || "",
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          value: [new OctetString()]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$21) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ECCCMSSharedInfo2.schema({ names: {
      keyInfo: { names: { blockName: KEY_INFO } },
      entityUInfo: ENTITY_U_INFO,
      suppPubInfo: SUPP_PUB_INFO
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.keyInfo = new AlgorithmIdentifier({ schema: asn1.result.keyInfo });
    if (ENTITY_U_INFO in asn1.result) this.entityUInfo = asn1.result.entityUInfo.valueBlock.value[0];
    this.suppPubInfo = asn1.result.suppPubInfo.valueBlock.value[0];
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.keyInfo.toSchema());
    if (this.entityUInfo) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.entityUInfo]
    }));
    outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 2
      },
      value: [this.suppPubInfo]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      keyInfo: this.keyInfo.toJSON(),
      suppPubInfo: this.suppPubInfo.toJSON()
    };
    if (this.entityUInfo) res.entityUInfo = this.entityUInfo.toJSON();
    return res;
  }
};
var VERSION$8 = "version";
var ORIGINATOR_INFO = "originatorInfo";
var RECIPIENT_INFOS = "recipientInfos";
var ENCRYPTED_CONTENT_INFO = "encryptedContentInfo";
var UNPROTECTED_ATTRS = "unprotectedAttrs";
var CLEAR_PROPS$20 = [
  VERSION$8,
  ORIGINATOR_INFO,
  RECIPIENT_INFOS,
  ENCRYPTED_CONTENT_INFO,
  UNPROTECTED_ATTRS
];
var defaultEncryptionParams = {
  kdfAlgorithm: "SHA-512",
  kekEncryptionLength: 256
};
var curveLengthByName = {
  "P-256": 256,
  "P-384": 384,
  "P-521": 528
};
var EnvelopedData = class EnvelopedData2 extends PkiObject {
  static {
    this.CLASS_NAME = "EnvelopedData";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$8] ?? EnvelopedData2.defaultValues(VERSION$8);
    if (ORIGINATOR_INFO in parameters) this.originatorInfo = parameters[ORIGINATOR_INFO] ?? EnvelopedData2.defaultValues(ORIGINATOR_INFO);
    this.recipientInfos = parameters[RECIPIENT_INFOS] ?? EnvelopedData2.defaultValues(RECIPIENT_INFOS);
    this.encryptedContentInfo = parameters[ENCRYPTED_CONTENT_INFO] ?? EnvelopedData2.defaultValues(ENCRYPTED_CONTENT_INFO);
    if (UNPROTECTED_ATTRS in parameters) this.unprotectedAttrs = parameters[UNPROTECTED_ATTRS] ?? EnvelopedData2.defaultValues(UNPROTECTED_ATTRS);
    this.policy = { disableSplit: !!parameters.disableSplit };
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$8:
        return 0;
      case ORIGINATOR_INFO:
        return new OriginatorInfo();
      case RECIPIENT_INFOS:
        return [];
      case ENCRYPTED_CONTENT_INFO:
        return new EncryptedContentInfo();
      case UNPROTECTED_ATTRS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$8:
        return memberValue === EnvelopedData2.defaultValues(memberName);
      case ORIGINATOR_INFO:
        return memberValue.certs.certificates.length === 0 && memberValue.crls.crls.length === 0;
      case RECIPIENT_INFOS:
      case UNPROTECTED_ATTRS:
        return memberValue.length === 0;
      case ENCRYPTED_CONTENT_INFO:
        return EncryptedContentInfo.compareWithDefault("contentType", memberValue.contentType) && EncryptedContentInfo.compareWithDefault("contentEncryptionAlgorithm", memberValue.contentEncryptionAlgorithm) && EncryptedContentInfo.compareWithDefault("encryptedContent", memberValue.encryptedContent);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || "" }),
        new Constructed({
          name: names.originatorInfo || "",
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: OriginatorInfo.schema().valueBlock.value
        }),
        new Set2({ value: [new Repeated({
          name: names.recipientInfos || "",
          value: RecipientInfo.schema()
        })] }),
        EncryptedContentInfo.schema(names.encryptedContentInfo || {}),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new Repeated({
            name: names.unprotectedAttrs || "",
            value: Attribute.schema()
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$20) delete schema[prop];
    const asn1 = compareSchema(schema, schema, EnvelopedData2.schema({ names: {
      version: VERSION$8,
      originatorInfo: ORIGINATOR_INFO,
      recipientInfos: RECIPIENT_INFOS,
      encryptedContentInfo: { names: { blockName: ENCRYPTED_CONTENT_INFO } },
      unprotectedAttrs: UNPROTECTED_ATTRS
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    if (ORIGINATOR_INFO in asn1.result) this.originatorInfo = new OriginatorInfo({ schema: new Sequence({ value: asn1.result.originatorInfo.valueBlock.value }) });
    this.recipientInfos = Array.from(asn1.result.recipientInfos, (o) => new RecipientInfo({ schema: o }));
    this.encryptedContentInfo = new EncryptedContentInfo({ schema: asn1.result.encryptedContentInfo });
    if (UNPROTECTED_ATTRS in asn1.result) this.unprotectedAttrs = Array.from(asn1.result.unprotectedAttrs, (o) => new Attribute({ schema: o }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    if (this.originatorInfo) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: this.originatorInfo.toSchema().valueBlock.value
    }));
    outputArray.push(new Set2({ value: Array.from(this.recipientInfos, (o) => o.toSchema()) }));
    outputArray.push(this.encryptedContentInfo.toSchema());
    if (this.unprotectedAttrs) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: Array.from(this.unprotectedAttrs, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      recipientInfos: Array.from(this.recipientInfos, (o) => o.toJSON()),
      encryptedContentInfo: this.encryptedContentInfo.toJSON()
    };
    if (this.originatorInfo) res.originatorInfo = this.originatorInfo.toJSON();
    if (this.unprotectedAttrs) res.unprotectedAttrs = Array.from(this.unprotectedAttrs, (o) => o.toJSON());
    return res;
  }
  addRecipientByCertificate(certificate, parameters, variant, crypto2 = getCrypto(true)) {
    const encryptionParameters = Object.assign({
      useOAEP: true,
      oaepHashAlgorithm: "SHA-512"
    }, defaultEncryptionParams, parameters || {});
    if (certificate.subjectPublicKeyInfo.algorithm.algorithmId.indexOf("1.2.840.113549") !== -1) variant = 1;
    else if (certificate.subjectPublicKeyInfo.algorithm.algorithmId.indexOf("1.2.840.10045") !== -1) variant = 2;
    else throw new Error(`Unknown type of certificate's public key: ${certificate.subjectPublicKeyInfo.algorithm.algorithmId}`);
    switch (variant) {
      case 1:
        {
          let algorithmId;
          let algorithmParams;
          if (encryptionParameters.useOAEP === true) {
            algorithmId = crypto2.getOIDByAlgorithm({ name: "RSA-OAEP" }, true, "keyEncryptionAlgorithm");
            const hashAlgorithm = new AlgorithmIdentifier({
              algorithmId: crypto2.getOIDByAlgorithm({ name: encryptionParameters.oaepHashAlgorithm }, true, "RSAES-OAEP-params"),
              algorithmParams: new Null()
            });
            algorithmParams = new RSAESOAEPParams({
              hashAlgorithm,
              maskGenAlgorithm: new AlgorithmIdentifier({
                algorithmId: "1.2.840.113549.1.1.8",
                algorithmParams: hashAlgorithm.toSchema()
              })
            }).toSchema();
          } else {
            algorithmId = crypto2.getOIDByAlgorithm({ name: "RSAES-PKCS1-v1_5" });
            if (algorithmId === "") throw new Error("Can not find OID for RSAES-PKCS1-v1_5");
            algorithmParams = new Null();
          }
          const keyInfo = new KeyTransRecipientInfo({
            version: 0,
            rid: new IssuerAndSerialNumber({
              issuer: certificate.issuer,
              serialNumber: certificate.serialNumber
            }),
            keyEncryptionAlgorithm: new AlgorithmIdentifier({
              algorithmId,
              algorithmParams
            }),
            recipientCertificate: certificate
          });
          this.recipientInfos.push(new RecipientInfo({
            variant: 1,
            value: keyInfo
          }));
        }
        break;
      case 2:
        {
          const recipientIdentifier = new KeyAgreeRecipientIdentifier({
            variant: 1,
            value: new IssuerAndSerialNumber({
              issuer: certificate.issuer,
              serialNumber: certificate.serialNumber
            })
          });
          this._addKeyAgreeRecipientInfo(recipientIdentifier, encryptionParameters, { recipientCertificate: certificate }, crypto2);
        }
        break;
      default:
        throw new Error(`Unknown "variant" value: ${variant}`);
    }
    return true;
  }
  addRecipientByPreDefinedData(preDefinedData, parameters = {}, variant, crypto2 = getCrypto(true)) {
    ArgumentError.assert(preDefinedData, "preDefinedData", "ArrayBuffer");
    if (!preDefinedData.byteLength) throw new Error("Pre-defined data could have zero length");
    if (!parameters.keyIdentifier) {
      const keyIdentifierBuffer = /* @__PURE__ */ new ArrayBuffer(16);
      const keyIdentifierView = new Uint8Array(keyIdentifierBuffer);
      crypto2.getRandomValues(keyIdentifierView);
      parameters.keyIdentifier = keyIdentifierBuffer;
    }
    if (!parameters.hmacHashAlgorithm) parameters.hmacHashAlgorithm = "SHA-512";
    if (parameters.iterationCount === void 0) parameters.iterationCount = 2048;
    if (!parameters.keyEncryptionAlgorithm) parameters.keyEncryptionAlgorithm = {
      name: "AES-KW",
      length: 256
    };
    if (!parameters.keyEncryptionAlgorithmParams) parameters.keyEncryptionAlgorithmParams = new Null();
    switch (variant) {
      case 1:
        {
          const kekOID = crypto2.getOIDByAlgorithm(parameters.keyEncryptionAlgorithm, true, "keyEncryptionAlgorithm");
          const keyInfo = new KEKRecipientInfo({
            version: 4,
            kekid: new KEKIdentifier({ keyIdentifier: new OctetString({ valueHex: parameters.keyIdentifier }) }),
            keyEncryptionAlgorithm: new AlgorithmIdentifier({
              algorithmId: kekOID,
              algorithmParams: parameters.keyEncryptionAlgorithmParams
            }),
            preDefinedKEK: preDefinedData
          });
          this.recipientInfos.push(new RecipientInfo({
            variant: 3,
            value: keyInfo
          }));
        }
        break;
      case 2:
        {
          const pbkdf2OID = crypto2.getOIDByAlgorithm({ name: "PBKDF2" }, true, "keyDerivationAlgorithm");
          const saltBuffer = /* @__PURE__ */ new ArrayBuffer(64);
          const saltView = new Uint8Array(saltBuffer);
          crypto2.getRandomValues(saltView);
          const hmacOID = crypto2.getOIDByAlgorithm({
            name: "HMAC",
            hash: { name: parameters.hmacHashAlgorithm }
          }, true, "hmacHashAlgorithm");
          const pbkdf2Params = new PBKDF2Params({
            salt: new OctetString({ valueHex: saltBuffer }),
            iterationCount: parameters.iterationCount,
            prf: new AlgorithmIdentifier({
              algorithmId: hmacOID,
              algorithmParams: new Null()
            })
          });
          const kekOID = crypto2.getOIDByAlgorithm(parameters.keyEncryptionAlgorithm, true, "keyEncryptionAlgorithm");
          const keyInfo = new PasswordRecipientinfo({
            version: 0,
            keyDerivationAlgorithm: new AlgorithmIdentifier({
              algorithmId: pbkdf2OID,
              algorithmParams: pbkdf2Params.toSchema()
            }),
            keyEncryptionAlgorithm: new AlgorithmIdentifier({
              algorithmId: kekOID,
              algorithmParams: parameters.keyEncryptionAlgorithmParams
            }),
            password: preDefinedData
          });
          this.recipientInfos.push(new RecipientInfo({
            variant: 4,
            value: keyInfo
          }));
        }
        break;
      default:
        throw new Error(`Unknown value for "variant": ${variant}`);
    }
  }
  addRecipientByKeyIdentifier(key, keyId, parameters, crypto2 = getCrypto(true)) {
    const encryptionParameters = Object.assign({}, defaultEncryptionParams, parameters || {});
    const recipientIdentifier = new KeyAgreeRecipientIdentifier({
      variant: 2,
      value: new RecipientKeyIdentifier({ subjectKeyIdentifier: new OctetString({ valueHex: keyId }) })
    });
    this._addKeyAgreeRecipientInfo(recipientIdentifier, encryptionParameters, { recipientPublicKey: key }, crypto2);
  }
  _addKeyAgreeRecipientInfo(recipientIdentifier, encryptionParameters, extraRecipientInfoParams, crypto2 = getCrypto(true)) {
    const encryptedKey = new RecipientEncryptedKey({ rid: recipientIdentifier });
    const aesKW = new AlgorithmIdentifier({ algorithmId: crypto2.getOIDByAlgorithm({
      name: "AES-KW",
      length: encryptionParameters.kekEncryptionLength
    }, true, "keyEncryptionAlgorithm") });
    const ecdhOID = crypto2.getOIDByAlgorithm({
      name: "ECDH",
      kdf: encryptionParameters.kdfAlgorithm
    }, true, "KeyAgreeRecipientInfo");
    const ukmBuffer = /* @__PURE__ */ new ArrayBuffer(64);
    const ukmView = new Uint8Array(ukmBuffer);
    crypto2.getRandomValues(ukmView);
    const recipientInfoParams = {
      version: 3,
      ukm: new OctetString({ valueHex: ukmBuffer }),
      keyEncryptionAlgorithm: new AlgorithmIdentifier({
        algorithmId: ecdhOID,
        algorithmParams: aesKW.toSchema()
      }),
      recipientEncryptedKeys: new RecipientEncryptedKeys({ encryptedKeys: [encryptedKey] })
    };
    const keyInfo = new KeyAgreeRecipientInfo(Object.assign(recipientInfoParams, extraRecipientInfoParams));
    this.recipientInfos.push(new RecipientInfo({
      variant: 2,
      value: keyInfo
    }));
  }
  async encrypt(contentEncryptionAlgorithm, contentToEncrypt, crypto2 = getCrypto(true)) {
    const ivBuffer = /* @__PURE__ */ new ArrayBuffer(16);
    const ivView = new Uint8Array(ivBuffer);
    crypto2.getRandomValues(ivView);
    const contentView = new Uint8Array(contentToEncrypt);
    const contentEncryptionOID = crypto2.getOIDByAlgorithm(contentEncryptionAlgorithm, true, "contentEncryptionAlgorithm");
    const sessionKey = await crypto2.generateKey(contentEncryptionAlgorithm, true, ["encrypt"]);
    const encryptedContent = await crypto2.encrypt({
      name: contentEncryptionAlgorithm.name,
      iv: ivView
    }, sessionKey, contentView);
    const exportedSessionKey = await crypto2.exportKey("raw", sessionKey);
    this.version = 2;
    this.encryptedContentInfo = new EncryptedContentInfo({
      disableSplit: this.policy.disableSplit,
      contentType: "1.2.840.113549.1.7.1",
      contentEncryptionAlgorithm: new AlgorithmIdentifier({
        algorithmId: contentEncryptionOID,
        algorithmParams: new OctetString({ valueHex: ivBuffer })
      }),
      encryptedContent: new OctetString({ valueHex: encryptedContent })
    });
    const SubKeyAgreeRecipientInfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      let recipientCurve;
      let recipientPublicKey;
      if (recipientInfo.recipientPublicKey) {
        recipientCurve = recipientInfo.recipientPublicKey.algorithm.namedCurve;
        recipientPublicKey = recipientInfo.recipientPublicKey;
      } else if (recipientInfo.recipientCertificate) {
        const curveObject = recipientInfo.recipientCertificate.subjectPublicKeyInfo.algorithm.algorithmParams;
        if (curveObject.constructor.blockName() !== ObjectIdentifier.blockName()) throw new Error(`Incorrect "recipientCertificate" for index ${index}`);
        switch (curveObject.valueBlock.toString()) {
          case "1.2.840.10045.3.1.7":
            recipientCurve = "P-256";
            break;
          case "1.3.132.0.34":
            recipientCurve = "P-384";
            break;
          case "1.3.132.0.35":
            recipientCurve = "P-521";
            break;
          default:
            throw new Error(`Incorrect curve OID for index ${index}`);
        }
        recipientPublicKey = await recipientInfo.recipientCertificate.getPublicKey({ algorithm: {
          algorithm: {
            name: "ECDH",
            namedCurve: recipientCurve
          },
          usages: []
        } }, crypto2);
      } else throw new Error("Unsupported RecipientInfo");
      const recipientCurveLength = curveLengthByName[recipientCurve];
      const ecdhKeys = await crypto2.generateKey({
        name: "ECDH",
        namedCurve: recipientCurve
      }, true, ["deriveBits"]);
      const exportedECDHPublicKey = await crypto2.exportKey("spki", ecdhKeys.publicKey);
      const derivedBits = await crypto2.deriveBits({
        name: "ECDH",
        public: recipientPublicKey
      }, ecdhKeys.privateKey, recipientCurveLength);
      const aesKWAlgorithm = new AlgorithmIdentifier({ schema: recipientInfo.keyEncryptionAlgorithm.algorithmParams });
      const kwAlgorithm = crypto2.getAlgorithmByOID(aesKWAlgorithm.algorithmId, true, "aesKWAlgorithm");
      let kwLength = kwAlgorithm.length;
      const kwLengthBuffer = /* @__PURE__ */ new ArrayBuffer(4);
      const kwLengthView = new Uint8Array(kwLengthBuffer);
      for (let j = 3; j >= 0; j--) {
        kwLengthView[j] = kwLength;
        kwLength >>= 8;
      }
      const encodedInfo = new ECCCMSSharedInfo({
        keyInfo: new AlgorithmIdentifier({ algorithmId: aesKWAlgorithm.algorithmId }),
        entityUInfo: recipientInfo.ukm,
        suppPubInfo: new OctetString({ valueHex: kwLengthBuffer })
      }).toSchema().toBER(false);
      const derivedKeyRaw = await kdf(crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "ecdhAlgorithm").kdf, derivedBits, kwAlgorithm.length, encodedInfo, crypto2);
      const awsKW = await crypto2.importKey("raw", derivedKeyRaw, { name: "AES-KW" }, true, ["wrapKey"]);
      const wrappedKey = await crypto2.wrapKey("raw", sessionKey, awsKW, { name: "AES-KW" });
      const originator = new OriginatorIdentifierOrKey();
      originator.variant = 3;
      originator.value = OriginatorPublicKey.fromBER(exportedECDHPublicKey);
      recipientInfo.originator = originator;
      recipientInfo.recipientEncryptedKeys.encryptedKeys[0].encryptedKey = new OctetString({ valueHex: wrappedKey });
      return { ecdhPrivateKey: ecdhKeys.privateKey };
    };
    const SubKeyTransRecipientInfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      const algorithmParameters = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "keyEncryptionAlgorithm");
      if (algorithmParameters.name === "RSA-OAEP") {
        const schema = recipientInfo.keyEncryptionAlgorithm.algorithmParams;
        const rsaOAEPParams = new RSAESOAEPParams({ schema });
        algorithmParameters.hash = crypto2.getAlgorithmByOID(rsaOAEPParams.hashAlgorithm.algorithmId);
        if ("name" in algorithmParameters.hash === false) throw new Error(`Incorrect OID for hash algorithm: ${rsaOAEPParams.hashAlgorithm.algorithmId}`);
      }
      const publicKey = await recipientInfo.recipientCertificate.getPublicKey({ algorithm: {
        algorithm: algorithmParameters,
        usages: ["encrypt", "wrapKey"]
      } }, crypto2);
      const encryptedKey = await crypto2.encrypt(publicKey.algorithm, publicKey, exportedSessionKey);
      recipientInfo.encryptedKey = new OctetString({ valueHex: encryptedKey });
    };
    const SubKEKRecipientInfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      const kekAlgorithm = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "kekAlgorithm");
      const kekKey = await crypto2.importKey("raw", new Uint8Array(recipientInfo.preDefinedKEK), kekAlgorithm, true, ["wrapKey"]);
      const wrappedKey = await crypto2.wrapKey("raw", sessionKey, kekKey, kekAlgorithm);
      recipientInfo.encryptedKey = new OctetString({ valueHex: wrappedKey });
    };
    const SubPasswordRecipientinfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      let pbkdf2Params;
      if (!recipientInfo.keyDerivationAlgorithm) throw new Error('Please append encoded "keyDerivationAlgorithm"');
      if (!recipientInfo.keyDerivationAlgorithm.algorithmParams) throw new Error('Incorrectly encoded "keyDerivationAlgorithm"');
      try {
        pbkdf2Params = new PBKDF2Params({ schema: recipientInfo.keyDerivationAlgorithm.algorithmParams });
      } catch {
        throw new Error('Incorrectly encoded "keyDerivationAlgorithm"');
      }
      const passwordView = new Uint8Array(recipientInfo.password);
      const derivationKey = await crypto2.importKey("raw", passwordView, "PBKDF2", false, ["deriveKey"]);
      const kekAlgorithm = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "kekAlgorithm");
      let hmacHashAlgorithm = "SHA-1";
      if (pbkdf2Params.prf) hmacHashAlgorithm = crypto2.getAlgorithmByOID(pbkdf2Params.prf.algorithmId, true, "prfAlgorithm").hash.name;
      const saltView = new Uint8Array(pbkdf2Params.salt.valueBlock.valueHex);
      const iterations = pbkdf2Params.iterationCount;
      const derivedKey = await crypto2.deriveKey({
        name: "PBKDF2",
        hash: { name: hmacHashAlgorithm },
        salt: saltView,
        iterations
      }, derivationKey, kekAlgorithm, true, ["wrapKey"]);
      const wrappedKey = await crypto2.wrapKey("raw", sessionKey, derivedKey, kekAlgorithm);
      recipientInfo.encryptedKey = new OctetString({ valueHex: wrappedKey });
    };
    const res = [];
    for (let i = 0; i < this.recipientInfos.length; i++) switch (this.recipientInfos[i].variant) {
      case 1:
        res.push(await SubKeyTransRecipientInfo(i));
        break;
      case 2:
        res.push(await SubKeyAgreeRecipientInfo(i));
        break;
      case 3:
        res.push(await SubKEKRecipientInfo(i));
        break;
      case 4:
        res.push(await SubPasswordRecipientinfo(i));
        break;
      default:
        throw new Error(`Unknown recipient type in array with index ${i}`);
    }
    return res;
  }
  async decrypt(recipientIndex, parameters, crypto2 = getCrypto(true)) {
    const decryptionParameters = parameters || {};
    if (recipientIndex + 1 > this.recipientInfos.length) throw new Error(`Maximum value for "index" is: ${this.recipientInfos.length - 1}`);
    const SubKeyAgreeRecipientInfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      let curveOID;
      let recipientCurve;
      let recipientCurveLength;
      const originator = recipientInfo.originator;
      if (decryptionParameters.recipientCertificate) {
        const curveObject = decryptionParameters.recipientCertificate.subjectPublicKeyInfo.algorithm.algorithmParams;
        if (curveObject.constructor.blockName() !== ObjectIdentifier.blockName()) throw new Error(`Incorrect "recipientCertificate" for index ${index}`);
        curveOID = curveObject.valueBlock.toString();
      } else if (originator.value.algorithm.algorithmParams) {
        const curveObject = originator.value.algorithm.algorithmParams;
        if (curveObject.constructor.blockName() !== ObjectIdentifier.blockName()) throw new Error(`Incorrect originator for index ${index}`);
        curveOID = curveObject.valueBlock.toString();
      } else throw new Error('Parameter "recipientCertificate" is mandatory for "KeyAgreeRecipientInfo" if algorithm params are missing from originator');
      if (!decryptionParameters.recipientPrivateKey) throw new Error('Parameter "recipientPrivateKey" is mandatory for "KeyAgreeRecipientInfo"');
      switch (curveOID) {
        case "1.2.840.10045.3.1.7":
          recipientCurve = "P-256";
          recipientCurveLength = 256;
          break;
        case "1.3.132.0.34":
          recipientCurve = "P-384";
          recipientCurveLength = 384;
          break;
        case "1.3.132.0.35":
          recipientCurve = "P-521";
          recipientCurveLength = 528;
          break;
        default:
          throw new Error(`Incorrect curve OID for index ${index}`);
      }
      let ecdhPrivateKey;
      let keyCrypto = crypto2;
      if (isBufferSource(decryptionParameters.recipientPrivateKey)) ecdhPrivateKey = await crypto2.importKey("pkcs8", decryptionParameters.recipientPrivateKey, {
        name: "ECDH",
        namedCurve: recipientCurve
      }, true, ["deriveBits"]);
      else {
        ecdhPrivateKey = decryptionParameters.recipientPrivateKey;
        if ("crypto" in decryptionParameters && decryptionParameters.crypto) keyCrypto = decryptionParameters.crypto.subtle;
      }
      if ("algorithmParams" in originator.value.algorithm === false) originator.value.algorithm.algorithmParams = new ObjectIdentifier({ value: curveOID });
      const buffer = originator.value.toSchema().toBER(false);
      const ecdhPublicKey = await crypto2.importKey("spki", buffer, {
        name: "ECDH",
        namedCurve: recipientCurve
      }, true, []);
      const sharedSecret = await keyCrypto.deriveBits({
        name: "ECDH",
        public: ecdhPublicKey
      }, ecdhPrivateKey, recipientCurveLength);
      async function applyKDF(includeAlgorithmParams) {
        includeAlgorithmParams = includeAlgorithmParams || false;
        const aesKWAlgorithm = new AlgorithmIdentifier({ schema: recipientInfo.keyEncryptionAlgorithm.algorithmParams });
        const kwAlgorithm = crypto2.getAlgorithmByOID(aesKWAlgorithm.algorithmId, true, "kwAlgorithm");
        let kwLength = kwAlgorithm.length;
        const kwLengthBuffer = /* @__PURE__ */ new ArrayBuffer(4);
        const kwLengthView = new Uint8Array(kwLengthBuffer);
        for (let j = 3; j >= 0; j--) {
          kwLengthView[j] = kwLength;
          kwLength >>= 8;
        }
        const keyInfoAlgorithm = { algorithmId: aesKWAlgorithm.algorithmId };
        if (includeAlgorithmParams) keyInfoAlgorithm.algorithmParams = new Null();
        const encodedInfo = new ECCCMSSharedInfo({
          keyInfo: new AlgorithmIdentifier(keyInfoAlgorithm),
          entityUInfo: recipientInfo.ukm,
          suppPubInfo: new OctetString({ valueHex: kwLengthBuffer })
        }).toSchema().toBER(false);
        const ecdhAlgorithm = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "ecdhAlgorithm");
        if (!ecdhAlgorithm.name) throw new Error(`Incorrect OID for key encryption algorithm: ${recipientInfo.keyEncryptionAlgorithm.algorithmId}`);
        return kdf(ecdhAlgorithm.kdf, sharedSecret, kwAlgorithm.length, encodedInfo, crypto2);
      }
      const kdfResult = await applyKDF();
      const importAesKwKey = async (kdfResult2) => {
        return crypto2.importKey("raw", kdfResult2, { name: "AES-KW" }, true, ["unwrapKey"]);
      };
      const aesKwKey = await importAesKwKey(kdfResult);
      const unwrapSessionKey = async (aesKwKey2) => {
        const algorithmId2 = this.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId;
        const contentEncryptionAlgorithm2 = crypto2.getAlgorithmByOID(algorithmId2, true, "contentEncryptionAlgorithm");
        return crypto2.unwrapKey("raw", recipientInfo.recipientEncryptedKeys.encryptedKeys[0].encryptedKey.valueBlock.valueHexView, aesKwKey2, { name: "AES-KW" }, contentEncryptionAlgorithm2, true, ["decrypt"]);
      };
      try {
        return await unwrapSessionKey(aesKwKey);
      } catch {
        return unwrapSessionKey(await importAesKwKey(await applyKDF(true)));
      }
    };
    const SubKeyTransRecipientInfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      if (!decryptionParameters.recipientPrivateKey) throw new Error('Parameter "recipientPrivateKey" is mandatory for "KeyTransRecipientInfo"');
      const algorithmParameters = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "keyEncryptionAlgorithm");
      if (algorithmParameters.name === "RSA-OAEP") {
        const schema = recipientInfo.keyEncryptionAlgorithm.algorithmParams;
        const rsaOAEPParams = new RSAESOAEPParams({ schema });
        algorithmParameters.hash = crypto2.getAlgorithmByOID(rsaOAEPParams.hashAlgorithm.algorithmId);
        if ("name" in algorithmParameters.hash === false) throw new Error(`Incorrect OID for hash algorithm: ${rsaOAEPParams.hashAlgorithm.algorithmId}`);
      }
      let privateKey;
      let keyCrypto = crypto2;
      if (isBufferSource(decryptionParameters.recipientPrivateKey)) privateKey = await crypto2.importKey("pkcs8", decryptionParameters.recipientPrivateKey, algorithmParameters, true, ["decrypt"]);
      else {
        privateKey = decryptionParameters.recipientPrivateKey;
        if ("crypto" in decryptionParameters && decryptionParameters.crypto) keyCrypto = decryptionParameters.crypto.subtle;
      }
      const sessionKey = await keyCrypto.decrypt(privateKey.algorithm, privateKey, recipientInfo.encryptedKey.valueBlock.valueHexView);
      const algorithmId2 = this.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId;
      const contentEncryptionAlgorithm2 = crypto2.getAlgorithmByOID(algorithmId2, true, "contentEncryptionAlgorithm");
      if ("name" in contentEncryptionAlgorithm2 === false) throw new Error(`Incorrect "contentEncryptionAlgorithm": ${algorithmId2}`);
      return crypto2.importKey("raw", sessionKey, contentEncryptionAlgorithm2, true, ["decrypt"]);
    };
    const SubKEKRecipientInfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      if (!decryptionParameters.preDefinedData) throw new Error('Parameter "preDefinedData" is mandatory for "KEKRecipientInfo"');
      const kekAlgorithm = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "kekAlgorithm");
      const importedKey = await crypto2.importKey("raw", decryptionParameters.preDefinedData, kekAlgorithm, true, ["unwrapKey"]);
      const algorithmId2 = this.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId;
      const contentEncryptionAlgorithm2 = crypto2.getAlgorithmByOID(algorithmId2, true, "contentEncryptionAlgorithm");
      if (!contentEncryptionAlgorithm2.name) throw new Error(`Incorrect "contentEncryptionAlgorithm": ${algorithmId2}`);
      return crypto2.unwrapKey("raw", recipientInfo.encryptedKey.valueBlock.valueHexView, importedKey, kekAlgorithm, contentEncryptionAlgorithm2, true, ["decrypt"]);
    };
    const SubPasswordRecipientinfo = async (index) => {
      const recipientInfo = this.recipientInfos[index].value;
      let pbkdf2Params;
      if (!decryptionParameters.preDefinedData) throw new Error('Parameter "preDefinedData" is mandatory for "KEKRecipientInfo"');
      if (!recipientInfo.keyDerivationAlgorithm) throw new Error('Please append encoded "keyDerivationAlgorithm"');
      if (!recipientInfo.keyDerivationAlgorithm.algorithmParams) throw new Error('Incorrectly encoded "keyDerivationAlgorithm"');
      try {
        pbkdf2Params = new PBKDF2Params({ schema: recipientInfo.keyDerivationAlgorithm.algorithmParams });
      } catch {
        throw new Error('Incorrectly encoded "keyDerivationAlgorithm"');
      }
      const pbkdf2Key = await crypto2.importKey("raw", decryptionParameters.preDefinedData, "PBKDF2", false, ["deriveKey"]);
      const kekAlgorithm = crypto2.getAlgorithmByOID(recipientInfo.keyEncryptionAlgorithm.algorithmId, true, "keyEncryptionAlgorithm");
      const hmacHashAlgorithm = pbkdf2Params.prf ? crypto2.getAlgorithmByOID(pbkdf2Params.prf.algorithmId, true, "prfAlgorithm").hash.name : "SHA-1";
      const saltView = new Uint8Array(pbkdf2Params.salt.valueBlock.valueHex);
      const iterations = pbkdf2Params.iterationCount;
      const kekKey = await crypto2.deriveKey({
        name: "PBKDF2",
        hash: { name: hmacHashAlgorithm },
        salt: saltView,
        iterations
      }, pbkdf2Key, kekAlgorithm, true, ["unwrapKey"]);
      const algorithmId2 = this.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId;
      const contentEncryptionAlgorithm2 = crypto2.getAlgorithmByOID(algorithmId2, true, "contentEncryptionAlgorithm");
      return crypto2.unwrapKey("raw", recipientInfo.encryptedKey.valueBlock.valueHexView, kekKey, kekAlgorithm, contentEncryptionAlgorithm2, true, ["decrypt"]);
    };
    let unwrappedKey;
    switch (this.recipientInfos[recipientIndex].variant) {
      case 1:
        unwrappedKey = await SubKeyTransRecipientInfo(recipientIndex);
        break;
      case 2:
        unwrappedKey = await SubKeyAgreeRecipientInfo(recipientIndex);
        break;
      case 3:
        unwrappedKey = await SubKEKRecipientInfo(recipientIndex);
        break;
      case 4:
        unwrappedKey = await SubPasswordRecipientinfo(recipientIndex);
        break;
      default:
        throw new Error(`Unknown recipient type in array with index ${recipientIndex}`);
    }
    const algorithmId = this.encryptedContentInfo.contentEncryptionAlgorithm.algorithmId;
    const contentEncryptionAlgorithm = crypto2.getAlgorithmByOID(algorithmId, true, "contentEncryptionAlgorithm");
    const ivBuffer = this.encryptedContentInfo.contentEncryptionAlgorithm.algorithmParams.valueBlock.valueHex;
    const ivView = new Uint8Array(ivBuffer);
    if (!this.encryptedContentInfo.encryptedContent) throw new Error("Required property `encryptedContent` is empty");
    const dataBuffer = this.encryptedContentInfo.getEncryptedContent();
    return crypto2.decrypt({
      name: contentEncryptionAlgorithm.name,
      iv: ivView
    }, unwrappedKey, dataBuffer);
  }
};
var SAFE_CONTENTS = "safeContents";
var PARSED_VALUE$1 = "parsedValue";
var CONTENT_INFOS = "contentInfos";
var AuthenticatedSafe = class AuthenticatedSafe2 extends PkiObject {
  static {
    this.CLASS_NAME = "AuthenticatedSafe";
  }
  constructor(parameters = {}) {
    super();
    this.safeContents = parameters[SAFE_CONTENTS] ?? AuthenticatedSafe2.defaultValues(SAFE_CONTENTS);
    if (PARSED_VALUE$1 in parameters) this.parsedValue = parameters[PARSED_VALUE$1] ?? AuthenticatedSafe2.defaultValues(PARSED_VALUE$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SAFE_CONTENTS:
        return [];
      case PARSED_VALUE$1:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case SAFE_CONTENTS:
        return memberValue.length === 0;
      case PARSED_VALUE$1:
        return memberValue instanceof Object && Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new Repeated({
        name: names.contentInfos || "",
        value: ContentInfo.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of [CONTENT_INFOS]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, AuthenticatedSafe2.schema({ names: { contentInfos: CONTENT_INFOS } }));
    AsnError.assertSchema(asn1, this.className);
    this.safeContents = Array.from(asn1.result.contentInfos, (element) => new ContentInfo({ schema: element }));
  }
  toSchema() {
    return new Sequence({ value: Array.from(this.safeContents, (o) => o.toSchema()) });
  }
  toJSON() {
    return { safeContents: Array.from(this.safeContents, (o) => o.toJSON()) };
  }
  async parseInternalValues(parameters, crypto2 = getCrypto(true)) {
    ParameterError.assert(parameters, SAFE_CONTENTS);
    ArgumentError.assert(parameters.safeContents, SAFE_CONTENTS, "Array");
    if (parameters.safeContents.length !== this.safeContents.length) throw new ArgumentError('Length of "parameters.safeContents" must be equal to "this.safeContents.length"');
    this.parsedValue = { safeContents: [] };
    for (const [index, content] of this.safeContents.entries()) {
      const safeContent = parameters.safeContents[index];
      const errorTarget = `parameters.safeContents[${index}]`;
      switch (content.contentType) {
        case id_ContentType_Data:
          {
            ArgumentError.assert(content.content, "this.safeContents[j].content", OctetString);
            const authSafeContent = content.content.getValue();
            this.parsedValue.safeContents.push({
              privacyMode: 0,
              value: SafeContents.fromBER(authSafeContent)
            });
          }
          break;
        case id_ContentType_EnvelopedData:
          {
            const cmsEnveloped = new EnvelopedData({ schema: content.content });
            ParameterError.assert(errorTarget, safeContent, "recipientCertificate", "recipientKey");
            const envelopedData = safeContent;
            const recipientCertificate = envelopedData.recipientCertificate;
            const recipientKey = envelopedData.recipientKey;
            const decrypted = await cmsEnveloped.decrypt(0, {
              recipientCertificate,
              recipientPrivateKey: recipientKey
            }, crypto2);
            this.parsedValue.safeContents.push({
              privacyMode: 2,
              value: SafeContents.fromBER(decrypted)
            });
          }
          break;
        case id_ContentType_EncryptedData:
          {
            const cmsEncrypted = new EncryptedData({ schema: content.content });
            ParameterError.assert(errorTarget, safeContent, "password");
            const password = safeContent.password;
            const decrypted = await cmsEncrypted.decrypt({ password }, crypto2);
            this.parsedValue.safeContents.push({
              privacyMode: 1,
              value: SafeContents.fromBER(decrypted)
            });
          }
          break;
        default:
          throw new Error(`Unknown "contentType" for AuthenticatedSafe: " ${content.contentType}`);
      }
    }
  }
  async makeInternalValues(parameters, crypto2 = getCrypto(true)) {
    if (!this.parsedValue) throw new Error('Please run "parseValues" first or add "parsedValue" manually');
    ArgumentError.assert(this.parsedValue, "this.parsedValue", "object");
    ArgumentError.assert(this.parsedValue.safeContents, "this.parsedValue.safeContents", "Array");
    ArgumentError.assert(parameters, "parameters", "object");
    ParameterError.assert(parameters, "safeContents");
    ArgumentError.assert(parameters.safeContents, "parameters.safeContents", "Array");
    if (parameters.safeContents.length !== this.parsedValue.safeContents.length) throw new ArgumentError('Length of "parameters.safeContents" must be equal to "this.parsedValue.safeContents"');
    this.safeContents = [];
    for (const [index, content] of this.parsedValue.safeContents.entries()) {
      ParameterError.assert("content", content, "privacyMode", "value");
      ArgumentError.assert(content.value, "content.value", SafeContents);
      switch (content.privacyMode) {
        case 0:
          {
            const contentBuffer = content.value.toSchema().toBER(false);
            this.safeContents.push(new ContentInfo({
              contentType: "1.2.840.113549.1.7.1",
              content: new OctetString({ valueHex: contentBuffer })
            }));
          }
          break;
        case 1:
          {
            const cmsEncrypted = new EncryptedData();
            const currentParameters = parameters.safeContents[index];
            currentParameters.contentToEncrypt = content.value.toSchema().toBER(false);
            await cmsEncrypted.encrypt(currentParameters, crypto2);
            this.safeContents.push(new ContentInfo({
              contentType: "1.2.840.113549.1.7.6",
              content: cmsEncrypted.toSchema()
            }));
          }
          break;
        case 2:
          {
            const cmsEnveloped = new EnvelopedData();
            const contentToEncrypt = content.value.toSchema().toBER(false);
            const safeContent = parameters.safeContents[index];
            ParameterError.assert(`parameters.safeContents[${index}]`, safeContent, "encryptingCertificate", "encryptionAlgorithm");
            switch (true) {
              case safeContent.encryptionAlgorithm.name.toLowerCase() === "aes-cbc":
              case safeContent.encryptionAlgorithm.name.toLowerCase() === "aes-gcm":
                break;
              default:
                throw new Error(`Incorrect parameter "encryptionAlgorithm" in "parameters.safeContents[i]": ${safeContent.encryptionAlgorithm}`);
            }
            switch (true) {
              case safeContent.encryptionAlgorithm.length === 128:
              case safeContent.encryptionAlgorithm.length === 192:
              case safeContent.encryptionAlgorithm.length === 256:
                break;
              default:
                throw new Error(`Incorrect parameter "encryptionAlgorithm.length" in "parameters.safeContents[i]": ${safeContent.encryptionAlgorithm.length}`);
            }
            const encryptionAlgorithm = safeContent.encryptionAlgorithm;
            cmsEnveloped.addRecipientByCertificate(safeContent.encryptingCertificate, {}, void 0, crypto2);
            await cmsEnveloped.encrypt(encryptionAlgorithm, contentToEncrypt, crypto2);
            this.safeContents.push(new ContentInfo({
              contentType: "1.2.840.113549.1.7.3",
              content: cmsEnveloped.toSchema()
            }));
          }
          break;
        default:
          throw new Error(`Incorrect value for "content.privacyMode": ${content.privacyMode}`);
      }
    }
    return this;
  }
};
var HASH_ALGORITHM$1 = "hashAlgorithm";
var ISSUER_NAME_HASH = "issuerNameHash";
var ISSUER_KEY_HASH = "issuerKeyHash";
var SERIAL_NUMBER$1 = "serialNumber";
var CLEAR_PROPS$19 = [
  HASH_ALGORITHM$1,
  ISSUER_NAME_HASH,
  ISSUER_KEY_HASH,
  SERIAL_NUMBER$1
];
var CertID = class CertID2 extends PkiObject {
  static {
    this.CLASS_NAME = "CertID";
  }
  static async create(certificate, parameters, crypto2 = getCrypto(true)) {
    const certID = new CertID2();
    await certID.createForCertificate(certificate, parameters, crypto2);
    return certID;
  }
  constructor(parameters = {}) {
    super();
    this.hashAlgorithm = parameters[HASH_ALGORITHM$1] ?? CertID2.defaultValues(HASH_ALGORITHM$1);
    this.issuerNameHash = parameters[ISSUER_NAME_HASH] ?? CertID2.defaultValues(ISSUER_NAME_HASH);
    this.issuerKeyHash = parameters[ISSUER_KEY_HASH] ?? CertID2.defaultValues(ISSUER_KEY_HASH);
    this.serialNumber = parameters[SERIAL_NUMBER$1] ?? CertID2.defaultValues(SERIAL_NUMBER$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case HASH_ALGORITHM$1:
        return new AlgorithmIdentifier();
      case ISSUER_NAME_HASH:
      case ISSUER_KEY_HASH:
        return new OctetString();
      case SERIAL_NUMBER$1:
        return new Integer();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case HASH_ALGORITHM$1:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case ISSUER_NAME_HASH:
      case ISSUER_KEY_HASH:
      case SERIAL_NUMBER$1:
        return memberValue.isEqual(CertID2.defaultValues(SERIAL_NUMBER$1));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        AlgorithmIdentifier.schema(names.hashAlgorithmObject || { names: { blockName: names.hashAlgorithm || "" } }),
        new OctetString({ name: names.issuerNameHash || "" }),
        new OctetString({ name: names.issuerKeyHash || "" }),
        new Integer({ name: names.serialNumber || "" })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$19) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertID2.schema({ names: {
      hashAlgorithm: HASH_ALGORITHM$1,
      issuerNameHash: ISSUER_NAME_HASH,
      issuerKeyHash: ISSUER_KEY_HASH,
      serialNumber: SERIAL_NUMBER$1
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.hashAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.hashAlgorithm });
    this.issuerNameHash = asn1.result.issuerNameHash;
    this.issuerKeyHash = asn1.result.issuerKeyHash;
    this.serialNumber = asn1.result.serialNumber;
  }
  toSchema() {
    return new Sequence({ value: [
      this.hashAlgorithm.toSchema(),
      this.issuerNameHash,
      this.issuerKeyHash,
      this.serialNumber
    ] });
  }
  toJSON() {
    return {
      hashAlgorithm: this.hashAlgorithm.toJSON(),
      issuerNameHash: this.issuerNameHash.toJSON(),
      issuerKeyHash: this.issuerKeyHash.toJSON(),
      serialNumber: this.serialNumber.toJSON()
    };
  }
  isEqual(certificateID) {
    if (this.hashAlgorithm.algorithmId !== certificateID.hashAlgorithm.algorithmId) return false;
    if (!bytes_exports.equal(this.issuerNameHash.valueBlock.valueHexView, certificateID.issuerNameHash.valueBlock.valueHexView)) return false;
    if (!bytes_exports.equal(this.issuerKeyHash.valueBlock.valueHexView, certificateID.issuerKeyHash.valueBlock.valueHexView)) return false;
    if (!this.serialNumber.isEqual(certificateID.serialNumber)) return false;
    return true;
  }
  async createForCertificate(certificate, parameters, crypto2 = getCrypto(true)) {
    ParameterError.assert(parameters, HASH_ALGORITHM$1, "issuerCertificate");
    const hashOID = crypto2.getOIDByAlgorithm({ name: parameters.hashAlgorithm }, true, "hashAlgorithm");
    this.hashAlgorithm = new AlgorithmIdentifier({
      algorithmId: hashOID,
      algorithmParams: new Null()
    });
    const issuerCertificate = parameters.issuerCertificate;
    this.serialNumber = certificate.serialNumber;
    const hashIssuerName = await crypto2.digest({ name: parameters.hashAlgorithm }, issuerCertificate.subject.toSchema().toBER(false));
    this.issuerNameHash = new OctetString({ valueHex: hashIssuerName });
    const issuerKeyBuffer = issuerCertificate.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView;
    const hashIssuerKey = await crypto2.digest({ name: parameters.hashAlgorithm }, issuerKeyBuffer);
    this.issuerKeyHash = new OctetString({ valueHex: hashIssuerKey });
  }
};
var CERT_ID = "certID";
var CERT_STATUS = "certStatus";
var THIS_UPDATE = "thisUpdate";
var NEXT_UPDATE = "nextUpdate";
var SINGLE_EXTENSIONS = "singleExtensions";
var CLEAR_PROPS$18 = [
  CERT_ID,
  CERT_STATUS,
  THIS_UPDATE,
  NEXT_UPDATE,
  SINGLE_EXTENSIONS
];
var SingleResponse = class SingleResponse2 extends PkiObject {
  static {
    this.CLASS_NAME = "SingleResponse";
  }
  constructor(parameters = {}) {
    super();
    this.certID = parameters[CERT_ID] ?? SingleResponse2.defaultValues(CERT_ID);
    this.certStatus = parameters[CERT_STATUS] ?? SingleResponse2.defaultValues(CERT_STATUS);
    this.thisUpdate = parameters[THIS_UPDATE] ?? SingleResponse2.defaultValues(THIS_UPDATE);
    if (NEXT_UPDATE in parameters) this.nextUpdate = parameters[NEXT_UPDATE] ?? SingleResponse2.defaultValues(NEXT_UPDATE);
    if (SINGLE_EXTENSIONS in parameters) this.singleExtensions = parameters[SINGLE_EXTENSIONS] ?? SingleResponse2.defaultValues(SINGLE_EXTENSIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case CERT_ID:
        return new CertID();
      case CERT_STATUS:
        return {};
      case THIS_UPDATE:
      case NEXT_UPDATE:
        return new Date(0, 0, 0);
      case SINGLE_EXTENSIONS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case CERT_ID:
        return CertID.compareWithDefault("hashAlgorithm", memberValue.hashAlgorithm) && CertID.compareWithDefault("issuerNameHash", memberValue.issuerNameHash) && CertID.compareWithDefault("issuerKeyHash", memberValue.issuerKeyHash) && CertID.compareWithDefault("serialNumber", memberValue.serialNumber);
      case CERT_STATUS:
        return Object.keys(memberValue).length === 0;
      case THIS_UPDATE:
      case NEXT_UPDATE:
        return memberValue === SingleResponse2.defaultValues(memberName);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        CertID.schema(names.certID || {}),
        new Choice({ value: [
          new Primitive({
            name: names.certStatus || "",
            idBlock: {
              tagClass: 3,
              tagNumber: 0
            }
          }),
          new Constructed({
            name: names.certStatus || "",
            idBlock: {
              tagClass: 3,
              tagNumber: 1
            },
            value: [new GeneralizedTime(), new Constructed({
              optional: true,
              idBlock: {
                tagClass: 3,
                tagNumber: 0
              },
              value: [new Enumerated()]
            })]
          }),
          new Primitive({
            name: names.certStatus || "",
            idBlock: {
              tagClass: 3,
              tagNumber: 2
            },
            lenBlock: { length: 1 }
          })
        ] }),
        new GeneralizedTime({ name: names.thisUpdate || "" }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new GeneralizedTime({ name: names.nextUpdate || "" })]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [Extensions.schema(names.singleExtensions || {})]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$18) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SingleResponse2.schema({ names: {
      certID: { names: { blockName: CERT_ID } },
      certStatus: CERT_STATUS,
      thisUpdate: THIS_UPDATE,
      nextUpdate: NEXT_UPDATE,
      singleExtensions: { names: { blockName: SINGLE_EXTENSIONS } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.certID = new CertID({ schema: asn1.result.certID });
    this.certStatus = asn1.result.certStatus;
    this.thisUpdate = asn1.result.thisUpdate.toDate();
    if (NEXT_UPDATE in asn1.result) this.nextUpdate = asn1.result.nextUpdate.toDate();
    if (SINGLE_EXTENSIONS in asn1.result) this.singleExtensions = Array.from(asn1.result.singleExtensions.valueBlock.value, (element) => new Extension({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.certID.toSchema());
    outputArray.push(this.certStatus);
    outputArray.push(new GeneralizedTime({ valueDate: this.thisUpdate }));
    if (this.nextUpdate) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [new GeneralizedTime({ valueDate: this.nextUpdate })]
    }));
    if (this.singleExtensions) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: [new Sequence({ value: Array.from(this.singleExtensions, (o) => o.toSchema()) })]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      certID: this.certID.toJSON(),
      certStatus: this.certStatus.toJSON(),
      thisUpdate: this.thisUpdate
    };
    if (this.nextUpdate) res.nextUpdate = this.nextUpdate;
    if (this.singleExtensions) res.singleExtensions = Array.from(this.singleExtensions, (o) => o.toJSON());
    return res;
  }
};
var TBS$2 = "tbs";
var VERSION$7 = "version";
var RESPONDER_ID = "responderID";
var PRODUCED_AT = "producedAt";
var RESPONSES = "responses";
var RESPONSE_EXTENSIONS = "responseExtensions";
var RESPONSE_DATA = "ResponseData";
var RESPONSE_DATA_VERSION = `${RESPONSE_DATA}.${VERSION$7}`;
var RESPONSE_DATA_RESPONDER_ID = `${RESPONSE_DATA}.${RESPONDER_ID}`;
var RESPONSE_DATA_PRODUCED_AT = `${RESPONSE_DATA}.${PRODUCED_AT}`;
var RESPONSE_DATA_RESPONSES = `${RESPONSE_DATA}.${RESPONSES}`;
var RESPONSE_DATA_RESPONSE_EXTENSIONS = `${RESPONSE_DATA}.${RESPONSE_EXTENSIONS}`;
var CLEAR_PROPS$17 = [
  RESPONSE_DATA,
  RESPONSE_DATA_VERSION,
  RESPONSE_DATA_RESPONDER_ID,
  RESPONSE_DATA_PRODUCED_AT,
  RESPONSE_DATA_RESPONSES,
  RESPONSE_DATA_RESPONSE_EXTENSIONS
];
var ResponseData = class ResponseData2 extends PkiObject {
  static {
    this.CLASS_NAME = "ResponseData";
  }
  get tbs() {
    return toArrayBuffer(this.tbsView);
  }
  set tbs(value) {
    this.tbsView = new Uint8Array(value);
  }
  constructor(parameters = {}) {
    super();
    this.tbsView = new Uint8Array(parameters[TBS$2] ?? ResponseData2.defaultValues(TBS$2));
    if (VERSION$7 in parameters) this.version = parameters[VERSION$7] ?? ResponseData2.defaultValues(VERSION$7);
    this.responderID = parameters[RESPONDER_ID] ?? ResponseData2.defaultValues(RESPONDER_ID);
    this.producedAt = parameters[PRODUCED_AT] ?? ResponseData2.defaultValues(PRODUCED_AT);
    this.responses = parameters[RESPONSES] ?? ResponseData2.defaultValues(RESPONSES);
    if (RESPONSE_EXTENSIONS in parameters) this.responseExtensions = parameters[RESPONSE_EXTENSIONS] ?? ResponseData2.defaultValues(RESPONSE_EXTENSIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$7:
        return 0;
      case TBS$2:
        return EMPTY_BUFFER2;
      case RESPONDER_ID:
        return {};
      case PRODUCED_AT:
        return new Date(0, 0, 0);
      case RESPONSES:
      case RESPONSE_EXTENSIONS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TBS$2:
        return memberValue.byteLength === 0;
      case RESPONDER_ID:
        return Object.keys(memberValue).length === 0;
      case PRODUCED_AT:
        return memberValue === ResponseData2.defaultValues(memberName);
      case RESPONSES:
      case RESPONSE_EXTENSIONS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || RESPONSE_DATA,
      value: [
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Integer({ name: names.version || RESPONSE_DATA_VERSION })]
        }),
        new Choice({ value: [new Constructed({
          name: names.responderID || RESPONSE_DATA_RESPONDER_ID,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [RelativeDistinguishedNames.schema(names.ResponseDataByName || { names: { blockName: "ResponseData.byName" } })]
        }), new Constructed({
          name: names.responderID || RESPONSE_DATA_RESPONDER_ID,
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          value: [new OctetString({ name: names.ResponseDataByKey || "ResponseData.byKey" })]
        })] }),
        new GeneralizedTime({ name: names.producedAt || RESPONSE_DATA_PRODUCED_AT }),
        new Sequence({ value: [new Repeated({
          name: RESPONSE_DATA_RESPONSES,
          value: SingleResponse.schema(names.response || {})
        })] }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [Extensions.schema(names.extensions || { names: { blockName: RESPONSE_DATA_RESPONSE_EXTENSIONS } })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$17) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ResponseData2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.tbsView = asn1.result.ResponseData.valueBeforeDecodeView;
    if (RESPONSE_DATA_VERSION in asn1.result) this.version = asn1.result[RESPONSE_DATA_VERSION].valueBlock.valueDec;
    if (asn1.result[RESPONSE_DATA_RESPONDER_ID].idBlock.tagNumber === 1) this.responderID = new RelativeDistinguishedNames({ schema: asn1.result[RESPONSE_DATA_RESPONDER_ID].valueBlock.value[0] });
    else this.responderID = asn1.result[RESPONSE_DATA_RESPONDER_ID].valueBlock.value[0];
    this.producedAt = asn1.result[RESPONSE_DATA_PRODUCED_AT].toDate();
    this.responses = Array.from(asn1.result[RESPONSE_DATA_RESPONSES], (element) => new SingleResponse({ schema: element }));
    if (RESPONSE_DATA_RESPONSE_EXTENSIONS in asn1.result) this.responseExtensions = Array.from(asn1.result[RESPONSE_DATA_RESPONSE_EXTENSIONS].valueBlock.value, (element) => new Extension({ schema: element }));
  }
  toSchema(encodeFlag = false) {
    let tbsSchema;
    if (encodeFlag === false) {
      if (!this.tbsView.byteLength) return ResponseData2.schema();
      const asn1 = fromBER(this.tbsView);
      AsnError.assert(asn1, "TBS Response Data");
      tbsSchema = asn1.result;
    } else {
      const outputArray = [];
      if (VERSION$7 in this) outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Integer({ value: this.version })]
      }));
      if (this.responderID instanceof RelativeDistinguishedNames) outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: [this.responderID.toSchema()]
      }));
      else outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 2
        },
        value: [this.responderID]
      }));
      outputArray.push(new GeneralizedTime({ valueDate: this.producedAt }));
      outputArray.push(new Sequence({ value: Array.from(this.responses, (o) => o.toSchema()) }));
      if (this.responseExtensions) outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: [new Sequence({ value: Array.from(this.responseExtensions, (o) => o.toSchema()) })]
      }));
      tbsSchema = new Sequence({ value: outputArray });
    }
    return tbsSchema;
  }
  toJSON() {
    const res = {};
    if (VERSION$7 in this) res.version = this.version;
    if (this.responderID) res.responderID = this.responderID;
    if (this.producedAt) res.producedAt = this.producedAt;
    if (this.responses) res.responses = Array.from(this.responses, (o) => o.toJSON());
    if (this.responseExtensions) res.responseExtensions = Array.from(this.responseExtensions, (o) => o.toJSON());
    return res;
  }
};
var TRUSTED_CERTS = "trustedCerts";
var CERTS$2 = "certs";
var CRLS$1 = "crls";
var OCSPS$1 = "ocsps";
var CHECK_DATE = "checkDate";
var FIND_ORIGIN = "findOrigin";
var FIND_ISSUER = "findIssuer";
var ChainValidationError = class ChainValidationError2 extends Error {
  static {
    this.NAME = "ChainValidationError";
  }
  constructor(code, message) {
    super(message);
    this.name = ChainValidationError2.NAME;
    this.code = code;
    this.message = message;
  }
};
function isTrusted(cert, trustedList) {
  for (let i = 0; i < trustedList.length; i++) if (bytes_exports.equal(cert.tbsView, trustedList[i].tbsView)) return true;
  return false;
}
var CertificateChainValidationEngine = class CertificateChainValidationEngine2 {
  constructor(parameters = {}) {
    this.trustedCerts = parameters[TRUSTED_CERTS] ?? this.defaultValues(TRUSTED_CERTS);
    this.certs = parameters[CERTS$2] ?? this.defaultValues(CERTS$2);
    this.crls = parameters[CRLS$1] ?? this.defaultValues(CRLS$1);
    this.ocsps = parameters[OCSPS$1] ?? this.defaultValues(OCSPS$1);
    this.checkDate = parameters[CHECK_DATE] ?? this.defaultValues(CHECK_DATE);
    this.findOrigin = parameters[FIND_ORIGIN] ?? this.defaultValues(FIND_ORIGIN);
    this.findIssuer = parameters[FIND_ISSUER] ?? this.defaultValues(FIND_ISSUER);
  }
  static defaultFindOrigin(certificate, validationEngine) {
    if (certificate.tbsView.byteLength === 0) certificate.tbsView = new Uint8Array(certificate.encodeTBS().toBER());
    for (const localCert of validationEngine.certs) {
      if (localCert.tbsView.byteLength === 0) localCert.tbsView = new Uint8Array(localCert.encodeTBS().toBER());
      if (bytes_exports.equal(certificate.tbsView, localCert.tbsView)) return "Intermediate Certificates";
    }
    for (const trustedCert of validationEngine.trustedCerts) {
      if (trustedCert.tbsView.byteLength === 0) trustedCert.tbsView = new Uint8Array(trustedCert.encodeTBS().toBER());
      if (bytes_exports.equal(certificate.tbsView, trustedCert.tbsView)) return "Trusted Certificates";
    }
    return "Unknown";
  }
  async defaultFindIssuer(certificate, validationEngine, crypto2 = getCrypto(true)) {
    const result = [];
    let keyIdentifier = null;
    let authorityCertIssuer = null;
    let authorityCertSerialNumber = null;
    if (certificate.subject.isEqual(certificate.issuer)) try {
      if (await certificate.verify(void 0, crypto2)) return [certificate];
    } catch {
    }
    if (certificate.extensions) {
      for (const extension of certificate.extensions) if (extension.extnID === "2.5.29.35" && extension.parsedValue instanceof AuthorityKeyIdentifier) {
        if (extension.parsedValue.keyIdentifier) keyIdentifier = extension.parsedValue.keyIdentifier;
        else {
          if (extension.parsedValue.authorityCertIssuer) authorityCertIssuer = extension.parsedValue.authorityCertIssuer;
          if (extension.parsedValue.authorityCertSerialNumber) authorityCertSerialNumber = extension.parsedValue.authorityCertSerialNumber;
        }
        break;
      }
    }
    function checkCertificate(possibleIssuer) {
      if (keyIdentifier !== null) {
        if (possibleIssuer.extensions) {
          let extensionFound = false;
          for (const extension of possibleIssuer.extensions) if (extension.extnID === "2.5.29.14" && extension.parsedValue) {
            extensionFound = true;
            if (bytes_exports.equal(extension.parsedValue.valueBlock.valueHex, keyIdentifier.valueBlock.valueHexView)) result.push(possibleIssuer);
            break;
          }
          if (extensionFound) return;
        }
      }
      let authorityCertSerialNumberEqual = false;
      if (authorityCertSerialNumber !== null) authorityCertSerialNumberEqual = possibleIssuer.serialNumber.isEqual(authorityCertSerialNumber);
      if (authorityCertIssuer !== null) {
        if (possibleIssuer.subject.isEqual(authorityCertIssuer)) {
          if (authorityCertSerialNumberEqual) result.push(possibleIssuer);
        }
      } else if (certificate.issuer.isEqual(possibleIssuer.subject)) result.push(possibleIssuer);
    }
    for (const trustedCert of validationEngine.trustedCerts) checkCertificate(trustedCert);
    for (const intermediateCert of validationEngine.certs) checkCertificate(intermediateCert);
    for (let i = result.length - 1; i >= 0; i--) try {
      if (await certificate.verify(result[i], crypto2) === false) result.splice(i, 1);
    } catch {
      result.splice(i, 1);
    }
    return result;
  }
  defaultValues(memberName) {
    switch (memberName) {
      case TRUSTED_CERTS:
        return [];
      case CERTS$2:
        return [];
      case CRLS$1:
        return [];
      case OCSPS$1:
        return [];
      case CHECK_DATE:
        return /* @__PURE__ */ new Date();
      case FIND_ORIGIN:
        return CertificateChainValidationEngine2.defaultFindOrigin;
      case FIND_ISSUER:
        return this.defaultFindIssuer;
      default:
        throw new Error(`Invalid member name for CertificateChainValidationEngine class: ${memberName}`);
    }
  }
  async sort(passedWhenNotRevValues = false, crypto2 = getCrypto(true)) {
    const localCerts = [];
    const buildPath = async (certificate, crypto3) => {
      const result2 = [];
      function checkUnique(array) {
        let unique = true;
        for (let i = 0; i < array.length; i++) {
          for (let j = 0; j < array.length; j++) {
            if (j === i) continue;
            if (array[i] === array[j]) {
              unique = false;
              break;
            }
          }
          if (!unique) break;
        }
        return unique;
      }
      if (isTrusted(certificate, this.trustedCerts)) return [[certificate]];
      const findIssuerResult = await this.findIssuer(certificate, this, crypto3);
      if (findIssuerResult.length === 0) throw new Error("No valid certificate paths found");
      for (let i = 0; i < findIssuerResult.length; i++) {
        if (bytes_exports.equal(findIssuerResult[i].tbsView, certificate.tbsView)) {
          result2.push([findIssuerResult[i]]);
          continue;
        }
        const buildPathResult = await buildPath(findIssuerResult[i], crypto3);
        for (let j = 0; j < buildPathResult.length; j++) {
          const copy2 = buildPathResult[j].slice();
          copy2.splice(0, 0, findIssuerResult[i]);
          if (checkUnique(copy2)) result2.push(copy2);
          else result2.push(buildPathResult[j]);
        }
      }
      return result2;
    };
    const findCRL = async (certificate) => {
      const issuerCertificates = [];
      const crls = [];
      const crlsAndCertificates = [];
      issuerCertificates.push(...localCerts.filter((element) => certificate.issuer.isEqual(element.subject)));
      if (issuerCertificates.length === 0) return {
        status: 1,
        statusMessage: "No certificate's issuers"
      };
      crls.push(...this.crls.filter((o) => o.issuer.isEqual(certificate.issuer)));
      if (crls.length === 0) return {
        status: 2,
        statusMessage: "No CRLs for specific certificate issuer"
      };
      for (let i = 0; i < crls.length; i++) {
        const crl = crls[i];
        if (crl.nextUpdate && crl.nextUpdate.value < this.checkDate) continue;
        for (let j = 0; j < issuerCertificates.length; j++) try {
          if (await crls[i].verify({ issuerCertificate: issuerCertificates[j] }, crypto2)) {
            crlsAndCertificates.push({
              crl: crls[i],
              certificate: issuerCertificates[j]
            });
            break;
          }
        } catch {
        }
      }
      if (crlsAndCertificates.length) return {
        status: 0,
        statusMessage: "",
        result: crlsAndCertificates
      };
      return {
        status: 3,
        statusMessage: "No valid CRLs found"
      };
    };
    const findOCSP = async (certificate, issuerCertificate) => {
      const hashAlgorithm = crypto2.getAlgorithmByOID(certificate.signatureAlgorithm.algorithmId);
      if (!hashAlgorithm.name) return 1;
      if (!hashAlgorithm.hash) return 1;
      for (let i = 0; i < this.ocsps.length; i++) {
        const result2 = await this.ocsps[i].getCertificateStatus(certificate, issuerCertificate, crypto2);
        if (result2.isForCertificate) {
          if (result2.status === 0) return 0;
          return 1;
        }
      }
      return 2;
    };
    async function checkForCA(certificate, needToCheckCRL = false) {
      let isCA = false;
      let mustBeCA = false;
      let keyUsagePresent = false;
      let cRLSign = false;
      if (certificate.extensions) {
        for (let j = 0; j < certificate.extensions.length; j++) {
          const extension = certificate.extensions[j];
          if (extension.critical && !extension.parsedValue) return {
            result: false,
            resultCode: 6,
            resultMessage: `Unable to parse critical certificate extension: ${extension.extnID}`
          };
          if (extension.extnID === "2.5.29.15") {
            keyUsagePresent = true;
            const view = new Uint8Array(extension.parsedValue.valueBlock.valueHex);
            if ((view[0] & 4) === 4) mustBeCA = true;
            if ((view[0] & 2) === 2) cRLSign = true;
          }
          if (extension.extnID === "2.5.29.19") {
            if ("cA" in extension.parsedValue) {
              if (extension.parsedValue.cA === true) isCA = true;
            }
          }
        }
        if (mustBeCA === true && isCA === false) return {
          result: false,
          resultCode: 3,
          resultMessage: 'Unable to build certificate chain - using "keyCertSign" flag set without BasicConstraints'
        };
        if (keyUsagePresent === true && isCA === true && mustBeCA === false) return {
          result: false,
          resultCode: 4,
          resultMessage: 'Unable to build certificate chain - "keyCertSign" flag was not set'
        };
        if (isCA === true && keyUsagePresent === true && needToCheckCRL && cRLSign === false) return {
          result: false,
          resultCode: 5,
          resultMessage: 'Unable to build certificate chain - intermediate certificate must have "cRLSign" key usage flag'
        };
      }
      if (isCA === false) return {
        result: false,
        resultCode: 7,
        resultMessage: "Unable to build certificate chain - more than one possible end-user certificate"
      };
      return {
        result: true,
        resultCode: 0,
        resultMessage: ""
      };
    }
    const basicCheck = async (path, checkDate) => {
      for (let i = 0; i < path.length; i++) if (path[i].notBefore.value > checkDate || path[i].notAfter.value < checkDate) return {
        result: false,
        resultCode: 8,
        resultMessage: "The certificate is either not yet valid or expired"
      };
      if (path.length < 2) return {
        result: false,
        resultCode: 9,
        resultMessage: "Too short certificate path"
      };
      for (let i = path.length - 2; i >= 0; i--) if (path[i].issuer.isEqual(path[i].subject) === false) {
        if (path[i].issuer.isEqual(path[i + 1].subject) === false) return {
          result: false,
          resultCode: 10,
          resultMessage: "Incorrect name chaining"
        };
      }
      if (this.crls.length !== 0 || this.ocsps.length !== 0) for (let i = 0; i < path.length - 1; i++) {
        let ocspResult = 2;
        let crlResult = {
          status: 0,
          statusMessage: ""
        };
        if (this.ocsps.length !== 0) {
          ocspResult = await findOCSP(path[i], path[i + 1]);
          switch (ocspResult) {
            case 0:
              continue;
            case 1:
              return {
                result: false,
                resultCode: 12,
                resultMessage: "One of certificates was revoked via OCSP response"
              };
          }
        }
        if (this.crls.length !== 0) {
          crlResult = await findCRL(path[i]);
          if (crlResult.status === 0 && crlResult.result) for (let j = 0; j < crlResult.result.length; j++) {
            if (crlResult.result[j].crl.isCertificateRevoked(path[i])) return {
              result: false,
              resultCode: 12,
              resultMessage: "One of certificates had been revoked"
            };
            if ((await checkForCA(crlResult.result[j].certificate, true)).result === false) return {
              result: false,
              resultCode: 13,
              resultMessage: "CRL issuer certificate is not a CA certificate or does not have crlSign flag"
            };
          }
          else if (passedWhenNotRevValues === false) throw new ChainValidationError(11, `No revocation values found for one of certificates: ${crlResult.statusMessage}`);
        } else if (ocspResult === 2) return {
          result: false,
          resultCode: 11,
          resultMessage: "No revocation values found for one of certificates"
        };
        if (ocspResult === 2 && crlResult.status === 2 && passedWhenNotRevValues) {
          const issuerCertificate = path[i + 1];
          let extensionFound = false;
          if (issuerCertificate.extensions) for (const extension of issuerCertificate.extensions) switch (extension.extnID) {
            case id_CRLDistributionPoints:
            case id_FreshestCRL:
            case id_AuthorityInfoAccess:
              extensionFound = true;
          }
          if (extensionFound) throw new ChainValidationError(11, `No revocation values found for one of certificates: ${crlResult.statusMessage}`);
        }
      }
      for (const [i, cert] of path.entries()) {
        if (!i) continue;
        if (!(await checkForCA(cert)).result) return {
          result: false,
          resultCode: 14,
          resultMessage: "One of intermediate certificates is not a CA certificate"
        };
      }
      return { result: true };
    };
    localCerts.push(...this.trustedCerts);
    localCerts.push(...this.certs);
    for (let i = 0; i < localCerts.length; i++) for (let j = 0; j < localCerts.length; j++) {
      if (i === j) continue;
      if (bytes_exports.equal(localCerts[i].tbsView, localCerts[j].tbsView)) {
        localCerts.splice(j, 1);
        i = 0;
        break;
      }
    }
    const leafCert = localCerts[localCerts.length - 1];
    let result;
    const certificatePath = [leafCert];
    result = await buildPath(leafCert, crypto2);
    if (result.length === 0) throw new ChainValidationError(60, "Unable to find certificate path");
    for (let i = result.length - 1; i >= 0; i--) {
      let found = false;
      for (let j = 0; j < result[i].length; j++) {
        const certificate = result[i][j];
        for (let k = 0; k < this.trustedCerts.length; k++) if (bytes_exports.equal(certificate.tbsView, this.trustedCerts[k].tbsView)) {
          found = true;
          break;
        }
        if (found) break;
      }
      if (!found) result.splice(i, 1);
    }
    if (result.length === 0) throw new ChainValidationError(97, "No valid certificate paths found");
    let shortestLength = result[0].length;
    let shortestIndex = 0;
    for (let i = 0; i < result.length; i++) if (result[i].length < shortestLength) {
      shortestLength = result[i].length;
      shortestIndex = i;
    }
    for (let i = 0; i < result[shortestIndex].length; i++) certificatePath.push(result[shortestIndex][i]);
    result = await basicCheck(certificatePath, this.checkDate);
    if (result.result === false) throw result;
    return certificatePath;
  }
  async verify(parameters = {}, crypto2 = getCrypto(true)) {
    function compareDNSName(name, constraint) {
      const namePrepared = stringPrep(name);
      const constraintPrepared = stringPrep(constraint);
      const nameSplitted = namePrepared.split(".");
      const constraintSplitted = constraintPrepared.split(".");
      const nameLen = nameSplitted.length;
      const constrLen = constraintSplitted.length;
      if (nameLen === 0 || constrLen === 0 || nameLen < constrLen) return false;
      for (let i = 0; i < nameLen; i++) if (nameSplitted[i].length === 0) return false;
      for (let i = 0; i < constrLen; i++) if (constraintSplitted[i].length === 0) {
        if (i === 0) {
          if (constrLen === 1) return false;
          continue;
        }
        return false;
      }
      for (let i = 0; i < constrLen; i++) {
        if (constraintSplitted[constrLen - 1 - i].length === 0) continue;
        if (nameSplitted[nameLen - 1 - i].localeCompare(constraintSplitted[constrLen - 1 - i]) !== 0) return false;
      }
      return true;
    }
    function compareRFC822Name(name, constraint) {
      const namePrepared = stringPrep(name);
      const constraintPrepared = stringPrep(constraint);
      const nameSplitted = namePrepared.split("@");
      const constraintSplitted = constraintPrepared.split("@");
      if (nameSplitted.length === 0 || constraintSplitted.length === 0 || nameSplitted.length < constraintSplitted.length) return false;
      if (constraintSplitted.length === 1) {
        if (compareDNSName(nameSplitted[1], constraintSplitted[0])) {
          const ns = nameSplitted[1].split(".");
          const cs = constraintSplitted[0].split(".");
          if (cs[0].length === 0) return true;
          return ns.length === cs.length;
        }
        return false;
      }
      return namePrepared.localeCompare(constraintPrepared) === 0;
    }
    function compareUniformResourceIdentifier(name, constraint) {
      let namePrepared = stringPrep(name);
      const constraintPrepared = stringPrep(constraint);
      const ns = namePrepared.split("/");
      if (constraintPrepared.split("/").length > 1) return false;
      if (ns.length > 1) {
        for (let i = 0; i < ns.length; i++) if (ns[i].length > 0 && ns[i].charAt(ns[i].length - 1) !== ":") {
          namePrepared = ns[i].split(":")[0];
          break;
        }
      }
      if (compareDNSName(namePrepared, constraintPrepared)) {
        const nameSplitted = namePrepared.split(".");
        const constraintSplitted = constraintPrepared.split(".");
        if (constraintSplitted[0].length === 0) return true;
        return nameSplitted.length === constraintSplitted.length;
      }
      return false;
    }
    function compareIPAddress(name, constraint) {
      const nameView = name.valueBlock.valueHexView;
      const constraintView = constraint.valueBlock.valueHexView;
      if (nameView.length === 4 && constraintView.length === 8) {
        for (let i = 0; i < 4; i++) if ((nameView[i] ^ constraintView[i]) & constraintView[i + 4]) return false;
        return true;
      }
      if (nameView.length === 16 && constraintView.length === 32) {
        for (let i = 0; i < 16; i++) if ((nameView[i] ^ constraintView[i]) & constraintView[i + 16]) return false;
        return true;
      }
      return false;
    }
    function compareDirectoryName(name, constraint) {
      if (name.typesAndValues.length === 0 || constraint.typesAndValues.length === 0) return true;
      if (name.typesAndValues.length < constraint.typesAndValues.length) return false;
      let result = true;
      let nameStart = 0;
      for (let i = 0; i < constraint.typesAndValues.length; i++) {
        let localResult = false;
        for (let j = nameStart; j < name.typesAndValues.length; j++) {
          localResult = name.typesAndValues[j].isEqual(constraint.typesAndValues[i]);
          if (name.typesAndValues[j].type === constraint.typesAndValues[i].type) result = result && localResult;
          if (localResult === true) {
            if (nameStart === 0 || nameStart === j) {
              nameStart = j + 1;
              break;
            } else return false;
          }
        }
        if (localResult === false) return false;
      }
      return nameStart === 0 ? false : result;
    }
    try {
      if (this.certs.length === 0) throw new Error("Empty certificate array");
      const passedWhenNotRevValues = parameters.passedWhenNotRevValues || false;
      const initialPolicySet = parameters.initialPolicySet || ["2.5.29.32.0"];
      const initialExplicitPolicy = parameters.initialExplicitPolicy || false;
      const initialPolicyMappingInhibit = parameters.initialPolicyMappingInhibit || false;
      const initialInhibitPolicy = parameters.initialInhibitPolicy || false;
      const initialPermittedSubtreesSet = parameters.initialPermittedSubtreesSet || [];
      const initialExcludedSubtreesSet = parameters.initialExcludedSubtreesSet || [];
      const initialRequiredNameForms = parameters.initialRequiredNameForms || [];
      let explicitPolicyIndicator = initialExplicitPolicy;
      let policyMappingInhibitIndicator = initialPolicyMappingInhibit;
      let inhibitAnyPolicyIndicator = initialInhibitPolicy;
      const pendingConstraints = [
        false,
        false,
        false
      ];
      let explicitPolicyPending = 0;
      let policyMappingInhibitPending = 0;
      let inhibitAnyPolicyPending = 0;
      let permittedSubtrees = initialPermittedSubtreesSet;
      let excludedSubtrees = initialExcludedSubtreesSet;
      const requiredNameForms = initialRequiredNameForms;
      let pathDepth = 1;
      this.certs = await this.sort(passedWhenNotRevValues, crypto2);
      const allPolicies = [];
      allPolicies.push(id_AnyPolicy);
      const policiesAndCerts = [];
      const anyPolicyArray = new Array(this.certs.length - 1);
      for (let ii = 0; ii < this.certs.length - 1; ii++) anyPolicyArray[ii] = true;
      policiesAndCerts.push(anyPolicyArray);
      const policyMappings = new Array(this.certs.length - 1);
      const certPolicies = new Array(this.certs.length - 1);
      let explicitPolicyStart = explicitPolicyIndicator ? this.certs.length - 1 : -1;
      for (let i = this.certs.length - 2; i >= 0; i--, pathDepth++) {
        const cert = this.certs[i];
        if (cert.extensions) {
          for (let j = 0; j < cert.extensions.length; j++) {
            const extension = cert.extensions[j];
            if (extension.extnID === "2.5.29.32") {
              certPolicies[i] = extension.parsedValue;
              for (let s = 0; s < allPolicies.length; s++) if (allPolicies[s] === "2.5.29.32.0") {
                delete policiesAndCerts[s][i];
                break;
              }
              for (let k = 0; k < extension.parsedValue.certificatePolicies.length; k++) {
                let policyIndex = -1;
                const policyId = extension.parsedValue.certificatePolicies[k].policyIdentifier;
                for (let s = 0; s < allPolicies.length; s++) if (policyId === allPolicies[s]) {
                  policyIndex = s;
                  break;
                }
                if (policyIndex === -1) {
                  allPolicies.push(policyId);
                  const certArray = new Array(this.certs.length - 1);
                  certArray[i] = true;
                  policiesAndCerts.push(certArray);
                } else policiesAndCerts[policyIndex][i] = true;
              }
            }
            if (extension.extnID === "2.5.29.33") {
              if (policyMappingInhibitIndicator) return {
                result: false,
                resultCode: 98,
                resultMessage: "Policy mapping prohibited"
              };
              policyMappings[i] = extension.parsedValue;
            }
            if (extension.extnID === "2.5.29.36") {
              if (explicitPolicyIndicator === false) {
                if (extension.parsedValue.requireExplicitPolicy === 0) {
                  explicitPolicyIndicator = true;
                  explicitPolicyStart = i;
                } else if (pendingConstraints[0] === false) {
                  pendingConstraints[0] = true;
                  explicitPolicyPending = extension.parsedValue.requireExplicitPolicy;
                } else explicitPolicyPending = explicitPolicyPending > extension.parsedValue.requireExplicitPolicy ? extension.parsedValue.requireExplicitPolicy : explicitPolicyPending;
                if (extension.parsedValue.inhibitPolicyMapping === 0) policyMappingInhibitIndicator = true;
                else if (pendingConstraints[1] === false) {
                  pendingConstraints[1] = true;
                  policyMappingInhibitPending = extension.parsedValue.inhibitPolicyMapping + 1;
                } else policyMappingInhibitPending = policyMappingInhibitPending > extension.parsedValue.inhibitPolicyMapping + 1 ? extension.parsedValue.inhibitPolicyMapping + 1 : policyMappingInhibitPending;
              }
            }
            if (extension.extnID === "2.5.29.54") {
              if (inhibitAnyPolicyIndicator === false) {
                if (extension.parsedValue.valueBlock.valueDec === 0) inhibitAnyPolicyIndicator = true;
                else if (pendingConstraints[2] === false) {
                  pendingConstraints[2] = true;
                  inhibitAnyPolicyPending = extension.parsedValue.valueBlock.valueDec;
                } else inhibitAnyPolicyPending = inhibitAnyPolicyPending > extension.parsedValue.valueBlock.valueDec ? extension.parsedValue.valueBlock.valueDec : inhibitAnyPolicyPending;
              }
            }
          }
          if (inhibitAnyPolicyIndicator === true) {
            let policyIndex = -1;
            for (let searchAnyPolicy = 0; searchAnyPolicy < allPolicies.length; searchAnyPolicy++) if (allPolicies[searchAnyPolicy] === "2.5.29.32.0") {
              policyIndex = searchAnyPolicy;
              break;
            }
            if (policyIndex !== -1) delete policiesAndCerts[0][i];
          }
          if (explicitPolicyIndicator === false) {
            if (pendingConstraints[0] === true) {
              explicitPolicyPending--;
              if (explicitPolicyPending === 0) {
                explicitPolicyIndicator = true;
                explicitPolicyStart = i;
                pendingConstraints[0] = false;
              }
            }
          }
          if (policyMappingInhibitIndicator === false) {
            if (pendingConstraints[1] === true) {
              policyMappingInhibitPending--;
              if (policyMappingInhibitPending === 0) {
                policyMappingInhibitIndicator = true;
                pendingConstraints[1] = false;
              }
            }
          }
          if (inhibitAnyPolicyIndicator === false) {
            if (pendingConstraints[2] === true) {
              inhibitAnyPolicyPending--;
              if (inhibitAnyPolicyPending === 0) {
                inhibitAnyPolicyIndicator = true;
                pendingConstraints[2] = false;
              }
            }
          }
        }
      }
      for (let i = 0; i < this.certs.length - 1; i++) if (i < this.certs.length - 2 && typeof policyMappings[i + 1] !== "undefined") for (let k = 0; k < policyMappings[i + 1].mappings.length; k++) {
        if (policyMappings[i + 1].mappings[k].issuerDomainPolicy === "2.5.29.32.0" || policyMappings[i + 1].mappings[k].subjectDomainPolicy === "2.5.29.32.0") return {
          result: false,
          resultCode: 99,
          resultMessage: 'The "anyPolicy" should not be a part of policy mapping scheme'
        };
        let issuerDomainPolicyIndex = -1;
        let subjectDomainPolicyIndex = -1;
        for (let n = 0; n < allPolicies.length; n++) {
          if (allPolicies[n] === policyMappings[i + 1].mappings[k].issuerDomainPolicy) issuerDomainPolicyIndex = n;
          if (allPolicies[n] === policyMappings[i + 1].mappings[k].subjectDomainPolicy) subjectDomainPolicyIndex = n;
        }
        if (typeof policiesAndCerts[issuerDomainPolicyIndex][i] !== "undefined") delete policiesAndCerts[issuerDomainPolicyIndex][i];
        for (let j = 0; j < certPolicies[i].certificatePolicies.length; j++) if (policyMappings[i + 1].mappings[k].subjectDomainPolicy === certPolicies[i].certificatePolicies[j].policyIdentifier) {
          if (issuerDomainPolicyIndex !== -1 && subjectDomainPolicyIndex !== -1) {
            for (let m = 0; m <= i; m++) if (typeof policiesAndCerts[subjectDomainPolicyIndex][m] !== "undefined") {
              policiesAndCerts[issuerDomainPolicyIndex][m] = true;
              delete policiesAndCerts[subjectDomainPolicyIndex][m];
            }
          }
        }
      }
      for (let i = 0; i < allPolicies.length; i++) if (allPolicies[i] === "2.5.29.32.0") for (let j = 0; j < explicitPolicyStart; j++) delete policiesAndCerts[i][j];
      const authConstrPolicies = [];
      for (let i = 0; i < policiesAndCerts.length; i++) {
        let found = true;
        for (let j = 0; j < this.certs.length - 1; j++) {
          let anyPolicyFound = false;
          if (j < explicitPolicyStart && allPolicies[i] === "2.5.29.32.0" && allPolicies.length > 1) {
            found = false;
            break;
          }
          if (typeof policiesAndCerts[i][j] === "undefined") {
            if (j >= explicitPolicyStart) {
              for (let k = 0; k < allPolicies.length; k++) if (allPolicies[k] === "2.5.29.32.0") {
                if (policiesAndCerts[k][j] === true) anyPolicyFound = true;
                break;
              }
            }
            if (!anyPolicyFound) {
              found = false;
              break;
            }
          }
        }
        if (found === true) authConstrPolicies.push(allPolicies[i]);
      }
      let userConstrPolicies = [];
      if (initialPolicySet.length === 1 && initialPolicySet[0] === "2.5.29.32.0" && explicitPolicyIndicator === false) userConstrPolicies = initialPolicySet;
      else if (authConstrPolicies.length === 1 && authConstrPolicies[0] === "2.5.29.32.0") userConstrPolicies = initialPolicySet;
      else for (let i = 0; i < authConstrPolicies.length; i++) for (let j = 0; j < initialPolicySet.length; j++) if (initialPolicySet[j] === authConstrPolicies[i] || initialPolicySet[j] === "2.5.29.32.0") {
        userConstrPolicies.push(authConstrPolicies[i]);
        break;
      }
      const policyResult = {
        result: userConstrPolicies.length > 0,
        resultCode: 0,
        resultMessage: userConstrPolicies.length > 0 ? "" : 'Zero "userConstrPolicies" array, no intersections with "authConstrPolicies"',
        authConstrPolicies,
        userConstrPolicies,
        explicitPolicyIndicator,
        policyMappings,
        certificatePath: this.certs
      };
      if (userConstrPolicies.length === 0) return policyResult;
      if (policyResult.result === false) return policyResult;
      pathDepth = 1;
      for (let i = this.certs.length - 2; i >= 0; i--, pathDepth++) {
        const cert = this.certs[i];
        let subjectAltNames = [];
        let certPermittedSubtrees = [];
        let certExcludedSubtrees = [];
        if (cert.extensions) for (let j = 0; j < cert.extensions.length; j++) {
          const extension = cert.extensions[j];
          if (extension.extnID === "2.5.29.30") {
            if ("permittedSubtrees" in extension.parsedValue) certPermittedSubtrees = certPermittedSubtrees.concat(extension.parsedValue.permittedSubtrees);
            if ("excludedSubtrees" in extension.parsedValue) certExcludedSubtrees = certExcludedSubtrees.concat(extension.parsedValue.excludedSubtrees);
          }
          if (extension.extnID === "2.5.29.17") subjectAltNames = subjectAltNames.concat(extension.parsedValue.altNames);
        }
        let formFound = requiredNameForms.length <= 0;
        for (let j = 0; j < requiredNameForms.length; j++) switch (requiredNameForms[j].base.type) {
          case 4:
            if (requiredNameForms[j].base.value.typesAndValues.length !== cert.subject.typesAndValues.length) continue;
            formFound = true;
            for (let k = 0; k < cert.subject.typesAndValues.length; k++) if (cert.subject.typesAndValues[k].type !== requiredNameForms[j].base.value.typesAndValues[k].type) {
              formFound = false;
              break;
            }
            if (formFound === true) break;
        }
        if (formFound === false) {
          policyResult.result = false;
          policyResult.resultCode = 21;
          policyResult.resultMessage = "No necessary name form found";
          throw policyResult;
        }
        const constrGroups = [
          [],
          [],
          [],
          [],
          []
        ];
        for (let j = 0; j < permittedSubtrees.length; j++) switch (permittedSubtrees[j].base.type) {
          case 1:
            constrGroups[0].push(permittedSubtrees[j]);
            break;
          case 2:
            constrGroups[1].push(permittedSubtrees[j]);
            break;
          case 4:
            constrGroups[2].push(permittedSubtrees[j]);
            break;
          case 6:
            constrGroups[3].push(permittedSubtrees[j]);
            break;
          case 7:
            constrGroups[4].push(permittedSubtrees[j]);
        }
        for (let p = 0; p < 5; p++) {
          let groupPermitted = false;
          let valueExists = false;
          const group = constrGroups[p];
          for (let j = 0; j < group.length; j++) {
            switch (p) {
              case 0:
                if (subjectAltNames.length > 0) {
                  for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 1) {
                    valueExists = true;
                    groupPermitted = groupPermitted || compareRFC822Name(subjectAltNames[k].value, group[j].base.value);
                  }
                } else for (let k = 0; k < cert.subject.typesAndValues.length; k++) if (cert.subject.typesAndValues[k].type === "1.2.840.113549.1.9.1" || cert.subject.typesAndValues[k].type === "0.9.2342.19200300.100.1.3") {
                  valueExists = true;
                  groupPermitted = groupPermitted || compareRFC822Name(cert.subject.typesAndValues[k].value.valueBlock.value, group[j].base.value);
                }
                break;
              case 1:
                if (subjectAltNames.length > 0) {
                  for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 2) {
                    valueExists = true;
                    groupPermitted = groupPermitted || compareDNSName(subjectAltNames[k].value, group[j].base.value);
                  }
                }
                break;
              case 2:
                valueExists = true;
                groupPermitted = compareDirectoryName(cert.subject, group[j].base.value);
                break;
              case 3:
                if (subjectAltNames.length > 0) {
                  for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 6) {
                    valueExists = true;
                    groupPermitted = groupPermitted || compareUniformResourceIdentifier(subjectAltNames[k].value, group[j].base.value);
                  }
                }
                break;
              case 4:
                if (subjectAltNames.length > 0) {
                  for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 7) {
                    valueExists = true;
                    groupPermitted = groupPermitted || compareIPAddress(subjectAltNames[k].value, group[j].base.value);
                  }
                }
            }
            if (groupPermitted) break;
          }
          if (groupPermitted === false && group.length > 0 && valueExists) {
            policyResult.result = false;
            policyResult.resultCode = 41;
            policyResult.resultMessage = 'Failed to meet "permitted sub-trees" name constraint';
            throw policyResult;
          }
        }
        let excluded = false;
        for (let j = 0; j < excludedSubtrees.length; j++) {
          switch (excludedSubtrees[j].base.type) {
            case 1:
              if (subjectAltNames.length >= 0) {
                for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 1) excluded = excluded || compareRFC822Name(subjectAltNames[k].value, excludedSubtrees[j].base.value);
              } else for (let k = 0; k < cert.subject.typesAndValues.length; k++) if (cert.subject.typesAndValues[k].type === "1.2.840.113549.1.9.1" || cert.subject.typesAndValues[k].type === "0.9.2342.19200300.100.1.3") excluded = excluded || compareRFC822Name(cert.subject.typesAndValues[k].value.valueBlock.value, excludedSubtrees[j].base.value);
              break;
            case 2:
              if (subjectAltNames.length > 0) {
                for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 2) excluded = excluded || compareDNSName(subjectAltNames[k].value, excludedSubtrees[j].base.value);
              }
              break;
            case 4:
              excluded = excluded || compareDirectoryName(cert.subject, excludedSubtrees[j].base.value);
              break;
            case 6:
              if (subjectAltNames.length > 0) {
                for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 6) excluded = excluded || compareUniformResourceIdentifier(subjectAltNames[k].value, excludedSubtrees[j].base.value);
              }
              break;
            case 7:
              if (subjectAltNames.length > 0) {
                for (let k = 0; k < subjectAltNames.length; k++) if (subjectAltNames[k].type === 7) excluded = excluded || compareIPAddress(subjectAltNames[k].value, excludedSubtrees[j].base.value);
              }
          }
          if (excluded) break;
        }
        if (excluded === true) {
          policyResult.result = false;
          policyResult.resultCode = 42;
          policyResult.resultMessage = 'Failed to meet "excluded sub-trees" name constraint';
          throw policyResult;
        }
        permittedSubtrees = permittedSubtrees.concat(certPermittedSubtrees);
        excludedSubtrees = excludedSubtrees.concat(certExcludedSubtrees);
      }
      return policyResult;
    } catch (error) {
      if (error instanceof Error) {
        if (error instanceof ChainValidationError) return {
          result: false,
          resultCode: error.code,
          resultMessage: error.message,
          error
        };
        return {
          result: false,
          resultCode: -1,
          resultMessage: error.message,
          error
        };
      }
      if (error && typeof error === "object" && "resultMessage" in error) return error;
      return {
        result: false,
        resultCode: -1,
        resultMessage: `${error}`
      };
    }
  }
};
var TBS_RESPONSE_DATA = "tbsResponseData";
var SIGNATURE_ALGORITHM$3 = "signatureAlgorithm";
var SIGNATURE$2 = "signature";
var CERTS$1 = "certs";
var BASIC_OCSP_RESPONSE = "BasicOCSPResponse";
var BASIC_OCSP_RESPONSE_TBS_RESPONSE_DATA = `${BASIC_OCSP_RESPONSE}.${TBS_RESPONSE_DATA}`;
var BASIC_OCSP_RESPONSE_SIGNATURE_ALGORITHM = `${BASIC_OCSP_RESPONSE}.${SIGNATURE_ALGORITHM$3}`;
var BASIC_OCSP_RESPONSE_SIGNATURE = `${BASIC_OCSP_RESPONSE}.${SIGNATURE$2}`;
var BASIC_OCSP_RESPONSE_CERTS = `${BASIC_OCSP_RESPONSE}.${CERTS$1}`;
var CLEAR_PROPS$16 = [
  BASIC_OCSP_RESPONSE_TBS_RESPONSE_DATA,
  BASIC_OCSP_RESPONSE_SIGNATURE_ALGORITHM,
  BASIC_OCSP_RESPONSE_SIGNATURE,
  BASIC_OCSP_RESPONSE_CERTS
];
var ID_KP_OCSP_SIGNING = "1.3.6.1.5.5.7.3.9";
var ID_CE_KEY_USAGE = "2.5.29.15";
var ID_CE_EXT_KEY_USAGE = "2.5.29.37";
var BasicOCSPResponse = class BasicOCSPResponse2 extends PkiObject {
  static {
    this.CLASS_NAME = "BasicOCSPResponse";
  }
  constructor(parameters = {}) {
    super();
    this.tbsResponseData = parameters[TBS_RESPONSE_DATA] ?? BasicOCSPResponse2.defaultValues(TBS_RESPONSE_DATA);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$3] ?? BasicOCSPResponse2.defaultValues(SIGNATURE_ALGORITHM$3);
    this.signature = parameters[SIGNATURE$2] ?? BasicOCSPResponse2.defaultValues(SIGNATURE$2);
    if (CERTS$1 in parameters) this.certs = parameters[CERTS$1] ?? BasicOCSPResponse2.defaultValues(CERTS$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TBS_RESPONSE_DATA:
        return new ResponseData();
      case SIGNATURE_ALGORITHM$3:
        return new AlgorithmIdentifier();
      case SIGNATURE$2:
        return new BitString();
      case CERTS$1:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case "type": {
        let comparisonResult = ResponseData.compareWithDefault("tbs", memberValue.tbs) && ResponseData.compareWithDefault("responderID", memberValue.responderID) && ResponseData.compareWithDefault("producedAt", memberValue.producedAt) && ResponseData.compareWithDefault("responses", memberValue.responses);
        if ("responseExtensions" in memberValue) comparisonResult = comparisonResult && ResponseData.compareWithDefault("responseExtensions", memberValue.responseExtensions);
        return comparisonResult;
      }
      case SIGNATURE_ALGORITHM$3:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case SIGNATURE$2:
        return memberValue.isEqual(BasicOCSPResponse2.defaultValues(memberName));
      case CERTS$1:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || BASIC_OCSP_RESPONSE,
      value: [
        ResponseData.schema(names.tbsResponseData || { names: { blockName: BASIC_OCSP_RESPONSE_TBS_RESPONSE_DATA } }),
        AlgorithmIdentifier.schema(names.signatureAlgorithm || { names: { blockName: BASIC_OCSP_RESPONSE_SIGNATURE_ALGORITHM } }),
        new BitString({ name: names.signature || BASIC_OCSP_RESPONSE_SIGNATURE }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Sequence({ value: [new Repeated({
            name: BASIC_OCSP_RESPONSE_CERTS,
            value: Certificate.schema(names.certs || {})
          })] })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$16) delete schema[prop];
    const asn1 = compareSchema(schema, schema, BasicOCSPResponse2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.tbsResponseData = new ResponseData({ schema: asn1.result[BASIC_OCSP_RESPONSE_TBS_RESPONSE_DATA] });
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result[BASIC_OCSP_RESPONSE_SIGNATURE_ALGORITHM] });
    this.signature = asn1.result[BASIC_OCSP_RESPONSE_SIGNATURE];
    if (BASIC_OCSP_RESPONSE_CERTS in asn1.result) this.certs = Array.from(asn1.result[BASIC_OCSP_RESPONSE_CERTS], (element) => new Certificate({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.tbsResponseData.toSchema());
    outputArray.push(this.signatureAlgorithm.toSchema());
    outputArray.push(this.signature);
    if (this.certs) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [new Sequence({ value: Array.from(this.certs, (o) => o.toSchema()) })]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      tbsResponseData: this.tbsResponseData.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signature: this.signature.toJSON()
    };
    if (this.certs) res.certs = Array.from(this.certs, (o) => o.toJSON());
    return res;
  }
  async getCertificateStatus(certificate, issuerCertificate, crypto2 = getCrypto(true)) {
    const result = {
      isForCertificate: false,
      status: 2
    };
    const hashesObject = {};
    const certIDs = [];
    for (const response of this.tbsResponseData.responses) {
      const hashAlgorithm = crypto2.getAlgorithmByOID(response.certID.hashAlgorithm.algorithmId, true, "CertID.hashAlgorithm");
      if (!hashesObject[hashAlgorithm.name]) {
        hashesObject[hashAlgorithm.name] = 1;
        const certID = new CertID();
        certIDs.push(certID);
        await certID.createForCertificate(certificate, {
          hashAlgorithm: hashAlgorithm.name,
          issuerCertificate
        }, crypto2);
      }
    }
    for (const response of this.tbsResponseData.responses) for (const id of certIDs) if (response.certID.isEqual(id)) {
      result.isForCertificate = true;
      try {
        switch (response.certStatus.idBlock.isConstructed) {
          case true:
            if (response.certStatus.idBlock.tagNumber === 1) result.status = 1;
            break;
          case false:
            switch (response.certStatus.idBlock.tagNumber) {
              case 0:
                result.status = 0;
                break;
              case 2:
                result.status = 2;
            }
        }
      } catch {
      }
      return result;
    }
    return result;
  }
  async sign(privateKey, hashAlgorithm = "SHA-1", crypto2 = getCrypto(true)) {
    if (!privateKey) throw new Error("Need to provide a private key for signing");
    const signatureParams = await crypto2.getSignatureParameters(privateKey, hashAlgorithm);
    const algorithm = signatureParams.parameters.algorithm;
    if (!("name" in algorithm)) throw new Error("Empty algorithm");
    this.signatureAlgorithm = signatureParams.signatureAlgorithm;
    this.tbsResponseData.tbsView = new Uint8Array(this.tbsResponseData.toSchema(true).toBER());
    const signature = await crypto2.signWithPrivateKey(this.tbsResponseData.tbsView, privateKey, { algorithm });
    this.signature = new BitString({ valueHex: signature });
  }
  async verify(params = {}, crypto2 = getCrypto(true)) {
    if (!this.certs || this.certs.length === 0) throw new Error("No certificates attached to the BasicOCSPResponse");
    const embeddedCerts = this.certs;
    const trustedCerts = params.trustedCerts || [];
    const issuerCerts = params.issuerCerts || [];
    const trustedResponders = params.trustedResponders || [];
    const candidateIndices = await BasicOCSPResponse2.collectResponderCandidates(embeddedCerts, this.tbsResponseData.responderID, crypto2);
    if (candidateIndices.length === 0) throw new Error("No certificate matching the OCSP responderID was found in the response");
    const errors = [];
    let firstCryptoError = null;
    let signatureMismatch = false;
    let hadValidSignature = false;
    for (const idx of candidateIndices) {
      const signerCert = embeddedCerts[idx];
      let signatureOk;
      try {
        signatureOk = await this.verifyResponseSignature(signerCert, crypto2);
      } catch (err) {
        if (firstCryptoError === null) firstCryptoError = err;
        errors.push(`candidate #${idx} signature error: ${err.message}`);
        continue;
      }
      if (!signatureOk) {
        signatureMismatch = true;
        continue;
      }
      hadValidSignature = true;
      try {
        const isTrustedResponder = trustedResponders.length > 0 && BasicOCSPResponse2.containsCertificateByDer(trustedResponders, signerCert);
        let validatedPathCerts = [];
        if (!isTrustedResponder) validatedPathCerts = await BasicOCSPResponse2.validateSignerChain(signerCert, embeddedCerts, issuerCerts, trustedCerts, crypto2);
        const authIssuerCandidates = [];
        for (const cert of [
          ...issuerCerts,
          ...embeddedCerts,
          ...trustedCerts,
          ...validatedPathCerts
        ]) if (!BasicOCSPResponse2.containsCertificateByDer(authIssuerCandidates, cert)) authIssuerCandidates.push(cert);
        let allAuthorized = true;
        for (const singleResponse of this.tbsResponseData.responses) if (!await BasicOCSPResponse2.isAuthorizedResponderForCertID(signerCert, singleResponse.certID, authIssuerCandidates, trustedResponders, crypto2)) {
          allAuthorized = false;
          break;
        }
        if (allAuthorized) return true;
        else errors.push(`candidate #${idx}: responder is not authorized for all SingleResponses`);
      } catch (err) {
        errors.push(`candidate #${idx}: ${err.message}`);
      }
    }
    if (signatureMismatch && errors.length === 0 && firstCryptoError === null) return false;
    if (hadValidSignature) throw new Error(`OCSP responder verification failed. Reasons: ${errors.join("; ")}`);
    if (firstCryptoError) throw firstCryptoError;
    throw new Error(`OCSP responder verification failed. Reasons: ${errors.join("; ")}`);
  }
  static containsCertificateByDer(certs, cert) {
    const certDer = cert.toSchema(true).toBER(false);
    return certs.some((c) => bytes_exports.equal(c.toSchema(true).toBER(false), certDer));
  }
  static async collectResponderCandidates(certs, responderID, crypto2 = getCrypto(true)) {
    const indices = [];
    if (responderID instanceof RelativeDistinguishedNames) {
      for (const [index, certificate] of certs.entries()) if (certificate.subject.isEqual(responderID)) indices.push(index);
    } else if (responderID instanceof OctetString) for (const [index, certificate] of certs.entries()) {
      const spk = certificate.subjectPublicKeyInfo.subjectPublicKey;
      if (!spk.valueBlock?.valueHexView) continue;
      const hash = await crypto2.digest({ name: "sha-1" }, spk.valueBlock.valueHexView);
      if (bytes_exports.equal(hash, responderID.valueBlock.valueHex)) indices.push(index);
    }
    else throw new Error("Unsupported OCSP responderID type");
    return indices;
  }
  async verifyResponseSignature(candidateCert, crypto2 = getCrypto(true)) {
    return crypto2.verifyWithPublicKey(this.tbsResponseData.tbsView, this.signature, candidateCert.subjectPublicKeyInfo, this.signatureAlgorithm);
  }
  static async validateSignerChain(signerCert, embeddedCerts, issuerCerts, trustedCerts, crypto2 = getCrypto(true)) {
    const additionalCerts = [];
    const addIfCa = (cert) => {
      const caCert = checkCA(cert, signerCert);
      if (caCert && !BasicOCSPResponse2.containsCertificateByDer(additionalCerts, caCert)) additionalCerts.push(caCert);
    };
    for (const cert of issuerCerts) addIfCa(cert);
    for (const cert of embeddedCerts) addIfCa(cert);
    additionalCerts.push(signerCert);
    const result = await new CertificateChainValidationEngine({
      certs: additionalCerts,
      trustedCerts
    }).verify({}, crypto2);
    if (!result.result || !result.certificatePath) throw new Error(`Validation of signer's certificate chain failed${result.resultMessage ? `: ${result.resultMessage}` : ""}`);
    return result.certificatePath.slice(1);
  }
  static async findIssuersForCertID(certID, issuerCandidates, crypto2 = getCrypto(true)) {
    const responseHashAlg = crypto2.getAlgorithmByOID(certID.hashAlgorithm.algorithmId, false);
    if (!responseHashAlg || !("name" in responseHashAlg)) return [];
    const hashAlgName = responseHashAlg.name;
    const uniqueByDer = [];
    for (const candidate of issuerCandidates) if (!BasicOCSPResponse2.containsCertificateByDer(uniqueByDer, candidate)) uniqueByDer.push(candidate);
    const matched = [];
    for (const candidate of uniqueByDer) {
      const candidateID = new CertID();
      try {
        await candidateID.createForCertificate(candidate, {
          hashAlgorithm: hashAlgName,
          issuerCertificate: candidate
        }, crypto2);
      } catch {
        continue;
      }
      if (candidateID.hashAlgorithm.algorithmId !== certID.hashAlgorithm.algorithmId) continue;
      if (!bytes_exports.equal(candidateID.issuerNameHash.valueBlock.valueHexView, certID.issuerNameHash.valueBlock.valueHexView)) continue;
      if (!bytes_exports.equal(candidateID.issuerKeyHash.valueBlock.valueHexView, certID.issuerKeyHash.valueBlock.valueHexView)) continue;
      matched.push(candidate);
    }
    return matched;
  }
  static async certificateMatchesIssuerID(certificate, certID, crypto2 = getCrypto(true)) {
    const responseHashAlg = crypto2.getAlgorithmByOID(certID.hashAlgorithm.algorithmId, false);
    if (!responseHashAlg || !("name" in responseHashAlg)) return false;
    const hashAlgName = responseHashAlg.name;
    try {
      const nameHash = await crypto2.digest({ name: hashAlgName }, certificate.subject.toSchema().toBER(false));
      if (!bytes_exports.equal(new Uint8Array(nameHash), certID.issuerNameHash.valueBlock.valueHexView)) return false;
      const keyBytes = certificate.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView;
      const keyHash = await crypto2.digest({ name: hashAlgName }, keyBytes);
      return bytes_exports.equal(new Uint8Array(keyHash), certID.issuerKeyHash.valueBlock.valueHexView);
    } catch {
      return false;
    }
  }
  static async isAuthorizedResponderForCertID(signerCert, certID, issuerCandidates, trustedResponders, crypto2 = getCrypto(true)) {
    if (trustedResponders.length > 0 && BasicOCSPResponse2.containsCertificateByDer(trustedResponders, signerCert)) return true;
    if (await BasicOCSPResponse2.certificateMatchesIssuerID(signerCert, certID, crypto2)) return true;
    if (!BasicOCSPResponse2.certHasOCSPSigningEKU(signerCert)) return false;
    if (!BasicOCSPResponse2.certKeyUsagePermitsDigitalSignature(signerCert)) return false;
    const issuers = await BasicOCSPResponse2.findIssuersForCertID(certID, issuerCandidates, crypto2);
    for (const issuerCert of issuers) {
      if (!signerCert.issuer.isEqual(issuerCert.subject)) continue;
      try {
        if (await signerCert.verify(issuerCert, crypto2)) return true;
      } catch {
      }
    }
    return false;
  }
  static certHasOCSPSigningEKU(cert) {
    const ext = cert.extensions?.find((e) => e.extnID === ID_CE_EXT_KEY_USAGE);
    if (!ext) return false;
    const parsed = ext.parsedValue;
    if (parsed instanceof ExtKeyUsage) return parsed.keyPurposes.includes(ID_KP_OCSP_SIGNING);
    try {
      const asn1 = fromBER(ext.extnValue.valueBlock.valueHexView);
      if (asn1.offset === -1) return false;
      if (!(asn1.result instanceof Sequence)) return false;
      return new ExtKeyUsage({ schema: asn1.result }).keyPurposes.includes(ID_KP_OCSP_SIGNING);
    } catch {
      return false;
    }
  }
  static certKeyUsagePermitsDigitalSignature(cert) {
    const ext = cert.extensions?.find((e) => e.extnID === ID_CE_KEY_USAGE);
    if (!ext) return true;
    try {
      const asn1 = fromBER(ext.extnValue.valueBlock.valueHexView);
      if (asn1.offset === -1) return false;
      if (!(asn1.result instanceof BitString)) return false;
      const bits = new Uint8Array(asn1.result.valueBlock.valueHexView);
      if (bits.length === 0) return false;
      return (bits[0] & 128) !== 0;
    } catch {
      return false;
    }
  }
};
var TBS$1 = "tbs";
var VERSION$6 = "version";
var SUBJECT = "subject";
var SPKI = "subjectPublicKeyInfo";
var ATTRIBUTES$1 = "attributes";
var SIGNATURE_ALGORITHM$2 = "signatureAlgorithm";
var SIGNATURE_VALUE = "signatureValue";
var CSR_INFO = "CertificationRequestInfo";
var CSR_INFO_VERSION = `${CSR_INFO}.version`;
var CSR_INFO_SUBJECT = `${CSR_INFO}.subject`;
var CSR_INFO_SPKI = `${CSR_INFO}.subjectPublicKeyInfo`;
var CSR_INFO_ATTRS = `${CSR_INFO}.attributes`;
var CLEAR_PROPS$15 = [
  CSR_INFO,
  CSR_INFO_VERSION,
  CSR_INFO_SUBJECT,
  CSR_INFO_SPKI,
  CSR_INFO_ATTRS,
  SIGNATURE_ALGORITHM$2,
  SIGNATURE_VALUE
];
function CertificationRequestInfo(parameters = {}) {
  const names = parameters.names ?? {};
  return new Sequence({
    name: names.CertificationRequestInfo || CSR_INFO,
    value: [
      new Integer({ name: names.CertificationRequestInfoVersion || CSR_INFO_VERSION }),
      RelativeDistinguishedNames.schema(names.subject || { names: { blockName: CSR_INFO_SUBJECT } }),
      PublicKeyInfo.schema({ names: { blockName: CSR_INFO_SPKI } }),
      new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Repeated({
          optional: true,
          name: names.CertificationRequestInfoAttributes || CSR_INFO_ATTRS,
          value: Attribute.schema(names.attributes || {})
        })]
      })
    ]
  });
}
var CertificationRequest = class CertificationRequest2 extends PkiObject {
  static {
    this.CLASS_NAME = "CertificationRequest";
  }
  get tbs() {
    return toArrayBuffer(this.tbsView);
  }
  set tbs(value) {
    this.tbsView = new Uint8Array(value);
  }
  constructor(parameters = {}) {
    super();
    this.tbsView = new Uint8Array(parameters[TBS$1] ?? CertificationRequest2.defaultValues(TBS$1));
    this.version = parameters[VERSION$6] ?? CertificationRequest2.defaultValues(VERSION$6);
    this.subject = parameters[SUBJECT] ?? CertificationRequest2.defaultValues(SUBJECT);
    this.subjectPublicKeyInfo = parameters[SPKI] ?? CertificationRequest2.defaultValues(SPKI);
    if (ATTRIBUTES$1 in parameters) this.attributes = parameters[ATTRIBUTES$1] ?? CertificationRequest2.defaultValues(ATTRIBUTES$1);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$2] ?? CertificationRequest2.defaultValues(SIGNATURE_ALGORITHM$2);
    this.signatureValue = parameters[SIGNATURE_VALUE] ?? CertificationRequest2.defaultValues(SIGNATURE_VALUE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TBS$1:
        return EMPTY_BUFFER2;
      case VERSION$6:
        return 0;
      case SUBJECT:
        return new RelativeDistinguishedNames();
      case SPKI:
        return new PublicKeyInfo();
      case ATTRIBUTES$1:
        return [];
      case SIGNATURE_ALGORITHM$2:
        return new AlgorithmIdentifier();
      case SIGNATURE_VALUE:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({ value: [
      CertificationRequestInfo(names.certificationRequestInfo || {}),
      new Sequence({
        name: names.signatureAlgorithm || SIGNATURE_ALGORITHM$2,
        value: [new ObjectIdentifier(), new Any({ optional: true })]
      }),
      new BitString({ name: names.signatureValue || SIGNATURE_VALUE })
    ] });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$15) delete schema[prop];
    const asn1 = compareSchema(schema, schema, CertificationRequest2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.tbsView = asn1.result.CertificationRequestInfo.valueBeforeDecodeView;
    this.version = asn1.result[CSR_INFO_VERSION].valueBlock.valueDec;
    this.subject = new RelativeDistinguishedNames({ schema: asn1.result[CSR_INFO_SUBJECT] });
    this.subjectPublicKeyInfo = new PublicKeyInfo({ schema: asn1.result[CSR_INFO_SPKI] });
    if (CSR_INFO_ATTRS in asn1.result) this.attributes = Array.from(asn1.result[CSR_INFO_ATTRS], (element) => new Attribute({ schema: element }));
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.signatureAlgorithm });
    this.signatureValue = asn1.result.signatureValue;
  }
  encodeTBS() {
    const outputArray = [
      new Integer({ value: this.version }),
      this.subject.toSchema(),
      this.subjectPublicKeyInfo.toSchema()
    ];
    if (ATTRIBUTES$1 in this) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: Array.from(this.attributes || [], (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toSchema(encodeFlag = false) {
    let tbsSchema;
    if (encodeFlag === false) {
      if (this.tbsView.byteLength === 0) return CertificationRequest2.schema();
      const asn1 = fromBER(this.tbsView);
      AsnError.assert(asn1, "PKCS#10 Certificate Request");
      tbsSchema = asn1.result;
    } else tbsSchema = this.encodeTBS();
    return new Sequence({ value: [
      tbsSchema,
      this.signatureAlgorithm.toSchema(),
      this.signatureValue
    ] });
  }
  toJSON() {
    const object = {
      tbs: hex_exports.encode(this.tbsView),
      version: this.version,
      subject: this.subject.toJSON(),
      subjectPublicKeyInfo: this.subjectPublicKeyInfo.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signatureValue: this.signatureValue.toJSON()
    };
    if (ATTRIBUTES$1 in this) object.attributes = Array.from(this.attributes || [], (o) => o.toJSON());
    return object;
  }
  async sign(privateKey, hashAlgorithm = "SHA-1", crypto2 = getCrypto(true)) {
    if (!privateKey) throw new Error("Need to provide a private key for signing");
    const signatureParams = await crypto2.getSignatureParameters(privateKey, hashAlgorithm);
    const parameters = signatureParams.parameters;
    this.signatureAlgorithm = signatureParams.signatureAlgorithm;
    this.tbsView = new Uint8Array(this.encodeTBS().toBER());
    const signature = await crypto2.signWithPrivateKey(this.tbsView, privateKey, parameters);
    this.signatureValue = new BitString({ valueHex: signature });
  }
  async verify(crypto2 = getCrypto(true)) {
    return crypto2.verifyWithPublicKey(this.tbsView, this.signatureValue, this.subjectPublicKeyInfo, this.signatureAlgorithm);
  }
  async getPublicKey(parameters, crypto2 = getCrypto(true)) {
    return crypto2.getPublicKey(this.subjectPublicKeyInfo, this.signatureAlgorithm, parameters);
  }
};
var DIGEST_ALGORITHM$1 = "digestAlgorithm";
var DIGEST = "digest";
var CLEAR_PROPS$14 = [DIGEST_ALGORITHM$1, DIGEST];
var DigestInfo = class DigestInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "DigestInfo";
  }
  constructor(parameters = {}) {
    super();
    this.digestAlgorithm = parameters[DIGEST_ALGORITHM$1] ?? DigestInfo2.defaultValues(DIGEST_ALGORITHM$1);
    this.digest = parameters[DIGEST] ?? DigestInfo2.defaultValues(DIGEST);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case DIGEST_ALGORITHM$1:
        return new AlgorithmIdentifier();
      case DIGEST:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case DIGEST_ALGORITHM$1:
        return AlgorithmIdentifier.compareWithDefault("algorithmId", memberValue.algorithmId) && "algorithmParams" in memberValue === false;
      case DIGEST:
        return memberValue.isEqual(DigestInfo2.defaultValues(memberName));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [AlgorithmIdentifier.schema(names.digestAlgorithm || { names: { blockName: DIGEST_ALGORITHM$1 } }), new OctetString({ name: names.digest || DIGEST })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$14) delete schema[prop];
    const asn1 = compareSchema(schema, schema, DigestInfo2.schema({ names: {
      digestAlgorithm: { names: { blockName: DIGEST_ALGORITHM$1 } },
      digest: DIGEST
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.digestAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.digestAlgorithm });
    this.digest = asn1.result.digest;
  }
  toSchema() {
    return new Sequence({ value: [this.digestAlgorithm.toSchema(), this.digest] });
  }
  toJSON() {
    return {
      digestAlgorithm: this.digestAlgorithm.toJSON(),
      digest: this.digest.toJSON()
    };
  }
};
var E_CONTENT_TYPE = "eContentType";
var E_CONTENT = "eContent";
var CLEAR_PROPS$13 = [E_CONTENT_TYPE, E_CONTENT];
var EncapsulatedContentInfo = class EncapsulatedContentInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "EncapsulatedContentInfo";
  }
  constructor(parameters = {}) {
    super();
    this.eContentType = parameters[E_CONTENT_TYPE] ?? EncapsulatedContentInfo2.defaultValues(E_CONTENT_TYPE);
    if (E_CONTENT in parameters) {
      this.eContent = parameters[E_CONTENT] ?? EncapsulatedContentInfo2.defaultValues(E_CONTENT);
      if (this.eContent.idBlock.tagClass === 1 && this.eContent.idBlock.tagNumber === 4) {
        if (this.eContent.idBlock.isConstructed === false) {
          const constrString = new OctetString({
            idBlock: { isConstructed: true },
            isConstructed: true
          });
          let offset = 0;
          const viewHex = this.eContent.valueBlock.valueHexView.slice().buffer;
          let length = viewHex.byteLength;
          while (length > 0) {
            const pieceView = new Uint8Array(viewHex, offset, offset + 65536 > viewHex.byteLength ? viewHex.byteLength - offset : 65536);
            const _array = new ArrayBuffer(pieceView.length);
            const _view = new Uint8Array(_array);
            for (let i = 0; i < _view.length; i++) _view[i] = pieceView[i];
            constrString.valueBlock.value.push(new OctetString({ valueHex: _array }));
            length -= pieceView.length;
            offset += pieceView.length;
          }
          this.eContent = constrString;
        }
      }
    }
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case E_CONTENT_TYPE:
        return "";
      case E_CONTENT:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case E_CONTENT_TYPE:
        return memberValue === "";
      case E_CONTENT:
        if (memberValue.idBlock.tagClass === 1 && memberValue.idBlock.tagNumber === 4) return memberValue.isEqual(EncapsulatedContentInfo2.defaultValues(E_CONTENT));
        return false;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.eContentType || "" }), new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Any({ name: names.eContent || "" })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$13) delete schema[prop];
    const asn1 = compareSchema(schema, schema, EncapsulatedContentInfo2.schema({ names: {
      eContentType: E_CONTENT_TYPE,
      eContent: E_CONTENT
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.eContentType = asn1.result.eContentType.valueBlock.toString();
    if (E_CONTENT in asn1.result) this.eContent = asn1.result.eContent;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new ObjectIdentifier({ value: this.eContentType }));
    if (this.eContent) {
      if (EncapsulatedContentInfo2.compareWithDefault(E_CONTENT, this.eContent) === false) outputArray.push(new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [this.eContent]
      }));
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { eContentType: this.eContentType };
    if (this.eContent && EncapsulatedContentInfo2.compareWithDefault(E_CONTENT, this.eContent) === false) res.eContent = this.eContent.toJSON();
    return res;
  }
};
var MAC = "mac";
var MAC_SALT = "macSalt";
var ITERATIONS = "iterations";
var CLEAR_PROPS$12 = [
  MAC,
  MAC_SALT,
  ITERATIONS
];
var MacData = class MacData2 extends PkiObject {
  static {
    this.CLASS_NAME = "MacData";
  }
  constructor(parameters = {}) {
    super();
    this.mac = parameters[MAC] ?? MacData2.defaultValues(MAC);
    this.macSalt = parameters[MAC_SALT] ?? MacData2.defaultValues(MAC_SALT);
    if (ITERATIONS in parameters) this.iterations = parameters[ITERATIONS] ?? MacData2.defaultValues(ITERATIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case MAC:
        return new DigestInfo();
      case MAC_SALT:
        return new OctetString();
      case ITERATIONS:
        return 1;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case MAC:
        return DigestInfo.compareWithDefault("digestAlgorithm", memberValue.digestAlgorithm) && DigestInfo.compareWithDefault("digest", memberValue.digest);
      case MAC_SALT:
        return memberValue.isEqual(MacData2.defaultValues(memberName));
      case ITERATIONS:
        return memberValue === MacData2.defaultValues(memberName);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      optional: names.optional || true,
      value: [
        DigestInfo.schema(names.mac || { names: { blockName: MAC } }),
        new OctetString({ name: names.macSalt || MAC_SALT }),
        new Integer({
          optional: true,
          name: names.iterations || ITERATIONS
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$12) delete schema[prop];
    const asn1 = compareSchema(schema, schema, MacData2.schema({ names: {
      mac: { names: { blockName: MAC } },
      macSalt: MAC_SALT,
      iterations: ITERATIONS
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.mac = new DigestInfo({ schema: asn1.result.mac });
    this.macSalt = asn1.result.macSalt;
    if (ITERATIONS in asn1.result) this.iterations = asn1.result.iterations.valueBlock.valueDec;
  }
  toSchema() {
    const outputArray = [this.mac.toSchema(), this.macSalt];
    if (this.iterations !== void 0) outputArray.push(new Integer({ value: this.iterations }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      mac: this.mac.toJSON(),
      macSalt: this.macSalt.toJSON()
    };
    if (this.iterations !== void 0) res.iterations = this.iterations;
    return res;
  }
};
var HASH_ALGORITHM = "hashAlgorithm";
var HASHED_MESSAGE = "hashedMessage";
var CLEAR_PROPS$11 = [HASH_ALGORITHM, HASHED_MESSAGE];
var MessageImprint = class MessageImprint2 extends PkiObject {
  static {
    this.CLASS_NAME = "MessageImprint";
  }
  static async create(hashAlgorithm, message, crypto2 = getCrypto(true)) {
    const hashAlgorithmOID = crypto2.getOIDByAlgorithm({ name: hashAlgorithm }, true, "hashAlgorithm");
    const hashedMessage = await crypto2.digest(hashAlgorithm, message);
    return new MessageImprint2({
      hashAlgorithm: new AlgorithmIdentifier({
        algorithmId: hashAlgorithmOID,
        algorithmParams: new Null()
      }),
      hashedMessage: new OctetString({ valueHex: hashedMessage })
    });
  }
  constructor(parameters = {}) {
    super();
    this.hashAlgorithm = parameters["hashAlgorithm"] ?? MessageImprint2.defaultValues("hashAlgorithm");
    this.hashedMessage = parameters["hashedMessage"] ?? MessageImprint2.defaultValues("hashedMessage");
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case HASH_ALGORITHM:
        return new AlgorithmIdentifier();
      case HASHED_MESSAGE:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case HASH_ALGORITHM:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case HASHED_MESSAGE:
        return memberValue.isEqual(MessageImprint2.defaultValues(memberName)) === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [AlgorithmIdentifier.schema(names.hashAlgorithm || {}), new OctetString({ name: names.hashedMessage || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$11) delete schema[prop];
    const asn1 = compareSchema(schema, schema, MessageImprint2.schema({ names: {
      hashAlgorithm: { names: { blockName: HASH_ALGORITHM } },
      hashedMessage: HASHED_MESSAGE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.hashAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.hashAlgorithm });
    this.hashedMessage = asn1.result.hashedMessage;
  }
  toSchema() {
    return new Sequence({ value: [this.hashAlgorithm.toSchema(), this.hashedMessage] });
  }
  toJSON() {
    return {
      hashAlgorithm: this.hashAlgorithm.toJSON(),
      hashedMessage: this.hashedMessage.toJSON()
    };
  }
};
var REQ_CERT = "reqCert";
var SINGLE_REQUEST_EXTENSIONS = "singleRequestExtensions";
var CLEAR_PROPS$10 = [REQ_CERT, SINGLE_REQUEST_EXTENSIONS];
var Request = class Request2 extends PkiObject {
  static {
    this.CLASS_NAME = "Request";
  }
  constructor(parameters = {}) {
    super();
    this.reqCert = parameters[REQ_CERT] ?? Request2.defaultValues(REQ_CERT);
    if (SINGLE_REQUEST_EXTENSIONS in parameters) this.singleRequestExtensions = parameters[SINGLE_REQUEST_EXTENSIONS] ?? Request2.defaultValues(SINGLE_REQUEST_EXTENSIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case REQ_CERT:
        return new CertID();
      case SINGLE_REQUEST_EXTENSIONS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case REQ_CERT:
        return memberValue.isEqual(Request2.defaultValues(memberName));
      case SINGLE_REQUEST_EXTENSIONS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [CertID.schema(names.reqCert || {}), new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [Extensions.schema(names.extensions || { names: { blockName: names.singleRequestExtensions || "" } })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$10) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Request2.schema({ names: {
      reqCert: { names: { blockName: REQ_CERT } },
      extensions: { names: { blockName: SINGLE_REQUEST_EXTENSIONS } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.reqCert = new CertID({ schema: asn1.result.reqCert });
    if (SINGLE_REQUEST_EXTENSIONS in asn1.result) this.singleRequestExtensions = Array.from(asn1.result.singleRequestExtensions.valueBlock.value, (element) => new Extension({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.reqCert.toSchema());
    if (this.singleRequestExtensions) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [new Sequence({ value: Array.from(this.singleRequestExtensions, (o) => o.toSchema()) })]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { reqCert: this.reqCert.toJSON() };
    if (this.singleRequestExtensions) res.singleRequestExtensions = Array.from(this.singleRequestExtensions, (o) => o.toJSON());
    return res;
  }
};
var TBS = "tbs";
var VERSION$5 = "version";
var REQUESTOR_NAME = "requestorName";
var REQUEST_LIST = "requestList";
var REQUEST_EXTENSIONS = "requestExtensions";
var TBS_REQUEST$1 = "TBSRequest";
var TBS_REQUEST_VERSION = `${TBS_REQUEST$1}.${VERSION$5}`;
var TBS_REQUEST_REQUESTOR_NAME = `${TBS_REQUEST$1}.${REQUESTOR_NAME}`;
var TBS_REQUEST_REQUESTS = `${TBS_REQUEST$1}.requests`;
var TBS_REQUEST_REQUEST_EXTENSIONS = `${TBS_REQUEST$1}.${REQUEST_EXTENSIONS}`;
var CLEAR_PROPS$9 = [
  TBS_REQUEST$1,
  TBS_REQUEST_VERSION,
  TBS_REQUEST_REQUESTOR_NAME,
  TBS_REQUEST_REQUESTS,
  TBS_REQUEST_REQUEST_EXTENSIONS
];
var TBSRequest = class TBSRequest2 extends PkiObject {
  static {
    this.CLASS_NAME = "TBSRequest";
  }
  get tbs() {
    return toArrayBuffer(this.tbsView);
  }
  set tbs(value) {
    this.tbsView = new Uint8Array(value);
  }
  constructor(parameters = {}) {
    super();
    this.tbsView = new Uint8Array(parameters[TBS] ?? TBSRequest2.defaultValues(TBS));
    if (VERSION$5 in parameters) this.version = parameters[VERSION$5] ?? TBSRequest2.defaultValues(VERSION$5);
    if (REQUESTOR_NAME in parameters) this.requestorName = parameters[REQUESTOR_NAME] ?? TBSRequest2.defaultValues(REQUESTOR_NAME);
    this.requestList = parameters[REQUEST_LIST] ?? TBSRequest2.defaultValues(REQUEST_LIST);
    if (REQUEST_EXTENSIONS in parameters) this.requestExtensions = parameters[REQUEST_EXTENSIONS] ?? TBSRequest2.defaultValues(REQUEST_EXTENSIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TBS:
        return EMPTY_BUFFER2;
      case VERSION$5:
        return 0;
      case REQUESTOR_NAME:
        return new GeneralName();
      case REQUEST_LIST:
      case REQUEST_EXTENSIONS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TBS:
        return memberValue.byteLength === 0;
      case VERSION$5:
        return memberValue === TBSRequest2.defaultValues(memberName);
      case REQUESTOR_NAME:
        return memberValue.type === GeneralName.defaultValues("type") && Object.keys(memberValue.value).length === 0;
      case REQUEST_LIST:
      case REQUEST_EXTENSIONS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || TBS_REQUEST$1,
      value: [
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Integer({ name: names.TBSRequestVersion || TBS_REQUEST_VERSION })]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [GeneralName.schema(names.requestorName || { names: { blockName: TBS_REQUEST_REQUESTOR_NAME } })]
        }),
        new Sequence({
          name: names.requestList || "TBSRequest.requestList",
          value: [new Repeated({
            name: names.requests || TBS_REQUEST_REQUESTS,
            value: Request.schema(names.requestNames || {})
          })]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 2
          },
          value: [Extensions.schema(names.extensions || { names: { blockName: names.requestExtensions || TBS_REQUEST_REQUEST_EXTENSIONS } })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$9) delete schema[prop];
    const asn1 = compareSchema(schema, schema, TBSRequest2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.tbsView = asn1.result.TBSRequest.valueBeforeDecodeView;
    if (TBS_REQUEST_VERSION in asn1.result) this.version = asn1.result[TBS_REQUEST_VERSION].valueBlock.valueDec;
    if (TBS_REQUEST_REQUESTOR_NAME in asn1.result) this.requestorName = new GeneralName({ schema: asn1.result[TBS_REQUEST_REQUESTOR_NAME] });
    this.requestList = Array.from(asn1.result[TBS_REQUEST_REQUESTS], (element) => new Request({ schema: element }));
    if (TBS_REQUEST_REQUEST_EXTENSIONS in asn1.result) this.requestExtensions = Array.from(asn1.result[TBS_REQUEST_REQUEST_EXTENSIONS].valueBlock.value, (element) => new Extension({ schema: element }));
  }
  toSchema(encodeFlag = false) {
    let tbsSchema;
    if (encodeFlag === false) {
      if (this.tbsView.byteLength === 0) return TBSRequest2.schema();
      const asn1 = fromBER(this.tbsView);
      AsnError.assert(asn1, "TBS Request");
      if (!(asn1.result instanceof Sequence)) throw new Error("ASN.1 result should be SEQUENCE");
      tbsSchema = asn1.result;
    } else {
      const outputArray = [];
      if (this.version !== void 0) outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [new Integer({ value: this.version })]
      }));
      if (this.requestorName) outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 1
        },
        value: [this.requestorName.toSchema()]
      }));
      outputArray.push(new Sequence({ value: Array.from(this.requestList, (o) => o.toSchema()) }));
      if (this.requestExtensions) outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 2
        },
        value: [new Sequence({ value: Array.from(this.requestExtensions, (o) => o.toSchema()) })]
      }));
      tbsSchema = new Sequence({ value: outputArray });
    }
    return tbsSchema;
  }
  toJSON() {
    const res = {};
    if (this.version != void 0) res.version = this.version;
    if (this.requestorName) res.requestorName = this.requestorName.toJSON();
    res.requestList = Array.from(this.requestList, (o) => o.toJSON());
    if (this.requestExtensions) res.requestExtensions = Array.from(this.requestExtensions, (o) => o.toJSON());
    return res;
  }
};
var SIGNATURE_ALGORITHM$1 = "signatureAlgorithm";
var SIGNATURE$1 = "signature";
var CERTS = "certs";
var Signature = class Signature2 extends PkiObject {
  static {
    this.CLASS_NAME = "Signature";
  }
  constructor(parameters = {}) {
    super();
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM$1] ?? Signature2.defaultValues(SIGNATURE_ALGORITHM$1);
    this.signature = parameters[SIGNATURE$1] ?? Signature2.defaultValues(SIGNATURE$1);
    if (CERTS in parameters) this.certs = parameters[CERTS] ?? Signature2.defaultValues(CERTS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case SIGNATURE_ALGORITHM$1:
        return new AlgorithmIdentifier();
      case SIGNATURE$1:
        return new BitString();
      case CERTS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case SIGNATURE_ALGORITHM$1:
        return memberValue.algorithmId === "" && "algorithmParams" in memberValue === false;
      case SIGNATURE$1:
        return memberValue.isEqual(Signature2.defaultValues(memberName));
      case CERTS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        AlgorithmIdentifier.schema(names.signatureAlgorithm || {}),
        new BitString({ name: names.signature || "" }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Sequence({ value: [new Repeated({
            name: names.certs || "",
            value: Certificate.schema({})
          })] })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of [
      SIGNATURE_ALGORITHM$1,
      SIGNATURE$1,
      CERTS
    ]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, Signature2.schema({ names: {
      signatureAlgorithm: { names: { blockName: SIGNATURE_ALGORITHM$1 } },
      signature: SIGNATURE$1,
      certs: CERTS
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result.signatureAlgorithm });
    this.signature = asn1.result.signature;
    if (CERTS in asn1.result) this.certs = Array.from(asn1.result.certs, (element) => new Certificate({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.signatureAlgorithm.toSchema());
    outputArray.push(this.signature);
    if (this.certs) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [new Sequence({ value: Array.from(this.certs, (o) => o.toSchema()) })]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signature: this.signature.toJSON()
    };
    if (this.certs) res.certs = Array.from(this.certs, (o) => o.toJSON());
    return res;
  }
};
var TBS_REQUEST = "tbsRequest";
var OPTIONAL_SIGNATURE = "optionalSignature";
var CLEAR_PROPS$8 = [TBS_REQUEST, OPTIONAL_SIGNATURE];
var OCSPRequest = class OCSPRequest2 extends PkiObject {
  static {
    this.CLASS_NAME = "OCSPRequest";
  }
  constructor(parameters = {}) {
    super();
    this.tbsRequest = parameters[TBS_REQUEST] ?? OCSPRequest2.defaultValues(TBS_REQUEST);
    if (OPTIONAL_SIGNATURE in parameters) this.optionalSignature = parameters[OPTIONAL_SIGNATURE] ?? OCSPRequest2.defaultValues(OPTIONAL_SIGNATURE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TBS_REQUEST:
        return new TBSRequest();
      case OPTIONAL_SIGNATURE:
        return new Signature();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TBS_REQUEST:
        return TBSRequest.compareWithDefault("tbs", memberValue.tbs) && TBSRequest.compareWithDefault("version", memberValue.version) && TBSRequest.compareWithDefault("requestorName", memberValue.requestorName) && TBSRequest.compareWithDefault("requestList", memberValue.requestList) && TBSRequest.compareWithDefault("requestExtensions", memberValue.requestExtensions);
      case OPTIONAL_SIGNATURE:
        return Signature.compareWithDefault("signatureAlgorithm", memberValue.signatureAlgorithm) && Signature.compareWithDefault("signature", memberValue.signature) && Signature.compareWithDefault("certs", memberValue.certs);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "OCSPRequest",
      value: [TBSRequest.schema(names.tbsRequest || { names: { blockName: TBS_REQUEST } }), new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [Signature.schema(names.optionalSignature || { names: { blockName: OPTIONAL_SIGNATURE } })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$8) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OCSPRequest2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.tbsRequest = new TBSRequest({ schema: asn1.result.tbsRequest });
    if (OPTIONAL_SIGNATURE in asn1.result) this.optionalSignature = new Signature({ schema: asn1.result.optionalSignature });
  }
  toSchema(encodeFlag = false) {
    const outputArray = [];
    outputArray.push(this.tbsRequest.toSchema(encodeFlag));
    if (this.optionalSignature) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.optionalSignature.toSchema()]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { tbsRequest: this.tbsRequest.toJSON() };
    if (this.optionalSignature) res.optionalSignature = this.optionalSignature.toJSON();
    return res;
  }
  async createForCertificate(certificate, parameters, crypto2 = getCrypto(true)) {
    const certID = new CertID();
    await certID.createForCertificate(certificate, parameters, crypto2);
    this.tbsRequest.requestList.push(new Request({ reqCert: certID }));
  }
  async sign(privateKey, hashAlgorithm = "SHA-1", crypto2 = getCrypto(true)) {
    ParameterError.assertEmpty(privateKey, "privateKey", "OCSPRequest.sign method");
    if (!this.optionalSignature) throw new Error('Need to create "optionalSignature" field before signing');
    const signatureParams = await crypto2.getSignatureParameters(privateKey, hashAlgorithm);
    const parameters = signatureParams.parameters;
    this.optionalSignature.signatureAlgorithm = signatureParams.signatureAlgorithm;
    const tbs = this.tbsRequest.toSchema(true).toBER(false);
    const signature = await crypto2.signWithPrivateKey(tbs, privateKey, parameters);
    this.optionalSignature.signature = new BitString({ valueHex: signature });
  }
  verify() {
  }
};
var RESPONSE_TYPE = "responseType";
var RESPONSE = "response";
var CLEAR_PROPS$7 = [RESPONSE_TYPE, RESPONSE];
var ResponseBytes = class ResponseBytes2 extends PkiObject {
  static {
    this.CLASS_NAME = "ResponseBytes";
  }
  constructor(parameters = {}) {
    super();
    this.responseType = parameters[RESPONSE_TYPE] ?? ResponseBytes2.defaultValues(RESPONSE_TYPE);
    this.response = parameters[RESPONSE] ?? ResponseBytes2.defaultValues(RESPONSE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case RESPONSE_TYPE:
        return "";
      case RESPONSE:
        return new OctetString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case RESPONSE_TYPE:
        return memberValue === "";
      case RESPONSE:
        return memberValue.isEqual(ResponseBytes2.defaultValues(memberName));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [new ObjectIdentifier({ name: names.responseType || "" }), new OctetString({ name: names.response || "" })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$7) delete schema[prop];
    const asn1 = compareSchema(schema, schema, ResponseBytes2.schema({ names: {
      responseType: RESPONSE_TYPE,
      response: RESPONSE
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.responseType = asn1.result.responseType.valueBlock.toString();
    this.response = asn1.result.response;
  }
  toSchema() {
    return new Sequence({ value: [new ObjectIdentifier({ value: this.responseType }), this.response] });
  }
  toJSON() {
    return {
      responseType: this.responseType,
      response: this.response.toJSON()
    };
  }
};
var RESPONSE_STATUS = "responseStatus";
var RESPONSE_BYTES = "responseBytes";
var OCSPResponse = class OCSPResponse2 extends PkiObject {
  static {
    this.CLASS_NAME = "OCSPResponse";
  }
  constructor(parameters = {}) {
    super();
    this.responseStatus = parameters[RESPONSE_STATUS] ?? OCSPResponse2.defaultValues(RESPONSE_STATUS);
    if (RESPONSE_BYTES in parameters) this.responseBytes = parameters[RESPONSE_BYTES] ?? OCSPResponse2.defaultValues(RESPONSE_BYTES);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case RESPONSE_STATUS:
        return new Enumerated();
      case RESPONSE_BYTES:
        return new ResponseBytes();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case RESPONSE_STATUS:
        return memberValue.isEqual(OCSPResponse2.defaultValues(memberName));
      case RESPONSE_BYTES:
        return ResponseBytes.compareWithDefault("responseType", memberValue.responseType) && ResponseBytes.compareWithDefault("response", memberValue.response);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "OCSPResponse",
      value: [new Enumerated({ name: names.responseStatus || RESPONSE_STATUS }), new Constructed({
        optional: true,
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: [ResponseBytes.schema(names.responseBytes || { names: { blockName: RESPONSE_BYTES } })]
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of [RESPONSE_STATUS, RESPONSE_BYTES]) delete schema[prop];
    const asn1 = compareSchema(schema, schema, OCSPResponse2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.responseStatus = asn1.result.responseStatus;
    if (RESPONSE_BYTES in asn1.result) this.responseBytes = new ResponseBytes({ schema: asn1.result.responseBytes });
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.responseStatus);
    if (this.responseBytes) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.responseBytes.toSchema()]
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { responseStatus: this.responseStatus.toJSON() };
    if (this.responseBytes) res.responseBytes = this.responseBytes.toJSON();
    return res;
  }
  async getCertificateStatus(certificate, issuerCertificate, crypto2 = getCrypto(true)) {
    let basicResponse;
    const result = {
      isForCertificate: false,
      status: 2
    };
    if (!this.responseBytes) return result;
    if (this.responseBytes.responseType !== "1.3.6.1.5.5.7.48.1.1") return result;
    try {
      const asn1Basic = fromBER(this.responseBytes.response.valueBlock.valueHexView);
      AsnError.assert(asn1Basic, "Basic OCSP response");
      basicResponse = new BasicOCSPResponse({ schema: asn1Basic.result });
    } catch {
      return result;
    }
    return basicResponse.getCertificateStatus(certificate, issuerCertificate, crypto2);
  }
  async sign(privateKey, hashAlgorithm, crypto2 = getCrypto(true)) {
    if (this.responseBytes && this.responseBytes.responseType === "1.3.6.1.5.5.7.48.1.1") return BasicOCSPResponse.fromBER(this.responseBytes.response.valueBlock.valueHexView).sign(privateKey, hashAlgorithm, crypto2);
    throw new Error(`Unknown ResponseBytes type: ${this.responseBytes?.responseType || "Unknown"}`);
  }
  async verify(issuerCertificate = null, crypto2 = getCrypto(true)) {
    if (RESPONSE_BYTES in this === false) throw new Error("Empty ResponseBytes field");
    if (this.responseBytes && this.responseBytes.responseType === "1.3.6.1.5.5.7.48.1.1") {
      const basicResponse = BasicOCSPResponse.fromBER(this.responseBytes.response.valueBlock.valueHexView);
      if (issuerCertificate !== null) {
        if (!basicResponse.certs) basicResponse.certs = [];
        basicResponse.certs.push(issuerCertificate);
      }
      return basicResponse.verify({}, crypto2);
    }
    throw new Error(`Unknown ResponseBytes type: ${this.responseBytes?.responseType || "Unknown"}`);
  }
};
var TYPE$1 = "type";
var ATTRIBUTES = "attributes";
var ENCODED_VALUE = "encodedValue";
var CLEAR_PROPS$6 = [ATTRIBUTES];
var SignedAndUnsignedAttributes = class SignedAndUnsignedAttributes2 extends PkiObject {
  static {
    this.CLASS_NAME = "SignedAndUnsignedAttributes";
  }
  constructor(parameters = {}) {
    super();
    this.type = parameters[TYPE$1] ?? SignedAndUnsignedAttributes2.defaultValues(TYPE$1);
    this.attributes = parameters[ATTRIBUTES] ?? SignedAndUnsignedAttributes2.defaultValues(ATTRIBUTES);
    this.encodedValue = parameters[ENCODED_VALUE] ?? SignedAndUnsignedAttributes2.defaultValues(ENCODED_VALUE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case TYPE$1:
        return -1;
      case ATTRIBUTES:
        return [];
      case ENCODED_VALUE:
        return EMPTY_BUFFER2;
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case TYPE$1:
        return memberValue === SignedAndUnsignedAttributes2.defaultValues(TYPE$1);
      case ATTRIBUTES:
        return memberValue.length === 0;
      case ENCODED_VALUE:
        return memberValue.byteLength === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Constructed({
      name: names.blockName || "",
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: names.tagNumber || 0
      },
      value: [new Repeated({
        name: names.attributes || "",
        value: Attribute.schema()
      })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$6) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SignedAndUnsignedAttributes2.schema({ names: {
      tagNumber: this.type,
      attributes: ATTRIBUTES
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.type = asn1.result.idBlock.tagNumber;
    this.encodedValue = toArrayBuffer(asn1.result.valueBeforeDecodeView);
    const encodedView = new Uint8Array(this.encodedValue);
    encodedView[0] = 49;
    if (ATTRIBUTES in asn1.result === false) {
      if (this.type === 0) throw new Error("Wrong structure of SignedUnsignedAttributes");
      else return;
    }
    this.attributes = Array.from(asn1.result.attributes, (element) => new Attribute({ schema: element }));
  }
  toSchema() {
    if (SignedAndUnsignedAttributes2.compareWithDefault(TYPE$1, this.type) || SignedAndUnsignedAttributes2.compareWithDefault(ATTRIBUTES, this.attributes)) throw new Error('Incorrectly initialized "SignedAndUnsignedAttributes" class');
    return new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: this.type
      },
      value: Array.from(this.attributes, (o) => o.toSchema())
    });
  }
  toJSON() {
    if (SignedAndUnsignedAttributes2.compareWithDefault(TYPE$1, this.type) || SignedAndUnsignedAttributes2.compareWithDefault(ATTRIBUTES, this.attributes)) throw new Error('Incorrectly initialized "SignedAndUnsignedAttributes" class');
    return {
      type: this.type,
      attributes: Array.from(this.attributes, (o) => o.toJSON())
    };
  }
};
var VERSION$4 = "version";
var SID = "sid";
var DIGEST_ALGORITHM = "digestAlgorithm";
var SIGNED_ATTRS = "signedAttrs";
var SIGNATURE_ALGORITHM = "signatureAlgorithm";
var SIGNATURE = "signature";
var UNSIGNED_ATTRS = "unsignedAttrs";
var SIGNER_INFO = "SignerInfo";
var SIGNER_INFO_VERSION = `${SIGNER_INFO}.${VERSION$4}`;
var SIGNER_INFO_SID = `${SIGNER_INFO}.${SID}`;
var SIGNER_INFO_DIGEST_ALGORITHM = `${SIGNER_INFO}.${DIGEST_ALGORITHM}`;
var SIGNER_INFO_SIGNED_ATTRS = `${SIGNER_INFO}.${SIGNED_ATTRS}`;
var SIGNER_INFO_SIGNATURE_ALGORITHM = `${SIGNER_INFO}.${SIGNATURE_ALGORITHM}`;
var SIGNER_INFO_SIGNATURE = `${SIGNER_INFO}.${SIGNATURE}`;
var SIGNER_INFO_UNSIGNED_ATTRS = `${SIGNER_INFO}.${UNSIGNED_ATTRS}`;
var CLEAR_PROPS$5 = [
  SIGNER_INFO_VERSION,
  SIGNER_INFO_SID,
  SIGNER_INFO_DIGEST_ALGORITHM,
  SIGNER_INFO_SIGNED_ATTRS,
  SIGNER_INFO_SIGNATURE_ALGORITHM,
  SIGNER_INFO_SIGNATURE,
  SIGNER_INFO_UNSIGNED_ATTRS
];
var SignerInfo = class SignerInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "SignerInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$4] ?? SignerInfo2.defaultValues(VERSION$4);
    this.sid = parameters[SID] ?? SignerInfo2.defaultValues(SID);
    this.digestAlgorithm = parameters[DIGEST_ALGORITHM] ?? SignerInfo2.defaultValues(DIGEST_ALGORITHM);
    if (SIGNED_ATTRS in parameters) this.signedAttrs = parameters[SIGNED_ATTRS] ?? SignerInfo2.defaultValues(SIGNED_ATTRS);
    this.signatureAlgorithm = parameters[SIGNATURE_ALGORITHM] ?? SignerInfo2.defaultValues(SIGNATURE_ALGORITHM);
    this.signature = parameters[SIGNATURE] ?? SignerInfo2.defaultValues(SIGNATURE);
    if (UNSIGNED_ATTRS in parameters) this.unsignedAttrs = parameters[UNSIGNED_ATTRS] ?? SignerInfo2.defaultValues(UNSIGNED_ATTRS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$4:
        return 0;
      case SID:
        return new Any();
      case DIGEST_ALGORITHM:
        return new AlgorithmIdentifier();
      case SIGNED_ATTRS:
        return new SignedAndUnsignedAttributes({ type: 0 });
      case SIGNATURE_ALGORITHM:
        return new AlgorithmIdentifier();
      case SIGNATURE:
        return new OctetString();
      case UNSIGNED_ATTRS:
        return new SignedAndUnsignedAttributes({ type: 1 });
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$4:
        return SignerInfo2.defaultValues(VERSION$4) === memberValue;
      case SID:
        return memberValue instanceof Any;
      case DIGEST_ALGORITHM:
        if (memberValue instanceof AlgorithmIdentifier === false) return false;
        return memberValue.isEqual(SignerInfo2.defaultValues(DIGEST_ALGORITHM));
      case SIGNED_ATTRS:
        return SignedAndUnsignedAttributes.compareWithDefault("type", memberValue.type) && SignedAndUnsignedAttributes.compareWithDefault("attributes", memberValue.attributes) && SignedAndUnsignedAttributes.compareWithDefault("encodedValue", memberValue.encodedValue);
      case SIGNATURE_ALGORITHM:
        if (memberValue instanceof AlgorithmIdentifier === false) return false;
        return memberValue.isEqual(SignerInfo2.defaultValues(SIGNATURE_ALGORITHM));
      case SIGNATURE:
      case UNSIGNED_ATTRS:
        return SignedAndUnsignedAttributes.compareWithDefault("type", memberValue.type) && SignedAndUnsignedAttributes.compareWithDefault("attributes", memberValue.attributes) && SignedAndUnsignedAttributes.compareWithDefault("encodedValue", memberValue.encodedValue);
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: SIGNER_INFO,
      value: [
        new Integer({ name: names.version || SIGNER_INFO_VERSION }),
        new Choice({ value: [IssuerAndSerialNumber.schema(names.sidSchema || { names: { blockName: SIGNER_INFO_SID } }), new Choice({ value: [new Constructed({
          optional: true,
          name: names.sid || SIGNER_INFO_SID,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new OctetString()]
        }), new Primitive({
          optional: true,
          name: names.sid || SIGNER_INFO_SID,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          }
        })] })] }),
        AlgorithmIdentifier.schema(names.digestAlgorithm || { names: { blockName: SIGNER_INFO_DIGEST_ALGORITHM } }),
        SignedAndUnsignedAttributes.schema(names.signedAttrs || { names: {
          blockName: SIGNER_INFO_SIGNED_ATTRS,
          tagNumber: 0
        } }),
        AlgorithmIdentifier.schema(names.signatureAlgorithm || { names: { blockName: SIGNER_INFO_SIGNATURE_ALGORITHM } }),
        new OctetString({ name: names.signature || SIGNER_INFO_SIGNATURE }),
        SignedAndUnsignedAttributes.schema(names.unsignedAttrs || { names: {
          blockName: SIGNER_INFO_UNSIGNED_ATTRS,
          tagNumber: 1
        } })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$5) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SignerInfo2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result[SIGNER_INFO_VERSION].valueBlock.valueDec;
    const currentSid = asn1.result[SIGNER_INFO_SID];
    if (currentSid.idBlock.tagClass === 1) this.sid = new IssuerAndSerialNumber({ schema: currentSid });
    else this.sid = currentSid;
    this.digestAlgorithm = new AlgorithmIdentifier({ schema: asn1.result[SIGNER_INFO_DIGEST_ALGORITHM] });
    if (SIGNER_INFO_SIGNED_ATTRS in asn1.result) this.signedAttrs = new SignedAndUnsignedAttributes({
      type: 0,
      schema: asn1.result[SIGNER_INFO_SIGNED_ATTRS]
    });
    this.signatureAlgorithm = new AlgorithmIdentifier({ schema: asn1.result[SIGNER_INFO_SIGNATURE_ALGORITHM] });
    this.signature = asn1.result[SIGNER_INFO_SIGNATURE];
    if (SIGNER_INFO_UNSIGNED_ATTRS in asn1.result) this.unsignedAttrs = new SignedAndUnsignedAttributes({
      type: 1,
      schema: asn1.result[SIGNER_INFO_UNSIGNED_ATTRS]
    });
  }
  toSchema() {
    if (SignerInfo2.compareWithDefault(SID, this.sid)) throw new Error('Incorrectly initialized "SignerInfo" class');
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    if (this.sid instanceof IssuerAndSerialNumber) outputArray.push(this.sid.toSchema());
    else outputArray.push(this.sid);
    outputArray.push(this.digestAlgorithm.toSchema());
    if (this.signedAttrs) {
      if (SignerInfo2.compareWithDefault(SIGNED_ATTRS, this.signedAttrs) === false) outputArray.push(this.signedAttrs.toSchema());
    }
    outputArray.push(this.signatureAlgorithm.toSchema());
    outputArray.push(this.signature);
    if (this.unsignedAttrs) {
      if (SignerInfo2.compareWithDefault(UNSIGNED_ATTRS, this.unsignedAttrs) === false) outputArray.push(this.unsignedAttrs.toSchema());
    }
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    if (SignerInfo2.compareWithDefault(SID, this.sid)) throw new Error('Incorrectly initialized "SignerInfo" class');
    const res = {
      version: this.version,
      digestAlgorithm: this.digestAlgorithm.toJSON(),
      signatureAlgorithm: this.signatureAlgorithm.toJSON(),
      signature: this.signature.toJSON()
    };
    if (!(this.sid instanceof Any)) res.sid = this.sid.toJSON();
    if (this.signedAttrs && SignerInfo2.compareWithDefault(SIGNED_ATTRS, this.signedAttrs) === false) res.signedAttrs = this.signedAttrs.toJSON();
    if (this.unsignedAttrs && SignerInfo2.compareWithDefault(UNSIGNED_ATTRS, this.unsignedAttrs) === false) res.unsignedAttrs = this.unsignedAttrs.toJSON();
    return res;
  }
};
var VERSION$3 = "version";
var POLICY = "policy";
var MESSAGE_IMPRINT$1 = "messageImprint";
var SERIAL_NUMBER = "serialNumber";
var GEN_TIME = "genTime";
var ORDERING = "ordering";
var NONCE$1 = "nonce";
var ACCURACY = "accuracy";
var TSA = "tsa";
var EXTENSIONS$1 = "extensions";
var TST_INFO = "TSTInfo";
var TST_INFO_VERSION = `${TST_INFO}.${VERSION$3}`;
var TST_INFO_POLICY = `${TST_INFO}.${POLICY}`;
var TST_INFO_MESSAGE_IMPRINT = `${TST_INFO}.${MESSAGE_IMPRINT$1}`;
var TST_INFO_SERIAL_NUMBER = `${TST_INFO}.${SERIAL_NUMBER}`;
var TST_INFO_GEN_TIME = `${TST_INFO}.${GEN_TIME}`;
var TST_INFO_ACCURACY = `${TST_INFO}.${ACCURACY}`;
var TST_INFO_ORDERING = `${TST_INFO}.${ORDERING}`;
var TST_INFO_NONCE = `${TST_INFO}.${NONCE$1}`;
var TST_INFO_TSA = `${TST_INFO}.${TSA}`;
var TST_INFO_EXTENSIONS = `${TST_INFO}.${EXTENSIONS$1}`;
var CLEAR_PROPS$4 = [
  TST_INFO_VERSION,
  TST_INFO_POLICY,
  TST_INFO_MESSAGE_IMPRINT,
  TST_INFO_SERIAL_NUMBER,
  TST_INFO_GEN_TIME,
  TST_INFO_ACCURACY,
  TST_INFO_ORDERING,
  TST_INFO_NONCE,
  TST_INFO_TSA,
  TST_INFO_EXTENSIONS
];
var TSTInfo = class TSTInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "TSTInfo";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$3] ?? TSTInfo2.defaultValues(VERSION$3);
    this.policy = parameters[POLICY] ?? TSTInfo2.defaultValues(POLICY);
    this.messageImprint = parameters[MESSAGE_IMPRINT$1] ?? TSTInfo2.defaultValues(MESSAGE_IMPRINT$1);
    this.serialNumber = parameters[SERIAL_NUMBER] ?? TSTInfo2.defaultValues(SERIAL_NUMBER);
    this.genTime = parameters[GEN_TIME] ?? TSTInfo2.defaultValues(GEN_TIME);
    if (ACCURACY in parameters) this.accuracy = parameters[ACCURACY] ?? TSTInfo2.defaultValues(ACCURACY);
    if (ORDERING in parameters) this.ordering = parameters[ORDERING] ?? TSTInfo2.defaultValues(ORDERING);
    if (NONCE$1 in parameters) this.nonce = parameters[NONCE$1] ?? TSTInfo2.defaultValues(NONCE$1);
    if (TSA in parameters) this.tsa = parameters[TSA] ?? TSTInfo2.defaultValues(TSA);
    if (EXTENSIONS$1 in parameters) this.extensions = parameters[EXTENSIONS$1] ?? TSTInfo2.defaultValues(EXTENSIONS$1);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$3:
        return 0;
      case POLICY:
        return "";
      case MESSAGE_IMPRINT$1:
        return new MessageImprint();
      case SERIAL_NUMBER:
        return new Integer();
      case GEN_TIME:
        return new Date(0, 0, 0);
      case ACCURACY:
        return new Accuracy();
      case ORDERING:
        return false;
      case NONCE$1:
        return new Integer();
      case TSA:
        return new GeneralName();
      case EXTENSIONS$1:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$3:
      case POLICY:
      case GEN_TIME:
      case ORDERING:
        return memberValue === TSTInfo2.defaultValues(ORDERING);
      case MESSAGE_IMPRINT$1:
        return MessageImprint.compareWithDefault("hashAlgorithm", memberValue.hashAlgorithm) && MessageImprint.compareWithDefault("hashedMessage", memberValue.hashedMessage);
      case SERIAL_NUMBER:
      case NONCE$1:
        return memberValue.isEqual(TSTInfo2.defaultValues(NONCE$1));
      case ACCURACY:
        return Accuracy.compareWithDefault("seconds", memberValue.seconds) && Accuracy.compareWithDefault("millis", memberValue.millis) && Accuracy.compareWithDefault("micros", memberValue.micros);
      case TSA:
        return GeneralName.compareWithDefault("type", memberValue.type) && GeneralName.compareWithDefault("value", memberValue.value);
      case EXTENSIONS$1:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || TST_INFO,
      value: [
        new Integer({ name: names.version || TST_INFO_VERSION }),
        new ObjectIdentifier({ name: names.policy || TST_INFO_POLICY }),
        MessageImprint.schema(names.messageImprint || { names: { blockName: TST_INFO_MESSAGE_IMPRINT } }),
        new Integer({ name: names.serialNumber || TST_INFO_SERIAL_NUMBER }),
        new GeneralizedTime({ name: names.genTime || TST_INFO_GEN_TIME }),
        Accuracy.schema(names.accuracy || { names: { blockName: TST_INFO_ACCURACY } }),
        new Boolean2({
          name: names.ordering || TST_INFO_ORDERING,
          optional: true
        }),
        new Integer({
          name: names.nonce || TST_INFO_NONCE,
          optional: true
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [GeneralName.schema(names.tsa || { names: { blockName: TST_INFO_TSA } })]
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: [new Repeated({
            name: names.extensions || TST_INFO_EXTENSIONS,
            value: Extension.schema(names.extension || {})
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$4) delete schema[prop];
    const asn1 = compareSchema(schema, schema, TSTInfo2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result[TST_INFO_VERSION].valueBlock.valueDec;
    this.policy = asn1.result[TST_INFO_POLICY].valueBlock.toString();
    this.messageImprint = new MessageImprint({ schema: asn1.result[TST_INFO_MESSAGE_IMPRINT] });
    this.serialNumber = asn1.result[TST_INFO_SERIAL_NUMBER];
    this.genTime = asn1.result[TST_INFO_GEN_TIME].toDate();
    if (TST_INFO_ACCURACY in asn1.result) this.accuracy = new Accuracy({ schema: asn1.result[TST_INFO_ACCURACY] });
    if (TST_INFO_ORDERING in asn1.result) this.ordering = asn1.result[TST_INFO_ORDERING].valueBlock.value;
    if (TST_INFO_NONCE in asn1.result) this.nonce = asn1.result[TST_INFO_NONCE];
    if (TST_INFO_TSA in asn1.result) this.tsa = new GeneralName({ schema: asn1.result[TST_INFO_TSA] });
    if (TST_INFO_EXTENSIONS in asn1.result) this.extensions = Array.from(asn1.result[TST_INFO_EXTENSIONS], (element) => new Extension({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    outputArray.push(new ObjectIdentifier({ value: this.policy }));
    outputArray.push(this.messageImprint.toSchema());
    outputArray.push(this.serialNumber);
    outputArray.push(new GeneralizedTime({ valueDate: this.genTime }));
    if (this.accuracy) outputArray.push(this.accuracy.toSchema());
    if (this.ordering !== void 0) outputArray.push(new Boolean2({ value: this.ordering }));
    if (this.nonce) outputArray.push(this.nonce);
    if (this.tsa) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: [this.tsa.toSchema()]
    }));
    if (this.extensions) outputArray.push(new Constructed({
      optional: true,
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: Array.from(this.extensions, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      policy: this.policy,
      messageImprint: this.messageImprint.toJSON(),
      serialNumber: this.serialNumber.toJSON(),
      genTime: this.genTime
    };
    if (this.accuracy) res.accuracy = this.accuracy.toJSON();
    if (this.ordering !== void 0) res.ordering = this.ordering;
    if (this.nonce) res.nonce = this.nonce.toJSON();
    if (this.tsa) res.tsa = this.tsa.toJSON();
    if (this.extensions) res.extensions = Array.from(this.extensions, (o) => o.toJSON());
    return res;
  }
  async verify(params, crypto2 = getCrypto(true)) {
    if (!params.data) throw new Error('"data" is a mandatory attribute for TST_INFO verification');
    const data = params.data;
    if (params.notBefore) {
      if (this.genTime < params.notBefore) throw new Error("Generation time for TSTInfo object is less than notBefore value");
    }
    if (params.notAfter) {
      if (this.genTime > params.notAfter) throw new Error("Generation time for TSTInfo object is more than notAfter value");
    }
    const shaAlgorithm = crypto2.getAlgorithmByOID(this.messageImprint.hashAlgorithm.algorithmId, true, "MessageImprint.hashAlgorithm");
    const hash = await crypto2.digest(shaAlgorithm.name, new Uint8Array(data));
    return bytes_exports.equal(hash, this.messageImprint.hashedMessage.valueBlock.valueHexView);
  }
};
var VERSION$2 = "version";
var DIGEST_ALGORITHMS = "digestAlgorithms";
var ENCAP_CONTENT_INFO = "encapContentInfo";
var CERTIFICATES = "certificates";
var CRLS = "crls";
var SIGNER_INFOS = "signerInfos";
var OCSPS = "ocsps";
var SIGNED_DATA = "SignedData";
var SIGNED_DATA_VERSION = `${SIGNED_DATA}.${VERSION$2}`;
var SIGNED_DATA_DIGEST_ALGORITHMS = `${SIGNED_DATA}.${DIGEST_ALGORITHMS}`;
var SIGNED_DATA_ENCAP_CONTENT_INFO = `${SIGNED_DATA}.${ENCAP_CONTENT_INFO}`;
var SIGNED_DATA_CERTIFICATES = `${SIGNED_DATA}.${CERTIFICATES}`;
var SIGNED_DATA_CRLS = `${SIGNED_DATA}.${CRLS}`;
var SIGNED_DATA_SIGNER_INFOS = `${SIGNED_DATA}.${SIGNER_INFOS}`;
var CLEAR_PROPS$3 = [
  SIGNED_DATA_VERSION,
  SIGNED_DATA_DIGEST_ALGORITHMS,
  SIGNED_DATA_ENCAP_CONTENT_INFO,
  SIGNED_DATA_CERTIFICATES,
  SIGNED_DATA_CRLS,
  SIGNED_DATA_SIGNER_INFOS
];
var SignedDataVerifyError = class extends Error {
  constructor({ message, code = 0, date = /* @__PURE__ */ new Date(), signatureVerified = null, signerCertificate = null, signerCertificateVerified = null, timestampSerial = null, certificatePath = [] }) {
    super(message);
    this.name = "SignedDataVerifyError";
    this.date = date;
    this.code = code;
    this.timestampSerial = timestampSerial;
    this.signatureVerified = signatureVerified;
    this.signerCertificate = signerCertificate;
    this.signerCertificateVerified = signerCertificateVerified;
    this.certificatePath = certificatePath;
  }
};
var SignedData = class SignedData2 extends PkiObject {
  static {
    this.CLASS_NAME = "SignedData";
  }
  static {
    this.ID_DATA = id_ContentType_Data;
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$2] ?? SignedData2.defaultValues(VERSION$2);
    this.digestAlgorithms = parameters[DIGEST_ALGORITHMS] ?? SignedData2.defaultValues(DIGEST_ALGORITHMS);
    this.encapContentInfo = parameters[ENCAP_CONTENT_INFO] ?? SignedData2.defaultValues(ENCAP_CONTENT_INFO);
    if (CERTIFICATES in parameters) this.certificates = parameters[CERTIFICATES] ?? SignedData2.defaultValues(CERTIFICATES);
    if (CRLS in parameters) this.crls = parameters[CRLS] ?? SignedData2.defaultValues(CRLS);
    if (OCSPS in parameters) this.ocsps = parameters[OCSPS] ?? SignedData2.defaultValues(OCSPS);
    this.signerInfos = parameters[SIGNER_INFOS] ?? SignedData2.defaultValues(SIGNER_INFOS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$2:
        return 0;
      case DIGEST_ALGORITHMS:
        return [];
      case ENCAP_CONTENT_INFO:
        return new EncapsulatedContentInfo();
      case CERTIFICATES:
        return [];
      case CRLS:
        return [];
      case OCSPS:
        return [];
      case SIGNER_INFOS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$2:
        return memberValue === SignedData2.defaultValues(VERSION$2);
      case ENCAP_CONTENT_INFO:
        return EncapsulatedContentInfo.compareWithDefault("eContentType", memberValue.eContentType) && EncapsulatedContentInfo.compareWithDefault("eContent", memberValue.eContent);
      case DIGEST_ALGORITHMS:
      case CERTIFICATES:
      case CRLS:
      case OCSPS:
      case SIGNER_INFOS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    if (names.optional === void 0) names.optional = false;
    return new Sequence({
      name: names.blockName || SIGNED_DATA,
      optional: names.optional,
      value: [
        new Integer({ name: names.version || SIGNED_DATA_VERSION }),
        new Set2({ value: [new Repeated({
          name: names.digestAlgorithms || SIGNED_DATA_DIGEST_ALGORITHMS,
          value: AlgorithmIdentifier.schema()
        })] }),
        EncapsulatedContentInfo.schema(names.encapContentInfo || { names: { blockName: SIGNED_DATA_ENCAP_CONTENT_INFO } }),
        new Constructed({
          name: names.certificates || SIGNED_DATA_CERTIFICATES,
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: CertificateSet.schema().valueBlock.value
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 1
          },
          value: RevocationInfoChoices.schema(names.crls || { names: { crls: SIGNED_DATA_CRLS } }).valueBlock.value
        }),
        new Set2({ value: [new Repeated({
          name: names.signerInfos || SIGNED_DATA_SIGNER_INFOS,
          value: SignerInfo.schema()
        })] })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$3) delete schema[prop];
    const asn1 = compareSchema(schema, schema, SignedData2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result[SIGNED_DATA_VERSION].valueBlock.valueDec;
    if (SIGNED_DATA_DIGEST_ALGORITHMS in asn1.result) this.digestAlgorithms = Array.from(asn1.result[SIGNED_DATA_DIGEST_ALGORITHMS], (algorithm) => new AlgorithmIdentifier({ schema: algorithm }));
    this.encapContentInfo = new EncapsulatedContentInfo({ schema: asn1.result[SIGNED_DATA_ENCAP_CONTENT_INFO] });
    if (SIGNED_DATA_CERTIFICATES in asn1.result) {
      const certificateSet = new CertificateSet({ schema: new Set2({ value: asn1.result[SIGNED_DATA_CERTIFICATES].valueBlock.value }) });
      this.certificates = certificateSet.certificates.slice(0);
    }
    if (SIGNED_DATA_CRLS in asn1.result) this.crls = Array.from(asn1.result[SIGNED_DATA_CRLS], (crl) => {
      if (crl.idBlock.tagClass === 1) return new CertificateRevocationList({ schema: crl });
      crl.idBlock.tagClass = 1;
      crl.idBlock.tagNumber = 16;
      return new OtherRevocationInfoFormat({ schema: crl });
    });
    if (SIGNED_DATA_SIGNER_INFOS in asn1.result) this.signerInfos = Array.from(asn1.result[SIGNED_DATA_SIGNER_INFOS], (signerInfoSchema) => new SignerInfo({ schema: signerInfoSchema }));
  }
  toSchema(encodeFlag = false) {
    const outputArray = [];
    if (this.certificates && this.certificates.length && this.certificates.some((o) => o instanceof OtherCertificateFormat) || this.crls && this.crls.length && this.crls.some((o) => o instanceof OtherRevocationInfoFormat)) this.version = 5;
    else if (this.certificates && this.certificates.length && this.certificates.some((o) => o instanceof AttributeCertificateV2)) this.version = 4;
    else if (this.certificates && this.certificates.length && this.certificates.some((o) => o instanceof AttributeCertificateV1) || this.signerInfos.some((o) => o.version === 3) || this.encapContentInfo.eContentType !== SignedData2.ID_DATA) this.version = 3;
    else this.version = 1;
    outputArray.push(new Integer({ value: this.version }));
    outputArray.push(new Set2({ value: Array.from(this.digestAlgorithms, (algorithm) => algorithm.toSchema()) }));
    outputArray.push(this.encapContentInfo.toSchema());
    if (this.certificates) {
      const certificateSetSchema = new CertificateSet({ certificates: this.certificates }).toSchema();
      outputArray.push(new Constructed({
        idBlock: {
          tagClass: 3,
          tagNumber: 0
        },
        value: certificateSetSchema.valueBlock.value
      }));
    }
    if (this.crls) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 1
      },
      value: Array.from(this.crls, (crl) => {
        if (crl instanceof OtherRevocationInfoFormat) {
          const crlSchema = crl.toSchema();
          crlSchema.idBlock.tagClass = 3;
          crlSchema.idBlock.tagNumber = 1;
          return crlSchema;
        }
        return crl.toSchema(encodeFlag);
      })
    }));
    outputArray.push(new Set2({ value: Array.from(this.signerInfos, (signerInfo) => signerInfo.toSchema()) }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      digestAlgorithms: Array.from(this.digestAlgorithms, (algorithm) => algorithm.toJSON()),
      encapContentInfo: this.encapContentInfo.toJSON(),
      signerInfos: Array.from(this.signerInfos, (signerInfo) => signerInfo.toJSON())
    };
    if (this.certificates) res.certificates = Array.from(this.certificates, (certificate) => certificate.toJSON());
    if (this.crls) res.crls = Array.from(this.crls, (crl) => crl.toJSON());
    return res;
  }
  async verify({ signer = -1, data = EMPTY_BUFFER2, trustedCerts = [], checkDate = /* @__PURE__ */ new Date(), checkChain = false, passedWhenNotRevValues = false, extendedMode = false, findOrigin = null, findIssuer = null } = {}, crypto2 = getCrypto(true)) {
    let signerCert = null;
    let timestampSerial = null;
    try {
      let messageDigestValue = EMPTY_BUFFER2;
      let shaAlgorithm = "";
      let certificatePath = [];
      const signerInfo = this.signerInfos[signer];
      if (!signerInfo) throw new SignedDataVerifyError({
        date: checkDate,
        code: 1,
        message: "Unable to get signer by supplied index"
      });
      if (!this.certificates) throw new SignedDataVerifyError({
        date: checkDate,
        code: 2,
        message: "No certificates attached to this signed data"
      });
      if (signerInfo.sid instanceof IssuerAndSerialNumber) for (const certificate of this.certificates) {
        if (!(certificate instanceof Certificate)) continue;
        if (certificate.issuer.isEqual(signerInfo.sid.issuer) && certificate.serialNumber.isEqual(signerInfo.sid.serialNumber)) {
          signerCert = certificate;
          break;
        }
      }
      else {
        const sid = signerInfo.sid;
        const keyId = sid.idBlock.isConstructed ? sid.valueBlock.value[0].valueBlock.valueHex : sid.valueBlock.valueHex;
        for (const certificate of this.certificates) {
          if (!(certificate instanceof Certificate)) continue;
          const digest = await crypto2.digest({ name: "sha-1" }, certificate.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView);
          if (bytes_exports.equal(digest, keyId)) {
            signerCert = certificate;
            break;
          }
        }
      }
      if (!signerCert) throw new SignedDataVerifyError({
        date: checkDate,
        code: 3,
        message: "Unable to find signer certificate"
      });
      if (this.encapContentInfo.eContentType === "1.2.840.113549.1.9.16.1.4") {
        if (!this.encapContentInfo.eContent) throw new SignedDataVerifyError({
          date: checkDate,
          code: 15,
          message: "Error during verification: TSTInfo eContent is empty",
          signatureVerified: null,
          signerCertificate: signerCert,
          timestampSerial,
          signerCertificateVerified: true
        });
        let tstInfo;
        try {
          tstInfo = TSTInfo.fromBER(this.encapContentInfo.eContent.getValue());
        } catch {
          throw new SignedDataVerifyError({
            date: checkDate,
            code: 15,
            message: "Error during verification: TSTInfo wrong ASN.1 schema ",
            signatureVerified: null,
            signerCertificate: signerCert,
            timestampSerial,
            signerCertificateVerified: true
          });
        }
        checkDate = tstInfo.genTime;
        timestampSerial = tstInfo.serialNumber.valueBlock.valueHexView.slice().buffer;
        if (data.byteLength === 0) throw new SignedDataVerifyError({
          date: checkDate,
          code: 4,
          message: "Missed detached data input array"
        });
        if (!await tstInfo.verify({ data }, crypto2)) throw new SignedDataVerifyError({
          date: checkDate,
          code: 15,
          message: "Error during verification: TSTInfo verification is failed",
          signatureVerified: false,
          signerCertificate: signerCert,
          timestampSerial,
          signerCertificateVerified: true
        });
      }
      if (checkChain) {
        const certs = this.certificates.filter((certificate) => certificate instanceof Certificate && !!checkCA(certificate, signerCert));
        const chainParams = {
          checkDate,
          certs,
          trustedCerts
        };
        if (findIssuer) chainParams.findIssuer = findIssuer;
        if (findOrigin) chainParams.findOrigin = findOrigin;
        const chainEngine = new CertificateChainValidationEngine(chainParams);
        chainEngine.certs.push(signerCert);
        if (this.crls) {
          for (const crl of this.crls) if ("thisUpdate" in crl) chainEngine.crls.push(crl);
          else if (crl.otherRevInfoFormat === "1.3.6.1.5.5.7.48.1.1") chainEngine.ocsps.push(new BasicOCSPResponse({ schema: crl.otherRevInfo }));
        }
        if (this.ocsps) chainEngine.ocsps.push(...this.ocsps);
        const verificationResult = await chainEngine.verify({ passedWhenNotRevValues }, crypto2).catch((e) => {
          throw new SignedDataVerifyError({
            date: checkDate,
            code: 5,
            message: `Validation of signer's certificate failed with error: ${e instanceof Object ? e.resultMessage : e}`,
            signerCertificate: signerCert,
            signerCertificateVerified: false
          });
        });
        if (verificationResult.certificatePath) certificatePath = verificationResult.certificatePath;
        if (!verificationResult.result) throw new SignedDataVerifyError({
          date: checkDate,
          code: 5,
          message: `Validation of signer's certificate failed: ${verificationResult.resultMessage}`,
          signerCertificate: signerCert,
          signerCertificateVerified: false
        });
      }
      const signerInfoHashAlgorithm = crypto2.getAlgorithmByOID(signerInfo.digestAlgorithm.algorithmId);
      if (!("name" in signerInfoHashAlgorithm)) throw new SignedDataVerifyError({
        date: checkDate,
        code: 7,
        message: `Unsupported signature algorithm: ${signerInfo.digestAlgorithm.algorithmId}`,
        signerCertificate: signerCert,
        signerCertificateVerified: true
      });
      shaAlgorithm = signerInfoHashAlgorithm.name;
      const eContent = this.encapContentInfo.eContent;
      if (eContent) {
        if (eContent.idBlock.tagClass === 1 && eContent.idBlock.tagNumber === 4) data = eContent.getValue();
        else data = eContent.valueBlock.valueBeforeDecodeView.slice().buffer;
      } else if (data.byteLength === 0) throw new SignedDataVerifyError({
        date: checkDate,
        code: 8,
        message: "Missed detached data input array",
        signerCertificate: signerCert,
        signerCertificateVerified: true
      });
      if (signerInfo.signedAttrs) {
        let foundContentType = false;
        let foundMessageDigest = false;
        for (const attribute of signerInfo.signedAttrs.attributes) {
          if (attribute.type === "1.2.840.113549.1.9.3") foundContentType = true;
          if (attribute.type === "1.2.840.113549.1.9.4") {
            foundMessageDigest = true;
            messageDigestValue = attribute.values[0].valueBlock.valueHex;
          }
          if (foundContentType && foundMessageDigest) break;
        }
        if (foundContentType === false) throw new SignedDataVerifyError({
          date: checkDate,
          code: 9,
          message: 'Attribute "content-type" is a mandatory attribute for "signed attributes"',
          signerCertificate: signerCert,
          signerCertificateVerified: true
        });
        if (foundMessageDigest === false) throw new SignedDataVerifyError({
          date: checkDate,
          code: 10,
          message: 'Attribute "message-digest" is a mandatory attribute for "signed attributes"',
          signatureVerified: null,
          signerCertificate: signerCert,
          signerCertificateVerified: true
        });
      }
      if (signerInfo.signedAttrs) {
        const messageDigest = await crypto2.digest(shaAlgorithm, new Uint8Array(data));
        if (!bytes_exports.equal(messageDigest, messageDigestValue)) throw new SignedDataVerifyError({
          date: checkDate,
          code: 15,
          message: "Error during verification: Message digest doesn't match",
          signatureVerified: null,
          signerCertificate: signerCert,
          timestampSerial,
          signerCertificateVerified: true
        });
        data = signerInfo.signedAttrs.encodedValue;
      }
      const verifyResult = signerInfo.signatureAlgorithm.algorithmId === "1.2.840.113549.1.1.1" ? await crypto2.verifyWithPublicKey(data, signerInfo.signature, signerCert.subjectPublicKeyInfo, signerInfo.signatureAlgorithm, shaAlgorithm) : await crypto2.verifyWithPublicKey(data, signerInfo.signature, signerCert.subjectPublicKeyInfo, signerInfo.signatureAlgorithm);
      if (extendedMode) return {
        date: checkDate,
        code: 14,
        message: "",
        signatureVerified: verifyResult,
        signerCertificate: signerCert,
        timestampSerial,
        signerCertificateVerified: true,
        certificatePath
      };
      else return verifyResult;
    } catch (e) {
      if (e instanceof SignedDataVerifyError) throw e;
      throw new SignedDataVerifyError({
        date: checkDate,
        code: 15,
        message: `Error during verification: ${e instanceof Error ? e.message : e}`,
        signatureVerified: null,
        signerCertificate: signerCert,
        timestampSerial,
        signerCertificateVerified: true
      });
    }
  }
  async sign(privateKey, signerIndex, hashAlgorithm = "SHA-1", data = EMPTY_BUFFER2, crypto2 = getCrypto(true)) {
    if (!privateKey) throw new Error("Need to provide a private key for signing");
    const signerInfo = this.signerInfos[signerIndex];
    if (!signerInfo) throw new RangeError("SignerInfo index is out of range");
    if (!signerInfo.signedAttrs?.attributes.length && "hash" in privateKey.algorithm && "hash" in privateKey.algorithm && privateKey.algorithm.hash) hashAlgorithm = privateKey.algorithm.hash.name;
    const hashAlgorithmOID = crypto2.getOIDByAlgorithm({ name: hashAlgorithm }, true, "hashAlgorithm");
    if (this.digestAlgorithms.filter((algorithm) => algorithm.algorithmId === hashAlgorithmOID).length === 0) this.digestAlgorithms.push(new AlgorithmIdentifier({
      algorithmId: hashAlgorithmOID,
      algorithmParams: new Null()
    }));
    signerInfo.digestAlgorithm = new AlgorithmIdentifier({
      algorithmId: hashAlgorithmOID,
      algorithmParams: new Null()
    });
    const signatureParams = await crypto2.getSignatureParameters(privateKey, hashAlgorithm);
    const parameters = signatureParams.parameters;
    signerInfo.signatureAlgorithm = signatureParams.signatureAlgorithm;
    if (signerInfo.signedAttrs) {
      if (signerInfo.signedAttrs.encodedValue.byteLength !== 0) data = signerInfo.signedAttrs.encodedValue;
      else {
        data = signerInfo.signedAttrs.toSchema().toBER();
        const view = toUint8Array(data);
        view[0] = 49;
      }
    } else {
      const eContent = this.encapContentInfo.eContent;
      if (eContent) {
        if (eContent.idBlock.tagClass === 1 && eContent.idBlock.tagNumber === 4) data = eContent.getValue();
        else data = eContent.valueBlock.valueBeforeDecodeView.slice().buffer;
      } else if (data.byteLength === 0) throw new Error("Missed detached data input array");
    }
    const signature = await crypto2.signWithPrivateKey(data, privateKey, parameters);
    signerInfo.signature = new OctetString({ valueHex: signature });
  }
};
var VERSION$1 = "version";
var AUTH_SAFE = "authSafe";
var MAC_DATA = "macData";
var PARSED_VALUE = "parsedValue";
var CLERA_PROPS = [
  VERSION$1,
  AUTH_SAFE,
  MAC_DATA
];
var PFX = class PFX2 extends PkiObject {
  static {
    this.CLASS_NAME = "PFX";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION$1] ?? PFX2.defaultValues(VERSION$1);
    this.authSafe = parameters[AUTH_SAFE] ?? PFX2.defaultValues(AUTH_SAFE);
    if (MAC_DATA in parameters) this.macData = parameters[MAC_DATA] ?? PFX2.defaultValues(MAC_DATA);
    if (PARSED_VALUE in parameters) this.parsedValue = parameters[PARSED_VALUE] ?? PFX2.defaultValues(PARSED_VALUE);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION$1:
        return 3;
      case AUTH_SAFE:
        return new ContentInfo();
      case MAC_DATA:
        return new MacData();
      case PARSED_VALUE:
        return {};
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION$1:
        return memberValue === PFX2.defaultValues(memberName);
      case AUTH_SAFE:
        return ContentInfo.compareWithDefault("contentType", memberValue.contentType) && ContentInfo.compareWithDefault("content", memberValue.content);
      case MAC_DATA:
        return MacData.compareWithDefault("mac", memberValue.mac) && MacData.compareWithDefault("macSalt", memberValue.macSalt) && MacData.compareWithDefault("iterations", memberValue.iterations);
      case PARSED_VALUE:
        return memberValue instanceof Object && Object.keys(memberValue).length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.version || VERSION$1 }),
        ContentInfo.schema(names.authSafe || { names: { blockName: AUTH_SAFE } }),
        MacData.schema(names.macData || { names: {
          blockName: MAC_DATA,
          optional: true
        } })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLERA_PROPS) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PFX2.schema({ names: {
      version: VERSION$1,
      authSafe: { names: { blockName: AUTH_SAFE } },
      macData: { names: { blockName: MAC_DATA } }
    } }));
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result.version.valueBlock.valueDec;
    this.authSafe = new ContentInfo({ schema: asn1.result.authSafe });
    if (MAC_DATA in asn1.result) this.macData = new MacData({ schema: asn1.result.macData });
  }
  toSchema() {
    const outputArray = [new Integer({ value: this.version }), this.authSafe.toSchema()];
    if (this.macData) outputArray.push(this.macData.toSchema());
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const output = {
      version: this.version,
      authSafe: this.authSafe.toJSON()
    };
    if (this.macData) output.macData = this.macData.toJSON();
    return output;
  }
  async makeInternalValues(parameters = {}, crypto2 = getCrypto(true)) {
    ArgumentError.assert(parameters, "parameters", "object");
    if (!this.parsedValue) throw new Error('Please call "parseValues" function first in order to make "parsedValue" data');
    ParameterError.assertEmpty(this.parsedValue.integrityMode, "integrityMode", "parsedValue");
    ParameterError.assertEmpty(this.parsedValue.authenticatedSafe, "authenticatedSafe", "parsedValue");
    switch (this.parsedValue.integrityMode) {
      case 0:
        {
          if (!("iterations" in parameters)) throw new ParameterError("iterations");
          ParameterError.assertEmpty(parameters.pbkdf2HashAlgorithm, "pbkdf2HashAlgorithm");
          ParameterError.assertEmpty(parameters.hmacHashAlgorithm, "hmacHashAlgorithm");
          ParameterError.assertEmpty(parameters.password, "password");
          const saltBuffer = /* @__PURE__ */ new ArrayBuffer(64);
          const saltView = new Uint8Array(saltBuffer);
          crypto2.getRandomValues(saltView);
          const data = this.parsedValue.authenticatedSafe.toSchema().toBER(false);
          this.authSafe = new ContentInfo({
            contentType: ContentInfo.DATA,
            content: new OctetString({ valueHex: data })
          });
          const result = await crypto2.stampDataWithPassword({
            password: parameters.password,
            hashAlgorithm: parameters.hmacHashAlgorithm,
            salt: saltBuffer,
            iterationCount: parameters.iterations,
            contentToStamp: data
          });
          this.macData = new MacData({
            mac: new DigestInfo({
              digestAlgorithm: new AlgorithmIdentifier({ algorithmId: crypto2.getOIDByAlgorithm({ name: parameters.hmacHashAlgorithm }, true, "hmacHashAlgorithm") }),
              digest: new OctetString({ valueHex: result })
            }),
            macSalt: new OctetString({ valueHex: saltBuffer }),
            iterations: parameters.iterations
          });
        }
        break;
      case 1:
        {
          if (!("signingCertificate" in parameters)) throw new ParameterError("signingCertificate");
          ParameterError.assertEmpty(parameters.privateKey, "privateKey");
          ParameterError.assertEmpty(parameters.hashAlgorithm, "hashAlgorithm");
          const toBeSigned = this.parsedValue.authenticatedSafe.toSchema().toBER(false);
          const cmsSigned = new SignedData({
            version: 1,
            encapContentInfo: new EncapsulatedContentInfo({
              eContentType: "1.2.840.113549.1.7.1",
              eContent: new OctetString({ valueHex: toBeSigned })
            }),
            certificates: [parameters.signingCertificate]
          });
          const result = await crypto2.digest({ name: parameters.hashAlgorithm }, new Uint8Array(toBeSigned));
          const signedAttr = [];
          signedAttr.push(new Attribute({
            type: "1.2.840.113549.1.9.3",
            values: [new ObjectIdentifier({ value: "1.2.840.113549.1.7.1" })]
          }));
          signedAttr.push(new Attribute({
            type: "1.2.840.113549.1.9.5",
            values: [new UTCTime({ valueDate: /* @__PURE__ */ new Date() })]
          }));
          signedAttr.push(new Attribute({
            type: "1.2.840.113549.1.9.4",
            values: [new OctetString({ valueHex: result })]
          }));
          cmsSigned.signerInfos.push(new SignerInfo({
            version: 1,
            sid: new IssuerAndSerialNumber({
              issuer: parameters.signingCertificate.issuer,
              serialNumber: parameters.signingCertificate.serialNumber
            }),
            signedAttrs: new SignedAndUnsignedAttributes({
              type: 0,
              attributes: signedAttr
            })
          }));
          await cmsSigned.sign(parameters.privateKey, 0, parameters.hashAlgorithm, void 0, crypto2);
          this.authSafe = new ContentInfo({
            contentType: "1.2.840.113549.1.7.2",
            content: cmsSigned.toSchema(true)
          });
        }
        break;
      default:
        throw new Error(`Parameter "integrityMode" has unknown value: ${this.parsedValue.integrityMode}`);
    }
  }
  async parseInternalValues(parameters, crypto2 = getCrypto(true)) {
    ArgumentError.assert(parameters, "parameters", "object");
    if (parameters.checkIntegrity === void 0) parameters.checkIntegrity = true;
    this.parsedValue = {};
    switch (this.authSafe.contentType) {
      case ContentInfo.DATA:
        {
          ParameterError.assertEmpty(parameters.password, "password");
          this.parsedValue.integrityMode = 0;
          ArgumentError.assert(this.authSafe.content, "authSafe.content", OctetString);
          const authSafeContent = this.authSafe.content.getValue();
          this.parsedValue.authenticatedSafe = AuthenticatedSafe.fromBER(authSafeContent);
          if (parameters.checkIntegrity) {
            if (!this.macData) throw new Error('Absent "macData" value, can not check PKCS#12 data integrity');
            const hashAlgorithm = crypto2.getAlgorithmByOID(this.macData.mac.digestAlgorithm.algorithmId, true, "digestAlgorithm");
            if (!await crypto2.verifyDataStampedWithPassword({
              password: parameters.password,
              hashAlgorithm: hashAlgorithm.name,
              salt: toArrayBuffer(this.macData.macSalt.valueBlock.valueHexView),
              iterationCount: this.macData.iterations || 1,
              contentToVerify: authSafeContent,
              signatureToVerify: toArrayBuffer(this.macData.mac.digest.valueBlock.valueHexView)
            })) throw new Error("Integrity for the PKCS#12 data is broken!");
          }
        }
        break;
      case ContentInfo.SIGNED_DATA:
        {
          this.parsedValue.integrityMode = 1;
          const cmsSigned = new SignedData({ schema: this.authSafe.content });
          const eContent = cmsSigned.encapContentInfo.eContent;
          ParameterError.assert(eContent, "eContent", "cmsSigned.encapContentInfo");
          ArgumentError.assert(eContent, "eContent", OctetString);
          const data = eContent.getValue();
          this.parsedValue.authenticatedSafe = AuthenticatedSafe.fromBER(data);
          if (!await cmsSigned.verify({
            signer: 0,
            checkChain: false
          }, crypto2)) throw new Error("Integrity for the PKCS#12 data is broken!");
        }
        break;
      default:
        throw new Error(`Incorrect value for "this.authSafe.contentType": ${this.authSafe.contentType}`);
    }
  }
};
var STATUS$1 = "status";
var STATUS_STRINGS = "statusStrings";
var FAIL_INFO = "failInfo";
var CLEAR_PROPS$2 = [
  STATUS$1,
  STATUS_STRINGS,
  FAIL_INFO
];
var PKIStatusInfo = class PKIStatusInfo2 extends PkiObject {
  static {
    this.CLASS_NAME = "PKIStatusInfo";
  }
  constructor(parameters = {}) {
    super();
    this.status = parameters[STATUS$1] ?? PKIStatusInfo2.defaultValues(STATUS$1);
    if (STATUS_STRINGS in parameters) this.statusStrings = parameters[STATUS_STRINGS] ?? PKIStatusInfo2.defaultValues(STATUS_STRINGS);
    if (FAIL_INFO in parameters) this.failInfo = parameters[FAIL_INFO] ?? PKIStatusInfo2.defaultValues(FAIL_INFO);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case STATUS$1:
        return 2;
      case STATUS_STRINGS:
        return [];
      case FAIL_INFO:
        return new BitString();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case STATUS$1:
        return memberValue === PKIStatusInfo2.defaultValues(memberName);
      case STATUS_STRINGS:
        return memberValue.length === 0;
      case FAIL_INFO:
        return memberValue.isEqual(PKIStatusInfo2.defaultValues(memberName));
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || "",
      value: [
        new Integer({ name: names.status || "" }),
        new Sequence({
          optional: true,
          value: [new Repeated({
            name: names.statusStrings || "",
            value: new Utf8String()
          })]
        }),
        new BitString({
          name: names.failInfo || "",
          optional: true
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$2) delete schema[prop];
    const asn1 = compareSchema(schema, schema, PKIStatusInfo2.schema({ names: {
      status: STATUS$1,
      statusStrings: STATUS_STRINGS,
      failInfo: FAIL_INFO
    } }));
    AsnError.assertSchema(asn1, this.className);
    const _status = asn1.result.status;
    if (_status.valueBlock.isHexOnly === true || _status.valueBlock.valueDec < 0 || _status.valueBlock.valueDec > 5) throw new Error('PKIStatusInfo "status" has invalid value');
    this.status = _status.valueBlock.valueDec;
    if (STATUS_STRINGS in asn1.result) this.statusStrings = asn1.result.statusStrings;
    if (FAIL_INFO in asn1.result) this.failInfo = asn1.result.failInfo;
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.status }));
    if (this.statusStrings) outputArray.push(new Sequence({
      optional: true,
      value: this.statusStrings
    }));
    if (this.failInfo) outputArray.push(this.failInfo);
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { status: this.status };
    if (this.statusStrings) res.statusStrings = Array.from(this.statusStrings, (o) => o.toJSON());
    if (this.failInfo) res.failInfo = this.failInfo.toJSON();
    return res;
  }
};
var VERSION = "version";
var MESSAGE_IMPRINT = "messageImprint";
var REQ_POLICY = "reqPolicy";
var NONCE = "nonce";
var CERT_REQ = "certReq";
var EXTENSIONS = "extensions";
var TIME_STAMP_REQ = "TimeStampReq";
var TIME_STAMP_REQ_VERSION = `${TIME_STAMP_REQ}.${VERSION}`;
var TIME_STAMP_REQ_MESSAGE_IMPRINT = `${TIME_STAMP_REQ}.${MESSAGE_IMPRINT}`;
var TIME_STAMP_REQ_POLICY = `${TIME_STAMP_REQ}.${REQ_POLICY}`;
var TIME_STAMP_REQ_NONCE = `${TIME_STAMP_REQ}.${NONCE}`;
var TIME_STAMP_REQ_CERT_REQ = `${TIME_STAMP_REQ}.${CERT_REQ}`;
var TIME_STAMP_REQ_EXTENSIONS = `${TIME_STAMP_REQ}.${EXTENSIONS}`;
var CLEAR_PROPS$1 = [
  TIME_STAMP_REQ_VERSION,
  TIME_STAMP_REQ_MESSAGE_IMPRINT,
  TIME_STAMP_REQ_POLICY,
  TIME_STAMP_REQ_NONCE,
  TIME_STAMP_REQ_CERT_REQ,
  TIME_STAMP_REQ_EXTENSIONS
];
var TimeStampReq = class TimeStampReq2 extends PkiObject {
  static {
    this.CLASS_NAME = "TimeStampReq";
  }
  constructor(parameters = {}) {
    super();
    this.version = parameters[VERSION] ?? TimeStampReq2.defaultValues(VERSION);
    this.messageImprint = parameters[MESSAGE_IMPRINT] ?? TimeStampReq2.defaultValues(MESSAGE_IMPRINT);
    if (REQ_POLICY in parameters) this.reqPolicy = parameters[REQ_POLICY] ?? TimeStampReq2.defaultValues(REQ_POLICY);
    if (NONCE in parameters) this.nonce = parameters[NONCE] ?? TimeStampReq2.defaultValues(NONCE);
    if (CERT_REQ in parameters) this.certReq = parameters[CERT_REQ] ?? TimeStampReq2.defaultValues(CERT_REQ);
    if (EXTENSIONS in parameters) this.extensions = parameters[EXTENSIONS] ?? TimeStampReq2.defaultValues(EXTENSIONS);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case VERSION:
        return 0;
      case MESSAGE_IMPRINT:
        return new MessageImprint();
      case REQ_POLICY:
        return "";
      case NONCE:
        return new Integer();
      case CERT_REQ:
        return false;
      case EXTENSIONS:
        return [];
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case VERSION:
      case REQ_POLICY:
      case CERT_REQ:
        return memberValue === TimeStampReq2.defaultValues(memberName);
      case MESSAGE_IMPRINT:
        return MessageImprint.compareWithDefault("hashAlgorithm", memberValue.hashAlgorithm) && MessageImprint.compareWithDefault("hashedMessage", memberValue.hashedMessage);
      case NONCE:
        return memberValue.isEqual(TimeStampReq2.defaultValues(memberName));
      case EXTENSIONS:
        return memberValue.length === 0;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || TIME_STAMP_REQ,
      value: [
        new Integer({ name: names.version || TIME_STAMP_REQ_VERSION }),
        MessageImprint.schema(names.messageImprint || { names: { blockName: TIME_STAMP_REQ_MESSAGE_IMPRINT } }),
        new ObjectIdentifier({
          name: names.reqPolicy || TIME_STAMP_REQ_POLICY,
          optional: true
        }),
        new Integer({
          name: names.nonce || TIME_STAMP_REQ_NONCE,
          optional: true
        }),
        new Boolean2({
          name: names.certReq || TIME_STAMP_REQ_CERT_REQ,
          optional: true
        }),
        new Constructed({
          optional: true,
          idBlock: {
            tagClass: 3,
            tagNumber: 0
          },
          value: [new Repeated({
            name: names.extensions || TIME_STAMP_REQ_EXTENSIONS,
            value: Extension.schema()
          })]
        })
      ]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS$1) delete schema[prop];
    const asn1 = compareSchema(schema, schema, TimeStampReq2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.version = asn1.result[TIME_STAMP_REQ_VERSION].valueBlock.valueDec;
    this.messageImprint = new MessageImprint({ schema: asn1.result[TIME_STAMP_REQ_MESSAGE_IMPRINT] });
    if (TIME_STAMP_REQ_POLICY in asn1.result) this.reqPolicy = asn1.result[TIME_STAMP_REQ_POLICY].valueBlock.toString();
    if (TIME_STAMP_REQ_NONCE in asn1.result) this.nonce = asn1.result[TIME_STAMP_REQ_NONCE];
    if (TIME_STAMP_REQ_CERT_REQ in asn1.result) this.certReq = asn1.result[TIME_STAMP_REQ_CERT_REQ].valueBlock.value;
    if (TIME_STAMP_REQ_EXTENSIONS in asn1.result) this.extensions = Array.from(asn1.result[TIME_STAMP_REQ_EXTENSIONS], (element) => new Extension({ schema: element }));
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(new Integer({ value: this.version }));
    outputArray.push(this.messageImprint.toSchema());
    if (this.reqPolicy) outputArray.push(new ObjectIdentifier({ value: this.reqPolicy }));
    if (this.nonce) outputArray.push(this.nonce);
    if (CERT_REQ in this && TimeStampReq2.compareWithDefault(CERT_REQ, this.certReq) === false) outputArray.push(new Boolean2({ value: this.certReq }));
    if (this.extensions) outputArray.push(new Constructed({
      idBlock: {
        tagClass: 3,
        tagNumber: 0
      },
      value: Array.from(this.extensions, (o) => o.toSchema())
    }));
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = {
      version: this.version,
      messageImprint: this.messageImprint.toJSON()
    };
    if (this.reqPolicy !== void 0) res.reqPolicy = this.reqPolicy;
    if (this.nonce !== void 0) res.nonce = this.nonce.toJSON();
    if (this.certReq !== void 0 && TimeStampReq2.compareWithDefault(CERT_REQ, this.certReq) === false) res.certReq = this.certReq;
    if (this.extensions) res.extensions = Array.from(this.extensions, (o) => o.toJSON());
    return res;
  }
};
var STATUS = "status";
var TIME_STAMP_TOKEN = "timeStampToken";
var TIME_STAMP_RESP = "TimeStampResp";
var TIME_STAMP_RESP_STATUS = `${TIME_STAMP_RESP}.${STATUS}`;
var TIME_STAMP_RESP_TOKEN = `${TIME_STAMP_RESP}.${TIME_STAMP_TOKEN}`;
var CLEAR_PROPS = [TIME_STAMP_RESP_STATUS, TIME_STAMP_RESP_TOKEN];
var TimeStampResp = class TimeStampResp2 extends PkiObject {
  static {
    this.CLASS_NAME = "TimeStampResp";
  }
  constructor(parameters = {}) {
    super();
    this.status = parameters[STATUS] ?? TimeStampResp2.defaultValues(STATUS);
    if (TIME_STAMP_TOKEN in parameters) this.timeStampToken = parameters[TIME_STAMP_TOKEN] ?? TimeStampResp2.defaultValues(TIME_STAMP_TOKEN);
    if (parameters.schema) this.fromSchema(parameters.schema);
  }
  static defaultValues(memberName) {
    switch (memberName) {
      case STATUS:
        return new PKIStatusInfo();
      case TIME_STAMP_TOKEN:
        return new ContentInfo();
      default:
        return super.defaultValues(memberName);
    }
  }
  static compareWithDefault(memberName, memberValue) {
    switch (memberName) {
      case STATUS:
        return PKIStatusInfo.compareWithDefault(STATUS, memberValue.status) && "statusStrings" in memberValue === false && "failInfo" in memberValue === false;
      case TIME_STAMP_TOKEN:
        return memberValue.contentType === "" && memberValue.content instanceof Any;
      default:
        return super.defaultValues(memberName);
    }
  }
  static schema(parameters = {}) {
    const names = parameters.names ?? {};
    return new Sequence({
      name: names.blockName || TIME_STAMP_RESP,
      value: [PKIStatusInfo.schema(names.status || { names: { blockName: TIME_STAMP_RESP_STATUS } }), ContentInfo.schema(names.timeStampToken || { names: {
        blockName: TIME_STAMP_RESP_TOKEN,
        optional: true
      } })]
    });
  }
  fromSchema(schema) {
    for (const prop of CLEAR_PROPS) delete schema[prop];
    const asn1 = compareSchema(schema, schema, TimeStampResp2.schema());
    AsnError.assertSchema(asn1, this.className);
    this.status = new PKIStatusInfo({ schema: asn1.result[TIME_STAMP_RESP_STATUS] });
    if (TIME_STAMP_RESP_TOKEN in asn1.result) this.timeStampToken = new ContentInfo({ schema: asn1.result[TIME_STAMP_RESP_TOKEN] });
  }
  toSchema() {
    const outputArray = [];
    outputArray.push(this.status.toSchema());
    if (this.timeStampToken) outputArray.push(this.timeStampToken.toSchema());
    return new Sequence({ value: outputArray });
  }
  toJSON() {
    const res = { status: this.status.toJSON() };
    if (this.timeStampToken) res.timeStampToken = this.timeStampToken.toJSON();
    return res;
  }
  async sign(privateKey, hashAlgorithm, crypto2 = getCrypto(true)) {
    this.assertContentType();
    return new SignedData({ schema: this.timeStampToken.content }).sign(privateKey, 0, hashAlgorithm, void 0, crypto2);
  }
  async verify(verificationParameters = {
    signer: 0,
    trustedCerts: [],
    data: EMPTY_BUFFER2
  }, crypto2 = getCrypto(true)) {
    this.assertContentType();
    return new SignedData({ schema: this.timeStampToken.content }).verify(verificationParameters, crypto2);
  }
  assertContentType() {
    if (!this.timeStampToken) throw new Error("timeStampToken is absent in TSP response");
    if (this.timeStampToken.contentType !== "1.2.840.113549.1.7.2") throw new Error(`Wrong format of timeStampToken: ${this.timeStampToken.contentType}`);
  }
};
function initCryptoEngine() {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis) {
    let engineName = "webcrypto";
    if ("webkitSubtle" in globalThis.crypto) engineName = "safari";
    setEngine(engineName, new CryptoEngine({
      name: engineName,
      crypto: globalThis.crypto
    }));
  } else if (typeof crypto !== "undefined" && "webcrypto" in crypto) {
    const name = "NodeJS ^15";
    const nodeCrypto = crypto.webcrypto;
    setEngine(name, new CryptoEngine({
      name,
      crypto: nodeCrypto
    }));
  }
}
initCryptoEngine();

// web/pkiHelpers.js
var PEM_HEADER_RE = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/;
var OID_TO_NAME = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.9": "STREET",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.5": "serialNumber",
  "2.5.4.12": "T",
  "2.5.4.42": "GN",
  "2.5.4.43": "I",
  "2.5.4.4": "SN",
  "0.9.2342.19200300.100.1.25": "DC",
  "0.9.2342.19200300.100.1.1": "UID",
  "1.2.840.113549.1.9.1": "emailAddress"
};
var CURVE_OID_TO_NAME = {
  "1.2.840.10045.3.1.7": "P-256",
  "1.3.132.0.34": "P-384",
  "1.3.132.0.35": "P-521"
};
var CURVE_NAME_TO_BITS = {
  "P-256": 256,
  "P-384": 384,
  "P-521": 521
};
var SIG_ALGORITHM_OID_NAMES = {
  "1.2.840.113549.1.1.5": "sha1WithRSAEncryption",
  "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption",
  "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.113549.1.1.10": "rsassa-pss",
  "1.2.840.10045.4.1": "ecdsa-with-SHA1",
  "1.2.840.10045.4.3.2": "ecdsa-with-SHA256",
  "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448"
};
var OID = {
  RSA_ENCRYPTION: "1.2.840.113549.1.1.1",
  EC_PUBLIC_KEY: "1.2.840.10045.2.1",
  EXT_BASIC_CONSTRAINTS: "2.5.29.19",
  EXT_KEY_USAGE: "2.5.29.15",
  EXT_EXTENDED_KEY_USAGE: "2.5.29.37",
  EXT_SUBJECT_ALT_NAME: "2.5.29.17",
  EKU_SERVER_AUTH: "1.3.6.1.5.5.7.3.1",
  EKU_CLIENT_AUTH: "1.3.6.1.5.5.7.3.2"
};
var KEY_USAGE_NAMES = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly"
];
function pemToDer(pem) {
  const b64 = pem.replace(/-----(?:BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}
function pemType(pem) {
  const match = PEM_HEADER_RE.exec(pem);
  return match ? match[1] : null;
}
function bytesToHex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out.toUpperCase();
}
function hexWithColons(hex2) {
  return hex2.toUpperCase().replace(/(.{2})(?!$)/g, "$1:");
}
function rdnToString(rdn) {
  if (!rdn || !Array.isArray(rdn.typesAndValues)) return "";
  return rdn.typesAndValues.map((tv) => {
    const name = OID_TO_NAME[tv.type] || tv.type;
    const value = tv.value && tv.value.valueBlock && tv.value.valueBlock.value;
    return value !== void 0 ? `${name}=${value}` : `${name}=`;
  }).join(", ");
}
function extractCertificatePems(text) {
  const re = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  return text.match(re) || [];
}
function parsePemCertificate(pem) {
  const der = pemToDer(extractCertificatePems(pem)[0] || pem);
  return Certificate.fromBER(der);
}
function ipBytesToString(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length === 4) {
    return Array.from(view).join(".");
  }
  if (view.length === 16) {
    const parts = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push((view[i] << 8 | view[i + 1]).toString(16));
    }
    return parts.join(":");
  }
  return bytesToHex(view);
}
function decodeAltNames(altNames) {
  const out = { dns: [], ip: [], uri: [], email: [], dn: [] };
  if (!Array.isArray(altNames)) return out;
  for (const gn of altNames) {
    if (!gn) continue;
    switch (gn.type) {
      case 1:
        if (typeof gn.value === "string") out.email.push(gn.value);
        break;
      case 2:
        if (typeof gn.value === "string") out.dns.push(gn.value);
        break;
      case 6:
        if (typeof gn.value === "string") out.uri.push(gn.value);
        break;
      case 7: {
        const hex2 = gn.value && gn.value.valueBlock && gn.value.valueBlock.valueHexView;
        if (hex2) out.ip.push(ipBytesToString(hex2));
        break;
      }
      case 4: {
        const dirName = rdnToString(gn.value);
        if (dirName) out.dn.push(dirName);
        break;
      }
      default:
        break;
    }
  }
  return out;
}
function decodeKeyUsageBits(parsedBitString) {
  if (!parsedBitString || !parsedBitString.valueBlock) return [];
  const bytes = parsedBitString.valueBlock.valueHexView || new Uint8Array(parsedBitString.valueBlock.valueHex || new ArrayBuffer(0));
  const unusedBits = parsedBitString.valueBlock.unusedBits || 0;
  if (!bytes || bytes.length === 0) return [];
  const totalBits = bytes.length * 8 - unusedBits;
  const out = [];
  for (let i = 0; i < totalBits && i < KEY_USAGE_NAMES.length; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitInByte = 7 - i % 8;
    if (bytes[byteIdx] >> bitInByte & 1) {
      out.push(KEY_USAGE_NAMES[i]);
    }
  }
  return out;
}
function findExtensionByOid(cert, oid) {
  if (!cert || !Array.isArray(cert.extensions)) return null;
  return cert.extensions.find((ext) => ext.extnID === oid) || null;
}
function curveOidToName(oid) {
  return CURVE_OID_TO_NAME[oid] || null;
}
function curveNameToBits(name) {
  return CURVE_NAME_TO_BITS[name] || null;
}
function sigAlgorithmName(oid) {
  if (!oid) return "Unknown";
  return SIG_ALGORITHM_OID_NAMES[oid] || oid;
}
function describePublicKey(cert) {
  const algoOid = cert?.subjectPublicKeyInfo?.algorithm?.algorithmId;
  if (!algoOid) return null;
  if (algoOid === OID.RSA_ENCRYPTION) {
    let bits;
    try {
      const view = cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView;
      const buf = new ArrayBuffer(view.byteLength);
      new Uint8Array(buf).set(view);
      const rsa = RSAPublicKey.fromBER(buf);
      const mod = rsa.modulus.valueBlock.valueHexView;
      let lead = 0;
      while (lead < mod.length && mod[lead] === 0) lead++;
      bits = (mod.length - lead) * 8;
    } catch {
      bits = void 0;
    }
    return { type: "RSA", bits };
  }
  if (algoOid === OID.EC_PUBLIC_KEY) {
    const params = cert.subjectPublicKeyInfo.algorithm.algorithmParams;
    const curveOid = params && typeof params.valueBlock?.toString === "function" ? params.valueBlock.toString() : null;
    const namedCurve = curveOidToName(curveOid);
    return { type: "EC", namedCurve, bits: namedCurve ? curveNameToBits(namedCurve) : void 0 };
  }
  return null;
}
async function importCertPublicKey(cert) {
  const desc = describePublicKey(cert);
  if (!desc) throw new Error("Unsupported certificate public key algorithm");
  if (desc.type === "RSA") {
    return cert.getPublicKey({
      algorithm: {
        algorithm: { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
        usages: ["verify"]
      }
    });
  }
  if (desc.type === "EC") {
    if (!desc.namedCurve) throw new Error("Unsupported EC named curve in certificate");
    return cert.getPublicKey({
      algorithm: {
        algorithm: { name: "ECDSA", namedCurve: desc.namedCurve },
        usages: ["verify"]
      }
    });
  }
  throw new Error(`Unsupported public key type: ${desc.type}`);
}
function wrapRsaPkcs1AsPkcs8(rsaKeyDer) {
  const wrapped = new PrivateKeyInfo({
    version: 0,
    privateKeyAlgorithm: new AlgorithmIdentifier({
      algorithmId: OID.RSA_ENCRYPTION,
      algorithmParams: new Null()
    }),
    privateKey: new OctetString({ valueHex: rsaKeyDer })
  });
  return wrapped.toSchema().toBER(false);
}
function wrapEcSec1AsPkcs8(sec1Der, curveOid) {
  const wrapped = new PrivateKeyInfo({
    version: 0,
    privateKeyAlgorithm: new AlgorithmIdentifier({
      algorithmId: OID.EC_PUBLIC_KEY,
      algorithmParams: new ObjectIdentifier({ value: curveOid })
    }),
    privateKey: new OctetString({ valueHex: sec1Der })
  });
  return wrapped.toSchema().toBER(false);
}
function extractPrivateKeyBlock(pem) {
  const re = /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/g;
  const match = re.exec(pem);
  return match ? match[0] : null;
}
async function importPrivateKeyFromPem(pem) {
  const block = extractPrivateKeyBlock(pem) || pem;
  const type = pemType(block);
  if (!type) throw new Error("Not a PEM private key");
  if (type === "DSA PRIVATE KEY") {
    throw new Error("DSA private keys are not supported in this environment");
  }
  if (type === "PRIVATE KEY") {
    const der = pemToDer(block);
    const pki = PrivateKeyInfo.fromBER(der);
    const algoOid = pki.privateKeyAlgorithm.algorithmId;
    if (algoOid === OID.RSA_ENCRYPTION) {
      const key = await crypto.subtle.importKey(
        "pkcs8",
        der,
        { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
        true,
        ["sign"]
      );
      return { key, type: "RSA" };
    }
    if (algoOid === OID.EC_PUBLIC_KEY) {
      const params = pki.privateKeyAlgorithm.algorithmParams;
      const curveOid = params && typeof params.valueBlock?.toString === "function" ? params.valueBlock.toString() : null;
      const namedCurve = curveOidToName(curveOid);
      if (!namedCurve) throw new Error(`Unsupported EC curve OID: ${curveOid}`);
      const key = await crypto.subtle.importKey(
        "pkcs8",
        der,
        { name: "ECDSA", namedCurve },
        true,
        ["sign"]
      );
      return { key, type: "EC", namedCurve };
    }
    throw new Error(`Unsupported private key algorithm: ${algoOid}`);
  }
  if (type === "RSA PRIVATE KEY") {
    const der = pemToDer(block);
    const pkcs8 = wrapRsaPkcs1AsPkcs8(der);
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
      true,
      ["sign"]
    );
    return { key, type: "RSA" };
  }
  if (type === "EC PRIVATE KEY") {
    const der = pemToDer(block);
    const ec = ECPrivateKey.fromBER(der);
    const curveOid = ec.namedCurve;
    if (!curveOid) throw new Error("EC private key has no namedCurve OID");
    const namedCurve = curveOidToName(curveOid);
    if (!namedCurve) throw new Error(`Unsupported EC curve OID: ${curveOid}`);
    const pkcs8 = wrapEcSec1AsPkcs8(der, curveOid);
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDSA", namedCurve },
      true,
      ["sign"]
    );
    return { key, type: "EC", namedCurve };
  }
  throw new Error(`Unsupported PEM private key type: ${type}`);
}
async function digestHex(buffer, algorithm) {
  const data = buffer instanceof Uint8Array ? buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) : buffer;
  const hash = await crypto.subtle.digest(algorithm, data);
  return bytesToHex(new Uint8Array(hash));
}

// web/verificationUtils.js
function parseCertificateChain(certText) {
  const certificates = [];
  const pems = extractCertificatePems(certText || "");
  for (const pem of pems) {
    try {
      const der = pemToDer(pem);
      const cert = Certificate.fromBER(der);
      certificates.push({ pem, cert, der });
    } catch {
    }
  }
  return certificates;
}
async function validateCertificateChain(certificates) {
  const validation = { isValid: true, errors: [], warnings: [], details: [] };
  if (!certificates || certificates.length <= 1) {
    validation.details.push("Single certificate provided - no chain validation needed");
    return validation;
  }
  for (let i = 0; i < certificates.length - 1; i++) {
    const cert = certificates[i].cert;
    const issuerCert = certificates[i + 1].cert;
    validation.details.push(`Checking certificate ${i + 1} against issuer certificate ${i + 2}`);
    const certIssuer = rdnToString(cert.issuer);
    const issuerSubject = rdnToString(issuerCert.subject);
    if (certIssuer !== issuerSubject) {
      validation.isValid = false;
      validation.errors.push(`Certificate ${i + 1} issuer "${certIssuer}" does not match certificate ${i + 2} subject "${issuerSubject}"`);
    } else {
      validation.details.push(`\u2713 Issuer names match for certificates ${i + 1} and ${i + 2}`);
    }
    try {
      const isSignatureValid = await cert.verify(issuerCert);
      if (isSignatureValid) {
        validation.details.push(`\u2713 Certificate ${i + 1} signature verified by certificate ${i + 2}`);
      } else {
        validation.isValid = false;
        validation.errors.push(`Certificate ${i + 1} signature verification failed against certificate ${i + 2}`);
      }
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Error verifying certificate ${i + 1} signature: ${error.message}`);
    }
    const certNotBefore = cert.notBefore?.value;
    const certNotAfter = cert.notAfter?.value;
    const issuerNotBefore = issuerCert.notBefore?.value;
    const issuerNotAfter = issuerCert.notAfter?.value;
    if (certNotBefore && issuerNotBefore && certNotBefore < issuerNotBefore) {
      validation.warnings.push(`Certificate ${i + 1} valid from date is before its issuer's valid from date`);
    }
    if (certNotAfter && issuerNotAfter && certNotAfter > issuerNotAfter) {
      validation.warnings.push(`Certificate ${i + 1} expires after its issuer certificate ${i + 2}`);
    }
  }
  const root = certificates[certificates.length - 1].cert;
  const rootIssuer = rdnToString(root.issuer);
  const rootSubject = rdnToString(root.subject);
  if (rootIssuer === rootSubject) {
    try {
      const isSelfSigned = await root.verify(root);
      if (isSelfSigned) {
        validation.details.push("\u2713 Root certificate is properly self-signed");
      } else {
        validation.warnings.push("Root certificate appears self-signed but signature verification failed");
      }
    } catch (error) {
      validation.warnings.push(`Error verifying root certificate self-signature: ${error.message}`);
    }
  } else {
    validation.warnings.push("Root certificate is not self-signed - chain may be incomplete");
  }
  certificates.forEach((certObj, index) => {
    const cert = certObj.cert;
    const bcExt = findExtensionByOid(cert, OID.EXT_BASIC_CONSTRAINTS);
    const bc = bcExt ? bcExt.parsedValue : null;
    if (index === 0) {
      if (bc && bc.cA) {
        validation.warnings.push("End entity certificate has CA flag set to true");
      }
    } else {
      if (!bc || !bc.cA) {
        validation.warnings.push(`Certificate ${index + 1} should be a CA but basicConstraints CA flag is not set`);
      }
      if (bc && bc.pathLenConstraint !== void 0) {
        const pathLen = typeof bc.pathLenConstraint === "number" ? bc.pathLenConstraint : bc.pathLenConstraint?.valueBlock?.valueDec ?? null;
        if (pathLen !== null) {
          const remainingCAs = certificates.length - index - 2;
          if (remainingCAs > pathLen) {
            validation.errors.push(`Certificate ${index + 1} pathLenConstraint (${pathLen}) exceeded by chain depth`);
            validation.isValid = false;
          }
        }
      }
    }
  });
  return validation;
}
async function validatePrivateKey(certObj, keyPem) {
  try {
    let imported;
    try {
      imported = await importPrivateKeyFromPem(keyPem);
    } catch (e) {
      return { isValid: false, message: `Failed to parse private key: ${e.message}` };
    }
    let certPubKey;
    try {
      certPubKey = await importCertPublicKey(certObj.cert);
    } catch (e) {
      return { isValid: false, message: `Failed to parse certificate public key: ${e.message}` };
    }
    if (certPubKey.algorithm.name !== imported.key.algorithm.name) {
      return { isValid: false, message: "Private key does not match the certificate (algorithm mismatch)" };
    }
    if (imported.type === "EC" && imported.namedCurve !== certPubKey.algorithm.namedCurve) {
      return { isValid: false, message: "Private key does not match the certificate (EC curve mismatch)" };
    }
    const data = new TextEncoder().encode("test-data-for-validation");
    let signOpts;
    if (imported.type === "RSA") {
      signOpts = { name: "RSASSA-PKCS1-v1_5" };
    } else if (imported.type === "EC") {
      signOpts = { name: "ECDSA", hash: { name: "SHA-256" } };
    } else {
      return { isValid: false, message: `Unsupported key type: ${imported.type}` };
    }
    const signature = await crypto.subtle.sign(signOpts, imported.key, data);
    const ok = await crypto.subtle.verify(signOpts, certPubKey, signature, data);
    return ok ? { isValid: true, message: "Private key matches the certificate!" } : { isValid: false, message: "Private key does not match the certificate" };
  } catch (error) {
    return { isValid: false, message: `Error validating private key: ${error.message}` };
  }
}
function getCertStatus(cert) {
  const now = /* @__PURE__ */ new Date();
  const notBefore = cert.notBefore?.value;
  const notAfter = cert.notAfter?.value;
  if (notBefore && now < notBefore) return "\u23F3 Not yet valid";
  if (notAfter && now > notAfter) return "\u26A0\uFE0F Expired";
  return "\u2705 Valid";
}
async function getFingerprint(der, algorithm = "sha1") {
  const algMap = { sha1: "SHA-1", sha256: "SHA-256", sha384: "SHA-384", sha512: "SHA-512" };
  const hex2 = await digestHex(der, algMap[algorithm] || "SHA-1");
  return hexWithColons(hex2);
}
function getSANs(cert) {
  try {
    const sanExt = findExtensionByOid(cert, OID.EXT_SUBJECT_ALT_NAME);
    if (!sanExt || !sanExt.parsedValue) return [];
    const grouped = decodeAltNames(sanExt.parsedValue.altNames);
    const out = [];
    grouped.dns.forEach((v) => out.push(`DNS: ${v}`));
    grouped.ip.forEach((v) => out.push(`IP: ${v}`));
    grouped.email.forEach((v) => out.push(`Email: ${v}`));
    grouped.uri.forEach((v) => out.push(`URI: ${v}`));
    grouped.dn.forEach((v) => out.push(`DN: ${v}`));
    return out;
  } catch {
    return [];
  }
}
function getKeySize(cert) {
  const desc = describePublicKey(cert);
  if (!desc) return "Unknown";
  return desc.bits || "Unknown";
}
function getSubjectField(cert, field, type = "subject") {
  const dnString = type === "subject" ? rdnToString(cert.subject) : rdnToString(cert.issuer);
  const attrs = parseDNString(dnString);
  return attrs[field] || "Not specified";
}
async function verifyCertificate(certText, keyText = null) {
  try {
    if (!certText || !certText.trim()) {
      return { success: false, error: "Invalid certificate. Make sure the file is a .pem." };
    }
    if (!isValidPemCertificate(certText)) {
      return { success: false, error: "Invalid certificate. Make sure the file is a .pem." };
    }
    if (keyText && keyText.trim() && !isValidPemPrivateKey(keyText)) {
      return { success: false, error: "Invalid private key. Make sure the file is a .key." };
    }
    const certificates = parseCertificateChain(certText);
    if (certificates.length === 0) {
      return { success: false, error: "Invalid certificate. Make sure the file is a .pem." };
    }
    const primary = certificates[0].cert;
    const primaryDer = certificates[0].der;
    const notBefore = primary.notBefore?.value;
    const notAfter = primary.notAfter?.value;
    const sigAlg = sigAlgorithmName(primary.signatureAlgorithm?.algorithmId);
    const keyDesc = describePublicKey(primary);
    const pubKeyAlg = keyDesc?.type === "EC" ? "ECDSA" : keyDesc?.type === "RSA" ? "RSA" : "Unknown";
    const serial = bytesToHex(primary.serialNumber.valueBlock.valueHexView) || primary.serialNumber.valueBlock.valueDec;
    const certDetails = {
      subject: getSubjectField(primary, "CN"),
      issuer: getSubjectField(primary, "CN", "issuer"),
      serialNumber: serial,
      validFrom: notBefore ? notBefore.toISOString() : "Unknown",
      validTo: notAfter ? notAfter.toISOString() : "Unknown",
      status: getCertStatus(primary),
      signatureAlgorithm: sigAlg,
      publicKeyAlgorithm: pubKeyAlg,
      keySize: getKeySize(primary),
      fingerprintSha1: await getFingerprint(primaryDer, "sha1"),
      fingerprintSha256: await getFingerprint(primaryDer, "sha256"),
      sans: getSANs(primary)
    };
    const chainValidation = await validateCertificateChain(certificates);
    let keyValidation = null;
    if (keyText && keyText.trim()) {
      keyValidation = await validatePrivateKey(certificates[0], keyText);
      if (!keyValidation || !keyValidation.isValid) {
        return {
          success: false,
          certificates,
          certDetails,
          chainValidation,
          keyValidation,
          error: "Certificate does not match private key."
        };
      }
    }
    const chainValid = chainValidation && chainValidation.isValid;
    const keyValid = !keyText || !keyText.trim() || keyValidation && keyValidation.isValid;
    const overallSuccess = chainValid && keyValid;
    return {
      success: overallSuccess,
      certificates,
      certDetails,
      chainValidation,
      keyValidation,
      chainDetails: certificates.length > 1 ? certificates.map((certObj, index) => {
        const certNotBefore = certObj.cert.notBefore?.value;
        const certNotAfter = certObj.cert.notAfter?.value;
        return {
          index: index + 1,
          type: index === 0 ? "End Entity" : index === certificates.length - 1 ? "Root CA" : "Intermediate CA",
          subject: getSubjectField(certObj.cert, "CN"),
          issuer: getSubjectField(certObj.cert, "CN", "issuer"),
          validFrom: certNotBefore ? certNotBefore.toDateString() : "Unknown",
          validTo: certNotAfter ? certNotAfter.toDateString() : "Unknown"
        };
      }) : null,
      error: !overallSuccess ? !chainValid ? "Certificate chain validation failed" : "Private key validation failed" : null
    };
  } catch (error) {
    return { success: false, error: `Error parsing certificate: ${error.message}` };
  }
}

// web/notificationService.js
import { toast } from "@oie/web-ui";
var notificationService = {
  showError: (m) => toast(String(m), "error"),
  showSuccess: (m) => toast(String(m), "success"),
  showInfo: (m) => toast(String(m)),
  showWarning: (m) => toast(String(m), "warn")
};

// web/certificateUtils.js
function parseDNString(dnString) {
  const attrs = {};
  if (!dnString) return attrs;
  const parts = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < dnString.length; i++) {
    const char = dnString[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  parts.forEach((part) => {
    const equalIndex = part.indexOf("=");
    if (equalIndex > 0) {
      const key = part.substring(0, equalIndex).trim();
      let value = part.substring(equalIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      attrs[key] = value;
    }
  });
  return attrs;
}
function formatDNFromObject(dnObj) {
  if (!dnObj || typeof dnObj !== "object") return "Unknown";
  const parts = [];
  const ordered = ["CN", "OU", "O", "L", "ST", "C", "emailAddress"];
  for (const attr of ordered) {
    if (dnObj[attr]) parts.push(`${attr}=${dnObj[attr]}`);
  }
  Object.keys(dnObj).forEach((key) => {
    if (!ordered.includes(key) && dnObj[key]) {
      parts.push(`${key}=${dnObj[key]}`);
    }
  });
  return parts.length > 0 ? parts.join(", ") : "Unknown";
}
function determineCertificateType(cert) {
  try {
    const bcExt = findExtensionByOid(cert, OID.EXT_BASIC_CONSTRAINTS);
    const cA = !!(bcExt && bcExt.parsedValue && bcExt.parsedValue.cA);
    const kuExt = findExtensionByOid(cert, OID.EXT_KEY_USAGE);
    const keyUsageNames = kuExt ? decodeKeyUsageBits(kuExt.parsedValue) : [];
    const isCA = cA || keyUsageNames.includes("keyCertSign");
    if (isCA) {
      const subject = rdnToString(cert.subject);
      const issuer = rdnToString(cert.issuer);
      return subject === issuer ? "Root CA" : "Intermediate";
    }
    const ekuExt = findExtensionByOid(cert, OID.EXT_EXTENDED_KEY_USAGE);
    const keyPurposes = ekuExt && ekuExt.parsedValue && Array.isArray(ekuExt.parsedValue.keyPurposes) ? ekuExt.parsedValue.keyPurposes : [];
    if (keyPurposes.includes(OID.EKU_SERVER_AUTH)) return "Server Certificate";
    if (keyPurposes.includes(OID.EKU_CLIENT_AUTH)) return "Client Certificate";
  } catch (error) {
    console.warn("Error determining certificate type:", error);
  }
  return "End-entity";
}
function formatDate(date) {
  if (!date) return "Unknown";
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return "Unknown";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
async function parseCertificate(base64Pem) {
  try {
    const der = pemToDer(base64Pem);
    const cert = parsePemCertificate(base64Pem);
    const subjectFormatted = rdnToString(cert.subject);
    const subject = parseDNString(subjectFormatted);
    const issuerFormatted = rdnToString(cert.issuer);
    const issuer = parseDNString(issuerFormatted);
    const type = determineCertificateType(cert);
    const notBefore = cert.notBefore?.value || null;
    const notAfter = cert.notAfter?.value || null;
    const validFrom = formatDate(notBefore);
    const validTo = formatDate(notAfter);
    const fingerprintSha1 = await digestHex(der, "SHA-1");
    const serialNumberHex = bytesToHex(cert.serialNumber.valueBlock.valueHexView);
    const serialNumber = serialNumberHex || cert.serialNumber.valueBlock.valueDec;
    const version = cert.version + 1;
    const extensions = [];
    const bcExt = findExtensionByOid(cert, OID.EXT_BASIC_CONSTRAINTS);
    if (bcExt && bcExt.parsedValue) {
      extensions.push({
        name: "basicConstraints",
        cA: !!bcExt.parsedValue.cA,
        critical: !!bcExt.critical
      });
    }
    const kuExt = findExtensionByOid(cert, OID.EXT_KEY_USAGE);
    if (kuExt && kuExt.parsedValue) {
      const names = decodeKeyUsageBits(kuExt.parsedValue);
      if (names.length > 0) {
        extensions.push({
          name: "keyUsage",
          names,
          critical: !!kuExt.critical
        });
      }
    }
    const ekuExt = findExtensionByOid(cert, OID.EXT_EXTENDED_KEY_USAGE);
    if (ekuExt && ekuExt.parsedValue && Array.isArray(ekuExt.parsedValue.keyPurposes)) {
      extensions.push({
        name: "extKeyUsage",
        names: ekuExt.parsedValue.keyPurposes,
        critical: !!ekuExt.critical
      });
    }
    const sanExt = findExtensionByOid(cert, OID.EXT_SUBJECT_ALT_NAME);
    const subjectAltNames = sanExt && sanExt.parsedValue ? decodeAltNames(sanExt.parsedValue.altNames) : { dns: [], ip: [], uri: [], email: [], dn: [] };
    return {
      subject,
      subjectStr: formatDNFromObject(subject),
      issuer,
      issuerStr: formatDNFromObject(issuer),
      type,
      validFrom,
      validTo,
      fingerprintSha1,
      serialNumber,
      version,
      extensions,
      subjectAltNames,
      raw: cert
    };
  } catch (error) {
    return {
      subject: null,
      subjectStr: "Parse Error",
      issuer: null,
      issuerStr: "Parse Error",
      type: "Unknown",
      validFrom: "Unknown",
      validTo: "Unknown",
      fingerprintSha1: "Unknown",
      error: error.message
    };
  }
}
function isValidPemCertificate(pemString) {
  try {
    if (!pemString.includes("-----BEGIN CERTIFICATE-----") || !pemString.includes("-----END CERTIFICATE-----")) {
      return false;
    }
    parsePemCertificate(pemString);
    return true;
  } catch {
    return false;
  }
}
function isValidPemPrivateKey(pemString) {
  if (!pemString) return false;
  try {
    const block = extractPrivateKeyBlock(pemString);
    if (!block) return false;
    const parsers = {
      "PRIVATE KEY": PrivateKeyInfo,
      "RSA PRIVATE KEY": RSAPrivateKey,
      "EC PRIVATE KEY": ECPrivateKey
    };
    const parser = parsers[pemType(block)];
    if (!parser) return false;
    parser.fromBER(pemToDer(block));
    return true;
  } catch {
    return false;
  }
}
function base64ToPem(base64Cert) {
  try {
    if (typeof base64Cert === "string" && base64Cert.includes("-----BEGIN ")) {
      return base64Cert;
    }
    return `-----BEGIN CERTIFICATE-----
${base64Cert}
-----END CERTIFICATE-----`;
  } catch {
    const errorMessage = "Invalid Base64 format";
    notificationService.showError(errorMessage);
    throw new Error(errorMessage);
  }
}
function base64ToPrivateKeyPem(base64Key) {
  try {
    if (typeof base64Key === "string" && base64Key.includes("-----BEGIN ")) {
      return base64Key;
    }
    return `-----BEGIN PRIVATE KEY-----
${base64Key}
-----END PRIVATE KEY-----`;
  } catch {
    const errorMessage = "Invalid Base64 private key format";
    notificationService.showError(errorMessage);
    throw new Error(errorMessage);
  }
}
function getSuggestedAlias(details) {
  if (!details) return null;
  const subjectStr = details.subjectStr || "";
  const cnMatch = subjectStr.match(/CN=([^,]+)/);
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim();
  const dnsName = details.subjectAltNames?.dns?.[0];
  if (dnsName) return dnsName.trim();
  const firstPart = subjectStr.split(",")[0];
  if (firstPart && firstPart.includes("=")) {
    return firstPart.split("=")[1]?.trim();
  }
  return null;
}
async function parseCertificateChainFromPem(pemText) {
  if (!pemText || !pemText.trim()) return [];
  try {
    const chainCertificates = parseCertificateChain(pemText);
    if (chainCertificates.length === 0) return [];
    const certificates = [];
    for (let index = 0; index < chainCertificates.length; index++) {
      const chainCert = chainCertificates[index];
      try {
        const parsed = await parseCertificate(chainCert.pem);
        if (parsed.error) {
          certificates.push({
            certificate: chainCert.pem,
            alias: `Certificate ${index + 1}`,
            name: "Invalid Certificate",
            type: "Invalid",
            subject: `Parse Error: ${parsed.error}`,
            issuer: "Unknown",
            validFrom: "Unknown",
            validTo: "Unknown",
            fingerprintSha1: "Unknown",
            parsedCertificate: parsed,
            error: parsed.error
          });
          continue;
        }
        certificates.push({
          certificate: chainCert.pem,
          alias: getSuggestedAlias(parsed) || `Certificate ${index + 1}`,
          name: parsed.subject?.CN || "Unknown",
          type: parsed.type || "Unknown",
          subject: parsed.subjectStr || "Unknown",
          issuer: parsed.issuerStr || "Unknown",
          validFrom: parsed.validFrom,
          validTo: parsed.validTo,
          fingerprintSha1: parsed.fingerprintSha1,
          parsedCertificate: parsed
        });
      } catch (parseError) {
        notificationService.showWarning(`Failed to parse certificate ${index + 1} in chain: ${parseError.message}`);
        certificates.push({
          certificate: chainCert.pem,
          alias: `Certificate ${index + 1}`,
          name: "Parse Error",
          type: "Invalid",
          subject: `Parse Error: ${parseError.message}`,
          issuer: "Unknown",
          validFrom: "Unknown",
          validTo: "Unknown",
          fingerprintSha1: "Unknown",
          error: parseError.message
        });
      }
    }
    return certificates;
  } catch {
    return [];
  }
}

// web/tlsService.js
var EXT = "/tlsmanager";
function listOf(data, key) {
  let v = data;
  if (v && typeof v === "object" && v.list) v = v.list;
  if (v && typeof v === "object" && v[key] !== void 0) v = v[key];
  if (v === null || v === void 0 || v === "") return [];
  return Array.isArray(v) ? v : [v];
}
function channelsOf(cert) {
  const s = cert && cert.channelsInUse && cert.channelsInUse.string;
  if (typeof s === "string") return [s];
  return Array.isArray(s) ? s : [];
}
async function enrich(cert, store) {
  const parsed = await parseCertificate(cert.certificate);
  const base = {
    alias: String(cert.alias ?? ""),
    store,
    hasPrivateKey: store === "private",
    channelsInUse: channelsOf(cert),
    rawCertificate: cert.certificate,
    rawPrivateKey: cert.key,
    parsedCertificate: parsed
  };
  if (parsed.error) {
    return { ...base, name: base.alias, type: "Invalid", subject: `Parse Error: ${parsed.error}`, issuer: "Unknown", validFrom: "Unknown", validTo: "Unknown", fingerprintSha1: "Unknown" };
  }
  return {
    ...base,
    name: parsed.subject && parsed.subject.CN || base.alias,
    type: parsed.type || "Unknown",
    subject: parsed.subjectStr || "Unknown",
    issuer: parsed.issuerStr || "Unknown",
    validFrom: parsed.validFrom,
    validTo: parsed.validTo,
    fingerprintSha1: parsed.fingerprintSha1
  };
}
async function fetchStore(path, key, store) {
  const data = await api.get(`${EXT}/${path}`);
  const out = [];
  for (const cert of listOf(data, key)) {
    if (!cert || !cert.certificate || !String(cert.certificate).trim()) continue;
    out.push(await enrich(cert, store));
  }
  return out;
}
var fetchSystemCertificates = () => fetchStore("systemCertificates", "trustedCertificate", "native");
var fetchTrustedCertificates = () => fetchStore("trustedCertificates", "trustedCertificate", "trusted");
var fetchLocalCertificates = () => fetchStore("localCertificates", "localCertificate", "private");
async function fetchRemoteCertificates(url) {
  if (!url || !String(url).startsWith("https://")) throw new Error("URL must be a valid HTTPS URL");
  const data = await api.get(`${EXT}/remoteCertificates?url=${encodeURIComponent(url)}`);
  const out = [];
  for (const cert of listOf(data, "trustedCertificate")) {
    if (!cert || !cert.certificate || !String(cert.certificate).trim()) continue;
    const parsed = await parseCertificate(cert.certificate);
    out.push({
      alias: parsed.error ? "" : getSuggestedAlias(parsed),
      certificate: cert.certificate,
      name: parsed.error ? "Invalid Certificate" : parsed.subject && parsed.subject.CN || "Unknown",
      type: parsed.error ? "Invalid" : parsed.type || "Unknown",
      subject: parsed.subjectStr || "Unknown",
      issuer: parsed.issuerStr || "Unknown",
      validFrom: parsed.validFrom,
      validTo: parsed.validTo,
      fingerprintSha1: parsed.fingerprintSha1,
      parsedCertificate: parsed,
      error: parsed.error
    });
  }
  return out;
}
function putList(store, certs) {
  if (store === "trusted") {
    return api.put(`${EXT}/trustedCertificates`, { list: { trustedCertificate: certs.map((c) => ({ alias: c.alias, certificate: c.rawCertificate })) } });
  }
  return api.put(`${EXT}/localCertificates`, { list: { localCertificate: certs.map((c) => ({ alias: c.alias, certificate: c.rawCertificate, key: c.rawPrivateKey })) } });
}
var currentFor = async (store, current) => current ? current.slice() : store === "trusted" ? await fetchTrustedCertificates() : await fetchLocalCertificates();
async function updateCertificates(store, { alias, pemText, privateKeyText }, current) {
  const certs = await currentFor(store, current);
  const i = certs.findIndex((c) => c.alias === alias);
  const entry = { alias, rawCertificate: pemText, ...store === "private" && privateKeyText ? { rawPrivateKey: privateKeyText } : {} };
  if (i >= 0) certs[i] = { ...certs[i], ...entry };
  else certs.push(entry);
  await putList(store, certs);
  return { success: true };
}
async function updateCertificateAlias(store, oldAlias, newAlias, current) {
  const certs = await currentFor(store, current);
  const i = certs.findIndex((c) => c.alias === oldAlias);
  if (i < 0) throw new Error("Certificate not found");
  certs[i] = { ...certs[i], alias: newAlias };
  await putList(store, certs);
  return { success: true };
}
async function removeCertificate(store, alias, current) {
  const certs = await currentFor(store, current);
  const i = certs.findIndex((c) => c.alias === alias);
  if (i < 0) throw new Error("Certificate not found");
  certs.splice(i, 1);
  await putList(store, certs);
  return { success: true };
}

// web/plugin.jsx
var React = platform.React;
var FQCN = "org.openintegrationengine.tlsmanager.shared.properties.TLSConnectorProperties";
var EXT2 = "/tlsmanager";
var SUPPORTED_TRANSPORTS = [
  "HTTP Listener",
  "TCP Listener",
  "Web Service Listener",
  "HTTP Sender",
  "TCP Sender",
  "Web Service Sender"
];
var REVOCATION_MODES = [
  { value: "DISABLED", label: "Disabled" },
  { value: "SOFT_FAIL", label: "Soft Fail" },
  { value: "HARD_FAIL", label: "Hard Fail" }
];
var SUBJECT_DN_MODES = [
  { value: "NONE", label: "None" },
  { value: "PARTIAL", label: "Partial" },
  { value: "EXACT", label: "Exact" }
];
var CLIENT_AUTH_MODES = [
  { value: "NONE", label: "None" },
  { value: "REQUESTED", label: "Requested" },
  { value: "REQUIRED", label: "Required" }
];
var FALLBACK_PROTOCOLS = ["TLSv1.3", "TLSv1.2", "TLSv1.1", "TLSv1"];
var api2 = platform.api;
var setToList = (v) => api2.asList(v, "string").map(String).filter((s) => s.length);
var listToSet = (list) => list && list.length ? { string: [...list] } : "";
function certList(value) {
  if (value === null || value === void 0 || value === "") return [];
  if (typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["localCertificate", "trustedCertificate"]) {
      if (value[key] !== void 0) {
        value = value[key];
        break;
      }
    }
  }
  if (value === null || value === void 0 || value === "") return [];
  return (Array.isArray(value) ? value : [value]).filter((c) => c && typeof c === "object");
}
var notInstalled = (e) => e && (e.status === 404 || e.status === 501);
function parseCryptoMap(value) {
  const out = {};
  for (const entry of api2.asList(value && value.entry)) {
    if (!entry || typeof entry !== "object") continue;
    const key = typeof entry.string === "string" ? entry.string : Array.isArray(entry.string) ? entry.string[0] : null;
    if (!key) continue;
    for (const [k, v] of Object.entries(entry)) {
      if (k === "string" || k.startsWith("@")) continue;
      const list = setToList(v && typeof v === "object" ? v : { string: v });
      if (list.length) out[key] = list;
    }
  }
  return out;
}
function tlsDefaults(version) {
  return {
    "@version": version,
    isTlsManagerEnabled: false,
    trustSystemTruststore: true,
    trustedServerCertificates: "",
    // Collections.emptySet()
    crlMode: "HARD_FAIL",
    ocspMode: "HARD_FAIL",
    subjectDnValidationMode: "NONE",
    subjectDnValidationFilter: null,
    isUseServerDefaultProtocols: true,
    usedProtocols: "",
    // Collections.emptySet()
    isUseServerDefaultCiphers: true,
    usedCiphers: "",
    // Collections.emptySet()
    serverCertificateAlias: null,
    // server mode
    clientAuthMode: "NONE",
    // server mode
    isHostnameVerificationEnabled: true,
    // client mode
    clientCertificateAlias: null
    // client mode
  };
}
function isServerMode(connector) {
  const t = connector.transportName;
  if (t === "HTTP Listener" || t === "Web Service Listener") return true;
  if (t === "HTTP Sender" || t === "Web Service Sender") return false;
  return asBool(connector.properties && connector.properties.serverMode);
}
var pickRow = (control, label) => h(
  "label.check",
  { style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 10px", cursor: "pointer" } },
  control,
  h("span", label)
);
function openMultiPicker({ title, options, selected, useServerDefault, onApply }) {
  const known = new Set(options);
  const sel = new Set(selected);
  const unknown = [...sel].filter((s) => !known.has(s));
  let useDefault = !!useServerDefault;
  const filterInput = textInput("", { placeholder: "Filter\u2026", style: { flex: "1" } });
  const listWrap = h("div", { style: { maxHeight: "320px", overflow: "auto", border: "1px solid var(--line)", borderRadius: "4px", marginTop: "8px" } });
  const unknownWrap = h("div");
  const optBoxes = /* @__PURE__ */ new Map();
  let defaultBox = null;
  function build() {
    clear(listWrap);
    clear(unknownWrap);
    const f = filterInput.value.trim().toLowerCase();
    defaultBox = h("input", { type: "checkbox", checked: useDefault });
    defaultBox.addEventListener("change", () => {
      useDefault = defaultBox.checked;
      if (useDefault) {
        sel.clear();
        optBoxes.forEach((b) => {
          b.checked = false;
        });
      }
    });
    listWrap.appendChild(pickRow(defaultBox, "[Server default]"));
    optBoxes.clear();
    for (const [values, wrap] of [[options, listWrap], [unknown, unknownWrap]]) {
      for (const opt of values) {
        if (f && !opt.toLowerCase().includes(f)) continue;
        const box = h("input", { type: "checkbox", checked: sel.has(opt) });
        box.addEventListener("change", () => {
          if (box.checked) {
            sel.add(opt);
            useDefault = false;
            if (defaultBox) defaultBox.checked = false;
          } else sel.delete(opt);
        });
        optBoxes.set(opt, box);
        wrap.appendChild(pickRow(box, opt));
      }
    }
  }
  build();
  filterInput.addEventListener("input", build);
  const link = (label, fn) => h("a", { href: "#", style: { color: "var(--accent)" }, onClick: (e) => {
    e.preventDefault();
    fn();
    build();
  } }, label);
  const selectAll = link("Select All", () => {
    [...options, ...unknown].forEach((o) => sel.add(o));
    useDefault = false;
  });
  const deselectAll = link("Deselect All", () => {
    sel.clear();
  });
  modal({
    title,
    size: "wide",
    body: h(
      "div",
      { style: { minWidth: "480px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        h("label", "Filter:"),
        filterInput,
        selectAll,
        h("span.text-text-faint", "|"),
        deselectAll
      ),
      listWrap,
      unknown.length ? h(
        "div",
        { style: { marginTop: "10px" } },
        h("div.text-text-faint", { style: { fontWeight: "600", marginBottom: "4px" } }, "Unknown Options"),
        unknownWrap
      ) : null
    ),
    buttons: [
      { label: "Cancel" },
      {
        label: "OK",
        primary: true,
        onClick: () => onApply({ useServerDefault: useDefault, selected: [...sel] })
      }
    ]
  });
}
function openCertPicker({ title, aliases, current, onApply, required = false }) {
  let chosen = current || "";
  const name = "tlscertpick-" + Math.random().toString(36).slice(2);
  const filterInput = textInput("", { id: `${name}-filter`, placeholder: "Filter\u2026", style: { flex: "1", minWidth: "0" } });
  const rows = h("tbody");
  const error = h("div.hint", { role: "alert", hidden: true }, "Select a certificate before clicking OK.");
  const listWrap = h("div", { style: {
    height: required ? "min(420px, 50vh)" : void 0,
    maxHeight: required ? void 0 : "320px",
    overflow: "auto",
    border: "1px solid var(--line)",
    marginTop: "8px"
  } }, h(
    "table",
    { style: { width: "100%", borderCollapse: "collapse" } },
    h("thead", h(
      "tr",
      h("th", { scope: "col", "aria-label": "Selection", style: { width: "32px" } }),
      h("th", { scope: "col", style: { textAlign: "center" } }, "Options")
    )),
    rows
  ));
  function build() {
    clear(rows);
    const f = filterInput.value.trim().toLowerCase();
    const options = required ? aliases : ["", ...aliases];
    for (const [index, alias] of options.entries()) {
      if (alias && f && !alias.toLowerCase().includes(f)) continue;
      const id = `${name}-${index}`;
      const box = h("input", { id, type: "radio", name, checked: chosen === alias });
      box.addEventListener("change", () => {
        chosen = alias;
        error.hidden = true;
      });
      rows.appendChild(h(
        "tr",
        h("td", { style: { width: "32px", textAlign: "center" } }, box),
        h("td", h("label", { for: id, style: { display: "block", cursor: "pointer" } }, alias || "<None>"))
      ));
    }
    if (!rows.children.length) rows.appendChild(h("tr", h("td", { colspan: 2 }, "No matching certificates.")));
  }
  build();
  filterInput.addEventListener("input", build);
  const apply = {
    label: "OK",
    primary: true,
    onClick: () => {
      if (required && !aliases.includes(chosen)) {
        error.hidden = false;
        return false;
      }
      onApply(chosen || null);
    }
  };
  modal({
    title,
    body: h(
      "fieldset",
      { style: { minWidth: "0", margin: "0", padding: "10px", border: "1px solid var(--line)" } },
      h("legend", "TLS settings"),
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        h("label", { for: `${name}-filter` }, "Filter:"),
        filterInput
      ),
      listWrap,
      error
    ),
    buttons: [apply, { label: "Cancel" }]
  });
}
var JVM_TRUSTSTORE = "[JVM Truststore]";
function openTrustPicker({ title, aliases, extMissing, trustSystemTruststore, selected, onApply }) {
  const sel = new Set(selected);
  let trustSystem = !!trustSystemTruststore;
  const rowAliases = () => [.../* @__PURE__ */ new Set([...aliases, ...sel])];
  const filterInput = textInput("", { placeholder: "Filter\u2026", style: { flex: "1" } });
  const listWrap = h("div", { style: { maxHeight: "320px", overflow: "auto", border: "1px solid var(--line)", borderRadius: "4px", marginTop: "8px" } });
  function build() {
    clear(listWrap);
    const f = filterInput.value.trim().toLowerCase();
    if (!f || JVM_TRUSTSTORE.toLowerCase().includes(f)) {
      const sysBox = h("input", { type: "checkbox", checked: trustSystem });
      sysBox.addEventListener("change", () => {
        trustSystem = sysBox.checked;
      });
      listWrap.appendChild(pickRow(sysBox, JVM_TRUSTSTORE));
    }
    for (const a of rowAliases()) {
      if (f && !a.toLowerCase().includes(f)) continue;
      const box = h("input", { type: "checkbox", checked: sel.has(a) });
      box.addEventListener("change", () => {
        if (box.checked) sel.add(a);
        else sel.delete(a);
      });
      listWrap.appendChild(pickRow(box, a));
    }
  }
  build();
  filterInput.addEventListener("input", build);
  const link = (label, fn) => h("a", { href: "#", style: { color: "var(--accent)" }, onClick: (e) => {
    e.preventDefault();
    fn();
    build();
  } }, label);
  const selectAll = link("Select All", () => {
    rowAliases().forEach((a) => sel.add(a));
    trustSystem = true;
  });
  const deselectAll = link("Deselect All", () => {
    sel.clear();
    trustSystem = false;
  });
  let addRow = null;
  if (extMissing) {
    const addInput = textInput("", { placeholder: "Certificate alias", style: { flex: "1" } });
    const add2 = () => {
      const v = addInput.value.trim();
      if (v) {
        sel.add(v);
        addInput.value = "";
        build();
      }
    };
    const addBtn = h("button.btn", { type: "button" }, "Add");
    addBtn.addEventListener("click", add2);
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add2();
      }
    });
    addRow = h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" } },
      h("label", "Add alias:"),
      addInput,
      addBtn
    );
  }
  modal({
    title,
    size: "wide",
    body: h(
      "div",
      { style: { minWidth: "480px" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        h("label", "Filter:"),
        filterInput,
        selectAll,
        h("span.text-text-faint", "|"),
        deselectAll
      ),
      listWrap,
      addRow
    ),
    buttons: [
      { label: "Cancel" },
      { label: "OK", primary: true, onClick: () => onApply({ trustSystemTruststore: trustSystem, selected: [...sel] }) }
    ]
  });
}
function TlsConnectorPanel({ getEntry, setEntry, connector, onChange }) {
  const version = String(platform.store.getState("serverVersion") || "");
  const formRef = React.useRef(null);
  const [server, setServer] = React.useState(() => isServerMode(connector));
  React.useEffect(() => {
    if (!connector.transportName.startsWith("TCP") || !formRef.current) return;
    const eventRoot = formRef.current.closest('[role="tabpanel"]') || formRef.current.ownerDocument;
    let active = true;
    const syncMode = (event) => {
      if (!event.target.closest?.('[data-fkey="serverMode"]')) return;
      queueMicrotask(() => {
        if (active) setServer(isServerMode(connector));
      });
    };
    eventRoot.addEventListener("change", syncMode);
    return () => {
      active = false;
      eventRoot.removeEventListener("change", syncMode);
    };
  }, [connector]);
  const propsRef = React.useRef(null);
  if (propsRef.current === null) propsRef.current = getEntry() || tlsDefaults(version);
  const props = propsRef.current;
  const commit = () => {
    if (getEntry() !== props) setEntry(props);
    onChange();
  };
  const [data, setData] = React.useState({
    localAliases: null,
    trustedAliases: null,
    protocols: null,
    ciphers: null,
    extMissing: false,
    localLoading: true
  });
  React.useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      api2.get(`${EXT2}/localCertificates`),
      api2.get(`${EXT2}/trustedCertificates`),
      api2.get("/server/protocolsAndCipherSuites")
    ]).then(([local, trusted, crypto2]) => {
      if (cancelled) return;
      const next = { localAliases: null, trustedAliases: null, protocols: null, ciphers: null, extMissing: false, localLoading: false };
      if (local.status === "fulfilled") {
        next.localAliases = certList(local.value).map((c) => String(c.alias ?? "")).filter(Boolean);
      } else if (notInstalled(local.reason)) {
        next.extMissing = true;
      }
      if (trusted.status === "fulfilled") {
        next.trustedAliases = certList(trusted.value).map((c) => String(c.alias ?? "")).filter(Boolean);
      }
      if (crypto2.status === "fulfilled") {
        const map = parseCryptoMap(crypto2.value);
        next.protocols = map.enabledServerProtocols || map.supportedProtocols || null;
        next.ciphers = map.enabledCipherSuites || map.supportedCipherSuites || null;
      }
      setData(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const aliasHint = () => data.extMissing ? "TLS Manager engine plugin not detected \u2014 enter the alias manually" : void 0;
  const enabled = (p) => asBool(p.isTlsManagerEnabled);
  function pickerMultiField(usedKey, defaultKey, label, getOptions, dialogTitle) {
    return {
      label,
      type: "custom",
      visible: enabled,
      render: (p, { onChange: onChange2 }) => {
        const summary = h("span", { style: { marginLeft: "8px", fontSize: "13px" } });
        const repaint = () => {
          const useDefault = asBool(p[defaultKey]);
          const list = setToList(p[usedKey]);
          summary.textContent = useDefault ? list.length ? `Server default (+${list.length} saved)` : "Server default" : list.length ? `${list.length} selected` : "None selected";
        };
        const btn = h("button.btn", { type: "button", style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, icon("settings"), "Edit\u2026");
        btn.addEventListener("click", () => openMultiPicker({
          title: dialogTitle,
          options: getOptions() || [],
          selected: setToList(p[usedKey]),
          useServerDefault: asBool(p[defaultKey]),
          onApply: ({ useServerDefault, selected }) => {
            p[defaultKey] = useServerDefault;
            p[usedKey] = listToSet(selected);
            onChange2();
            repaint();
          }
        }));
        repaint();
        return h("div", { style: { display: "flex", alignItems: "center" } }, btn, summary);
      }
    };
  }
  function certPickerField(key, label, hint) {
    if (!(data.localAliases && data.localAliases.length)) {
      return {
        key,
        label,
        type: "text",
        width: "260px",
        visible: enabled,
        onSet: (p, value) => {
          p[key] = value.trim() || null;
        },
        append: () => h("div.hint", aliasHint() || hint || "")
      };
    }
    return {
      label,
      type: "custom",
      visible: enabled,
      render: (p, { onChange: onChange2 }) => {
        const summary = h("span", { style: { marginLeft: "8px", fontSize: "13px" } });
        const repaint = () => {
          summary.textContent = p[key] ? String(p[key]) : "<None>";
        };
        const btn = h("button.btn", { type: "button", style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, icon("settings"), "Select\u2026");
        btn.addEventListener("click", () => openCertPicker({
          title: `${label} Picker`,
          aliases: data.localAliases || [],
          current: p[key] || "",
          onApply: (alias) => {
            p[key] = alias;
            onChange2();
            repaint();
          }
        }));
        repaint();
        return h(
          "div",
          { style: { display: "flex", alignItems: "center" } },
          btn,
          summary,
          hint ? h("span.hint", { style: { marginLeft: "10px" } }, hint) : null
        );
      }
    };
  }
  function serverCertificateField() {
    const aliases = [...new Set(data.localAliases || [])].sort((a, b) => a.localeCompare(b));
    const unavailable = data.localAliases === null;
    const message = data.localLoading ? "Loading server certificates\u2026" : data.extMissing ? "TLS Manager engine plugin not detected. Install it, then reopen these settings." : unavailable ? "Unable to load server certificates. Reopen these settings to retry." : !aliases.length ? "No local certificates available. Import a key pair in TLS Manager, then reopen these settings." : "Certificate presented to connecting clients (required)";
    return {
      label: "Server Certificate",
      type: "custom",
      visible: enabled,
      render: (p, { onChange: onChange2 }) => {
        const summary = h("span", { style: { marginLeft: "8px", fontSize: "13px" } });
        const repaint = () => {
          const alias = p.serverCertificateAlias;
          summary.textContent = alias ? `${alias}${!unavailable && !aliases.includes(alias) ? " (unavailable)" : ""}` : "None selected";
        };
        const btn = h("button.btn", {
          type: "button",
          disabled: unavailable || !aliases.length,
          "data-fkey": "serverCertificateAlias",
          style: { display: "inline-flex", alignItems: "center", gap: "6px" }
        }, icon("settings"), "Edit\u2026");
        btn.addEventListener("click", () => openCertPicker({
          title: "Server Certificate Picker",
          aliases,
          current: p.serverCertificateAlias || "",
          required: true,
          onApply: (alias) => {
            p.serverCertificateAlias = alias;
            onChange2();
            repaint();
          }
        }));
        repaint();
        return h(
          "div",
          h("div", { style: { display: "flex", alignItems: "center" } }, btn, summary),
          h("div.hint", message)
        );
      }
    };
  }
  function fieldDefs() {
    const trustPickerField = (visible, label) => ({
      label,
      type: "custom",
      visible,
      render: (p, { onChange: onChange2 }) => {
        const summary = h("span", { style: { marginLeft: "8px", fontSize: "13px" } });
        const repaint = () => {
          const certs = setToList(p.trustedServerCertificates);
          const parts = [];
          if (asBool(p.trustSystemTruststore)) parts.push("System Truststore");
          if (certs.length) parts.push(`${certs.length} certificate${certs.length === 1 ? "" : "s"}`);
          summary.textContent = parts.length ? parts.join(" + ") : "None";
        };
        const btn = h("button.btn", { type: "button", style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, icon("settings"), "Edit\u2026");
        btn.addEventListener("click", () => openTrustPicker({
          title: "Certificate Picker",
          aliases: data.trustedAliases || [],
          extMissing: data.extMissing,
          trustSystemTruststore: asBool(p.trustSystemTruststore),
          selected: setToList(p.trustedServerCertificates),
          onApply: ({ trustSystemTruststore, selected }) => {
            p.trustSystemTruststore = trustSystemTruststore;
            p.trustedServerCertificates = listToSet(selected);
            onChange2();
            repaint();
          }
        }));
        repaint();
        const hint = data.extMissing ? h("div.hint", { style: { marginTop: "4px" } }, "TLS Manager engine plugin not detected \u2014 add truststore aliases in the picker") : null;
        return h("div", h("div", { style: { display: "flex", alignItems: "center" } }, btn, summary), hint);
      }
    });
    return [
      {
        key: "isTlsManagerEnabled",
        label: "Use TLS Manager",
        type: "radio",
        options: YES_NO,
        refresh: true,
        hint: connector.transportName.startsWith("TCP") ? `Settings follow the connector's Mode (currently ${server ? "Server" : "Client"})` : void 0
      },
      { section: "Certificate Validation", visible: enabled },
      {
        key: "subjectDnValidationMode",
        label: "Subject DN Validation",
        type: "select",
        options: SUBJECT_DN_MODES,
        refresh: true,
        visible: enabled
      },
      {
        key: "subjectDnValidationFilter",
        label: "Subject DN Filter",
        width: "320px",
        visible: (p) => enabled(p) && p.subjectDnValidationMode !== "NONE",
        hint: "Required when Subject DN validation is Partial or Exact"
      },
      { key: "crlMode", label: "CRL Checking", type: "select", options: REVOCATION_MODES, visible: enabled },
      { key: "ocspMode", label: "OCSP Checking", type: "select", options: REVOCATION_MODES, visible: enabled },
      { section: "Protocols & Ciphers", visible: enabled },
      pickerMultiField(
        "usedProtocols",
        "isUseServerDefaultProtocols",
        "Enabled Protocols",
        () => data.protocols || FALLBACK_PROTOCOLS,
        "Protocols Picker"
      ),
      pickerMultiField(
        "usedCiphers",
        "isUseServerDefaultCiphers",
        "Enabled Ciphers",
        () => data.ciphers || [],
        "Ciphers Picker"
      ),
      /* client mode (sender side) */
      ...server ? [] : [
        { section: "Server Trust", visible: enabled },
        trustPickerField(enabled, "Trusted Server Certificates"),
        {
          key: "isHostnameVerificationEnabled",
          label: "Hostname Verification",
          type: "radio",
          options: YES_NO,
          visible: enabled
        },
        certPickerField(
          "clientCertificateAlias",
          "Client Certificate",
          "Presented when the server requests client authentication"
        )
      ],
      /* server mode (listener side) */
      ...server ? [
        { section: "Server Identity", visible: enabled },
        serverCertificateField(),
        {
          key: "clientAuthMode",
          label: "Client Authentication",
          type: "radio",
          options: CLIENT_AUTH_MODES,
          refresh: true,
          visible: enabled
        },
        trustPickerField((p) => enabled(p) && p.clientAuthMode !== "NONE", "Trusted Client Certificates")
      ] : []
    ];
  }
  return /* @__PURE__ */ React.createElement("div", { ref: formRef }, /* @__PURE__ */ React.createElement(ConnectorForm, { properties: props, fields: fieldDefs(), onChange: commit }));
}
var tlsPanel = {
  id: "tls-manager",
  title: "TLS Settings",
  // getSettingsTitle()
  order: 50,
  propertiesClass: FQCN,
  // one class for all six transports (see header)
  isSupported: (transportName) => SUPPORTED_TRANSPORTS.includes(transportName),
  defaults: (version) => tlsDefaults(version),
  component: TlsConnectorPanel
};
function certStatus(cert) {
  if (!cert || cert.parsedCertificate && cert.parsedCertificate.error) return { label: "Invalid", pip: "err" };
  const now = Date.now();
  const to = cert.validTo && cert.validTo !== "Unknown" ? Date.parse(cert.validTo) : NaN;
  const from = cert.validFrom && cert.validFrom !== "Unknown" ? Date.parse(cert.validFrom) : NaN;
  if (!Number.isNaN(from) && from > now) return { label: "Not Yet Valid", pip: "warn" };
  if (!Number.isNaN(to) && to < now) return { label: "Expired", pip: "err" };
  if (!Number.isNaN(to) && to - now < 30 * 24 * 3600 * 1e3) return { label: "Expiring Soon", pip: "warn" };
  return { label: "Valid", pip: "ok" };
}
var STORE_TABS = [
  { key: "native", label: "Native Java Store", readonly: true },
  { key: "trusted", label: "Trusted Certificates", readonly: false },
  { key: "private", label: "Local Key Pairs", readonly: false }
];
function certTableEl(certs, store, act) {
  if (!certs.length) return /* @__PURE__ */ React.createElement("div", { className: "dt-empty", style: { padding: "24px" } }, "No certificates in this store.");
  return /* @__PURE__ */ React.createElement("table", { className: "dt" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", { style: { width: "130px" } }, "Status"), /* @__PURE__ */ React.createElement("th", null, "Alias"), /* @__PURE__ */ React.createElement("th", null, "Subject"), /* @__PURE__ */ React.createElement("th", { style: { width: "150px" } }, "Type"), /* @__PURE__ */ React.createElement("th", { style: { width: "110px" } }, "Expires"), /* @__PURE__ */ React.createElement("th", { style: { width: "60px" } }, "In Use"), /* @__PURE__ */ React.createElement("th", { style: { width: "1px" } }))), /* @__PURE__ */ React.createElement("tbody", null, certs.map((c) => {
    const s = certStatus(c);
    return /* @__PURE__ */ React.createElement("tr", { key: c.store + ":" + c.alias }, /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "status-cell" }, /* @__PURE__ */ React.createElement("span", { className: "pip " + s.pip }), " ", s.label)), /* @__PURE__ */ React.createElement("td", null, c.alias), /* @__PURE__ */ React.createElement("td", { title: c.subject, style: { maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name), /* @__PURE__ */ React.createElement("td", null, c.type), /* @__PURE__ */ React.createElement("td", { className: "num" }, c.validTo), /* @__PURE__ */ React.createElement("td", { className: "num" }, (c.channelsInUse || []).length || ""), /* @__PURE__ */ React.createElement("td", { style: { whiteSpace: "nowrap", textAlign: "right" } }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm", onClick: () => act.openDetails(c) }, "Details"), store !== "native" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm", disabled: !act.canWrite, onClick: () => act.editAlias(c) }, "Edit"), store !== "native" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm btn-danger", disabled: !act.canWrite, onClick: () => act.removeCert(c) }, "Delete")));
  })));
}
var toCertPem = (v) => v && /-----BEGIN/.test(v) ? v : v ? base64ToPem(v) : v;
var toKeyPem = (v) => v && /-----BEGIN/.test(v) ? v : v ? base64ToPrivateKeyPem(v) : v;
function chip(text, opts) {
  return h("span", {
    style: Object.assign({
      display: "inline-block",
      padding: "1px 9px",
      margin: "2px",
      fontSize: "12px",
      border: "1px solid var(--line)",
      borderRadius: "11px",
      background: "var(--bg2)",
      wordBreak: "break-all"
    }, opts && opts.style)
  }, text);
}
function sanChipsNode(san) {
  if (!san) return null;
  const groups = [
    ["DNS Names", san.dns],
    ["IP Addresses", san.ip],
    ["URIs", san.uri],
    ["Email Addresses", san.email],
    ["Distinguished Names", san.dn]
  ].filter(([, list]) => Array.isArray(list) && list.length);
  if (!groups.length) return null;
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    groups.map(([label, list]) => h(
      "div",
      h("div.text-text-faint", { style: { fontSize: "11px", marginBottom: "2px" } }, label),
      h("div", list.map((v) => chip(v)))
    ))
  );
}
function extensionsNode(extensions) {
  if (!Array.isArray(extensions) || !extensions.length) return null;
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    extensions.map((ext) => h(
      "div",
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "6px" } },
        h("strong", { style: { fontSize: "13px" } }, ext.name || "Extension"),
        ext.critical ? chip("Critical", { style: { borderColor: "var(--warn)", color: "var(--warn)" } }) : null
      ),
      ext.names && ext.names.length ? h("div.text-text-faint", { style: { fontSize: "12px", marginLeft: "4px", wordBreak: "break-all" } }, ext.names.join(", ")) : null
    ))
  );
}
function statusIcon(ok, size) {
  size = size || 18;
  const span = document.createElement("span");
  span.style.cssText = `display:inline-flex;flex:0 0 auto;color:${ok ? "var(--ok)" : "var(--err)"}`;
  span.innerHTML = ok ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.2 12.4l3 3 6.4-6.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  return span;
}
function chevronIcon(open) {
  const span = document.createElement("span");
  span.style.cssText = `display:inline-flex;flex:0 0 auto;color:var(--text-faint);transition:transform .15s;transform:${open ? "rotate(180deg)" : "none"}`;
  span.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" style="display:block"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return span;
}
function tintBox(tone, children, extra) {
  return h("div", {
    style: Object.assign({
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "6px",
      background: `color-mix(in srgb, var(--${tone}) 12%, transparent)`,
      border: `1px solid color-mix(in srgb, var(--${tone}) 35%, transparent)`,
      color: `color-mix(in srgb, var(--${tone}) 70%, var(--text))`
    }, extra)
  }, children);
}
function optionRow({ name, checked, primary, secondary, badge, onSelect }) {
  const radio = h("input", { type: "radio", name, checked, style: { accentColor: "var(--accent)", flex: "0 0 auto" } });
  const row = h(
    "label",
    {
      style: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", cursor: "pointer", border: "1px solid var(--line)", borderRadius: "6px" }
    },
    radio,
    h(
      "div",
      { style: { flex: "1", minWidth: "0" } },
      h("div", { style: { fontWeight: "600", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, primary || "\u2014"),
      secondary ? h("div.text-text-faint", { style: { fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, secondary) : null
    ),
    badge ? chip(badge, { style: { borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)", color: "var(--accent)" } }) : null
  );
  const paint = () => {
    row.style.borderColor = radio.checked ? "var(--accent)" : "var(--line)";
    row.style.background = radio.checked ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent";
  };
  radio.addEventListener("change", () => {
    if (radio.checked) onSelect && onSelect();
    paint();
  });
  paint();
  return { el: row, radio, paint };
}
function renderVerification(container, res) {
  clear(container);
  if (!res) return;
  if (!res.success) {
    container.appendChild(tintBox("err", [statusIcon(false, 18), h("span", { style: { fontWeight: "500" } }, res.error || "Certificate verification failed")]));
    return;
  }
  container.appendChild(tintBox("ok", [statusIcon(true, 18), h("span", { style: { fontWeight: "500" } }, "Certificate verification completed successfully")], { marginBottom: "10px" }));
  const card = (ok, titleText, bodyNode, openByDefault) => {
    const hasIcon = ok !== null;
    const body = h("div", { style: { padding: hasIcon ? "0 14px 12px 46px" : "0 14px 12px 14px", display: openByDefault ? "block" : "none" } }, bodyNode);
    const caret = chevronIcon(openByDefault);
    const head = h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "11px 14px" } },
      hasIcon ? statusIcon(ok, 20) : null,
      h("span", { style: { fontWeight: "600", fontSize: "14px", flex: "1" } }, titleText),
      caret
    );
    head.addEventListener("click", () => {
      const show = body.style.display === "none";
      body.style.display = show ? "block" : "none";
      caret.style.transform = show ? "rotate(180deg)" : "none";
    });
    return h("div", { style: { border: "1px solid var(--line)", borderRadius: "8px", marginTop: "10px", overflow: "hidden" } }, head, body);
  };
  const group = (label, items, tone) => h(
    "div",
    { style: { marginBottom: "8px" } },
    h("div", { style: { fontWeight: "600", fontSize: "12px", marginBottom: "3px", color: tone ? `var(--${tone})` : "var(--text-dim)" } }, label),
    h("ul", { style: { margin: "0", paddingLeft: "18px", fontSize: "13px", lineHeight: "1.55" } }, items.map((m) => h("li", m)))
  );
  const cv = res.chainValidation;
  if (cv) {
    const parts = [];
    if (cv.errors && cv.errors.length) parts.push(group("Errors", cv.errors, "err"));
    if (cv.warnings && cv.warnings.length) parts.push(group("Warnings", cv.warnings, "warn"));
    if (cv.details && cv.details.length) parts.push(group("Details", cv.details));
    container.appendChild(card(
      cv.isValid,
      "Chain Validation " + (cv.isValid ? "Passed" : "Failed"),
      parts.length ? parts : h("div.text-text-faint", { style: { fontSize: "13px" } }, "No issues found."),
      true
    ));
  }
  const kv = res.keyValidation;
  if (kv) {
    container.appendChild(card(
      kv.isValid,
      "Private Key Validation " + (kv.isValid ? "Passed" : "Failed"),
      tintBox(kv.isValid ? "ok" : "err", [statusIcon(kv.isValid, 16), h("span", kv.message || "")]),
      true
    ));
  }
  if (res.chainDetails && res.chainDetails.length > 1) {
    const rows = res.chainDetails.map((c, i) => h(
      "div",
      { style: { padding: "6px 0", fontSize: "13px", borderTop: i ? "1px solid var(--line)" : "none" } },
      h("div", { style: { fontWeight: "600" } }, `${c.type} (Certificate #${c.index})`),
      h("div.text-text-faint", `Subject: ${c.subject}`),
      h("div.text-text-faint", `Issuer: ${c.issuer}`),
      h("div.text-text-faint", `Valid: ${c.validFrom} \u2013 ${c.validTo}`)
    ));
    container.appendChild(card(null, `Certificate Chain (${res.chainDetails.length} certificates)`, rows, false));
  }
}
function TlsManagerPanel() {
  const cfg = platform.store.getState("webadminConfig") || {};
  const engineUrl = String(cfg.engineUrl || "").replace(/\/+$/, "");
  const [version, setVersion] = React.useState("");
  const [tab, setTab] = React.useState("trusted");
  const [phase, setPhase] = React.useState("loading");
  const [, force] = React.useReducer((x) => x + 1, 0);
  const storesRef = React.useRef({ native: [], trusted: [], private: [] });
  const storeStateRef = React.useRef(Object.fromEntries(STORE_TABS.map(({ key }) => [key, { status: "loading", error: "" }])));
  const mountedRef = React.useRef(false);
  const loadRequestRef = React.useRef(0);
  const writePendingRef = React.useRef(false);
  const verificationRequestsRef = React.useRef(/* @__PURE__ */ new WeakMap());
  async function loadAll() {
    if (!mountedRef.current || writePendingRef.current) return;
    const request = ++loadRequestRef.current;
    for (const { key } of STORE_TABS) storeStateRef.current[key] = { status: "loading", error: "" };
    setPhase("loading");
    const results = await Promise.allSettled([fetchSystemCertificates(), fetchTrustedCertificates(), fetchLocalCertificates()]);
    if (!mountedRef.current || request !== loadRequestRef.current) return;
    STORE_TABS.forEach(({ key, label }, index) => {
      const result = results[index];
      if (result.status === "fulfilled") {
        storesRef.current[key] = result.value;
        storeStateRef.current[key] = { status: "ready", error: "" };
      } else {
        storeStateRef.current[key] = {
          status: "error",
          error: `Unable to load ${label}. ${result.reason?.message || "The request failed."} Refresh successfully before making changes.`
        };
      }
    });
    const missing = results.every((r) => r.status === "rejected" && r.reason && (r.reason.status === 404 || r.reason.status === 501));
    setPhase(missing ? "missing" : "ready");
    force();
  }
  const refresh = () => loadAll();
  React.useEffect(() => {
    mountedRef.current = true;
    loadAll();
    let active = true;
    api2.get("/extensions/plugins").then((raw) => {
      if (!active) return;
      for (const e of api2.asList(raw && raw.entry)) {
        if (!e || typeof e !== "object") continue;
        const name = Array.isArray(e.string) ? e.string[0] : e.string;
        const meta = e.pluginMetaData || Object.values(e).find((v) => v && typeof v === "object" && v.pluginVersion);
        if (String(name) === "TLS Manager" && meta && meta.pluginVersion) {
          setVersion(String(meta.pluginVersion));
          return;
        }
      }
    }).catch(() => {
    });
    return () => {
      active = false;
      mountedRef.current = false;
      ++loadRequestRef.current;
    };
  }, []);
  function writableStore(store, expected) {
    const state = storeStateRef.current[store];
    if (mountedRef.current && !writePendingRef.current && state?.status === "ready" && (!expected || expected === state)) return state;
    if (mountedRef.current) toast2("The certificate store changed or is unavailable. Refresh and try again.", "warn");
    return null;
  }
  async function writeStore(store, expected, operation, successMessage, failureMessage) {
    if (!writableStore(store, expected)) return false;
    writePendingRef.current = true;
    storeStateRef.current[store] = { status: "saving", error: "" };
    force();
    let succeeded = false;
    try {
      await operation(storesRef.current[store]);
      succeeded = true;
      if (mountedRef.current) toast2(successMessage, "success");
    } catch (e) {
      storeStateRef.current[store] = { status: "error", error: "The save could not be confirmed. Refresh successfully before making changes." };
      if (mountedRef.current) toast2(e.message || failureMessage, "error");
    } finally {
      writePendingRef.current = false;
    }
    if (mountedRef.current) {
      if (succeeded) await refresh();
      else force();
    }
    return succeeded;
  }
  const detailRow = (label, value, mono) => h(
    "div",
    { style: { display: "grid", gridTemplateColumns: "170px 1fr", gap: "8px", padding: "3px 0", alignItems: "baseline" } },
    h("div.text-text-faint", { style: { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" } }, label),
    value instanceof Node ? h("div", value) : h("div", mono ? { className: "mono", style: { fontSize: "12px", wordBreak: "break-all" } } : {}, value == null || value === "" ? "\u2014" : String(value))
  );
  function openDetails(cert) {
    const p = cert.parsedCertificate || {};
    const san = p.subjectAltNames || {};
    const s = certStatus(cert);
    const body = h("div", { style: { width: "70vw", maxWidth: "820px", maxHeight: "70vh", overflow: "auto" } });
    body.appendChild(h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
      h("strong", { style: { fontSize: "15px" } }, cert.alias),
      h("span", { style: { fontSize: "12px", fontWeight: "600", padding: "2px 12px", borderRadius: "11px", color: "#fff", background: `var(--${s.pip})` } }, s.label)
    ));
    body.appendChild(detailRow("Type", cert.type));
    body.appendChild(detailRow("Store", cert.store));
    body.appendChild(detailRow("Has private key", cert.hasPrivateKey ? "Yes" : "No"));
    body.appendChild(detailRow("Subject", cert.subject, true));
    const sanNode = sanChipsNode(san);
    if (sanNode) body.appendChild(detailRow("Subject Alt Names", sanNode));
    body.appendChild(detailRow("Issuer", cert.issuer, true));
    body.appendChild(detailRow("Valid from", cert.validFrom));
    body.appendChild(detailRow("Valid to", cert.validTo));
    body.appendChild(detailRow("SHA-1 fingerprint", cert.fingerprintSha1 ? cert.fingerprintSha1.replace(/(..)(?=.)/g, "$1:").toUpperCase() : "", true));
    const extNode = extensionsNode(p.extensions);
    if (extNode) body.appendChild(detailRow("Extensions", extNode));
    if (cert.channelsInUse && cert.channelsInUse.length) body.appendChild(detailRow("In use by channels", cert.channelsInUse.join(", ")));
    const pem = h("pre.mono", { style: { display: "none", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--bg2)", padding: "8px", borderRadius: "4px", maxHeight: "220px", overflow: "auto" } }, cert.rawCertificate || "");
    const pemToggle = h("a", { href: "#", style: { color: "var(--accent)" }, onClick: (e) => {
      e.preventDefault();
      pem.style.display = pem.style.display === "none" ? "block" : "none";
    } }, "Show / hide raw certificate (PEM)");
    body.appendChild(h("div", { style: { marginTop: "10px" } }, pemToggle, pem));
    if (cert.hasPrivateKey && cert.rawPrivateKey) {
      const key = h("pre.mono", { style: { display: "none", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--bg2)", padding: "8px", borderRadius: "4px", maxHeight: "180px", overflow: "auto" } }, cert.rawPrivateKey);
      const keyToggle = h("a", { href: "#", style: { color: "var(--accent)" }, onClick: (e) => {
        e.preventDefault();
        key.style.display = key.style.display === "none" ? "block" : "none";
      } }, "Show / hide private key");
      body.appendChild(h("div", { style: { marginTop: "8px" } }, keyToggle, key));
    }
    const verifyOut = h("div", { style: { marginTop: "10px" } });
    const verifyBtn = h("button.btn", { type: "button" }, "Verify Certificate");
    verifyBtn.addEventListener("click", async () => {
      verifyBtn.disabled = true;
      clear(verifyOut);
      verifyOut.appendChild(h("div.text-text-faint", { style: { fontSize: "12px" } }, "Verifying\u2026"));
      try {
        const res = await verifyCertificate(toCertPem(cert.rawCertificate), cert.rawPrivateKey ? toKeyPem(cert.rawPrivateKey) : null);
        if (mountedRef.current && verifyOut.isConnected) renderVerification(verifyOut, res);
      } catch (err) {
        if (mountedRef.current && verifyOut.isConnected) renderVerification(verifyOut, { success: false, error: "Verification failed: " + err.message });
      } finally {
        verifyBtn.disabled = false;
      }
    });
    body.appendChild(h(
      "div",
      { style: { marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" } },
      h("strong", { style: { fontSize: "13px" } }, "Certificate Verification"),
      verifyBtn
    ));
    body.appendChild(verifyOut);
    modal({ title: `Certificate \u2014 ${cert.alias}`, body, size: "wide", buttons: [{ label: "Close", primary: true }] });
  }
  function confirmReplace(alias, store) {
    const existing = (storesRef.current[store] || []).find((c) => (c.alias || "").toLowerCase() === alias.toLowerCase());
    const chans = existing && existing.channelsInUse && existing.channelsInUse.length ? existing.channelsInUse : null;
    let msg = `A certificate with the alias "${alias}" already exists in the ${store} store. This will replace the existing certificate. Are you sure you want to continue?`;
    if (chans) msg += `

The existing certificate is used by ${chans.length} channel(s): ${chans.join(", ")}. Replacing it may affect those channels.`;
    return confirmDialog("Replace Existing Certificate", msg, { okLabel: "Replace Certificate" });
  }
  async function editAlias(cert) {
    const state = writableStore(cert.store);
    if (!state || !storesRef.current[cert.store].includes(cert)) return;
    const next = await promptDialog("Edit Alias", "Certificate alias", cert.alias);
    if (next == null) return;
    if (!writableStore(cert.store, state)) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === cert.alias) return;
    const lower = trimmed.toLowerCase();
    const collides = (storesRef.current[cert.store] || []).some((c) => (c.alias || "").toLowerCase() === lower && (c.alias || "").toLowerCase() !== cert.alias.toLowerCase());
    if (collides && !await confirmReplace(trimmed, cert.store)) return;
    await writeStore(cert.store, state, (current) => updateCertificateAlias(cert.store, cert.alias, trimmed, current), "Alias updated", "Failed to update alias");
  }
  async function removeCert(cert) {
    const state = writableStore(cert.store);
    if (!state || !storesRef.current[cert.store].includes(cert)) return;
    const inUse = cert.channelsInUse && cert.channelsInUse.length;
    const msg = inUse ? `"${cert.alias}" is used by ${inUse} channel(s): ${cert.channelsInUse.join(", ")}. Removing it may break TLS on those channels. Continue?` : `Remove "${cert.alias}"? This cannot be undone.`;
    if (!await confirmDialog("Remove Certificate", msg, { danger: true, okLabel: "Remove" })) return;
    await writeStore(cert.store, state, (current) => removeCertificate(cert.store, cert.alias, current), "Certificate removed", "Failed to remove certificate");
  }
  async function verifyInto(out, pem, key) {
    const request = {};
    verificationRequestsRef.current.set(out, request);
    pem = (pem || "").trim();
    key = (key || "").trim();
    clear(out);
    if (!pem || !isValidPemCertificate(pem)) return;
    out.appendChild(h("div.text-text-faint", { style: { fontSize: "12px" } }, "Verifying\u2026"));
    let res;
    try {
      res = await verifyCertificate(pem, key || null);
    } catch (e) {
      res = { success: false, error: e.message };
    }
    if (mountedRef.current && out.isConnected && verificationRequestsRef.current.get(out) === request) {
      renderVerification(out, res);
    }
  }
  function openImportFile(store) {
    if (!writableStore(store)) return;
    const aliasInput = textInput("", { placeholder: "Alias", style: { width: "240px" } });
    const pemArea = h("textarea", { rows: 6, placeholder: "-----BEGIN CERTIFICATE-----", style: { width: "100%", fontFamily: "var(--font-mono)", fontSize: "12px" } });
    const keyArea = store === "private" ? h("textarea", { rows: 5, placeholder: "-----BEGIN PRIVATE KEY-----", style: { width: "100%", fontFamily: "var(--font-mono)", fontSize: "12px" } }) : null;
    const verifyOut = h("div", { style: { marginTop: "2px" } });
    const reverify = () => verifyInto(verifyOut, pemArea.value, keyArea ? keyArea.value : null);
    let autoAlias = "";
    let aliasRevision = 0;
    async function suggestAlias() {
      const request = ++aliasRevision;
      const typed = aliasInput.value.trim();
      if (typed !== "" && typed !== autoAlias) return;
      const pem = pemArea.value.trim();
      if (!pem || !isValidPemCertificate(pem)) return;
      let suggested = null;
      try {
        suggested = getSuggestedAlias(await parseCertificate(pem));
      } catch {
      }
      if (!mountedRef.current || !aliasInput.isConnected || request !== aliasRevision || pemArea.value.trim() !== pem || aliasInput.value.trim() !== typed) return;
      if (suggested) {
        aliasInput.value = suggested;
        autoAlias = suggested;
      }
    }
    const pickCert = h("button.btn.btn-sm", { type: "button" }, "Choose file\u2026");
    pickCert.addEventListener("click", async () => {
      const f = await pickFile(".pem,.crt,.cer");
      if (f) {
        pemArea.value = String(f.content || "");
        reverify();
        suggestAlias();
      }
    });
    pemArea.addEventListener("input", () => {
      reverify();
      suggestAlias();
    });
    const pickKey = keyArea ? h("button.btn.btn-sm", { type: "button" }, "Choose key file\u2026") : null;
    if (pickKey) pickKey.addEventListener("click", async () => {
      const f = await pickFile(".pem,.key");
      if (f) {
        keyArea.value = String(f.content || "");
        reverify();
      }
    });
    if (keyArea) keyArea.addEventListener("input", reverify);
    const body = h(
      "div",
      { style: { minWidth: "520px", display: "flex", flexDirection: "column", gap: "8px" } },
      h("label", "Alias"),
      aliasInput,
      h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, h("label", { style: { flex: "1" } }, "Certificate (PEM)"), pickCert),
      pemArea,
      keyArea ? h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, h("label", { style: { flex: "1" } }, "Private key (PEM)"), pickKey) : null,
      keyArea,
      verifyOut
    );
    modal({
      title: store === "private" ? "Import Key Pair" : "Import Trusted Certificate",
      body,
      size: "wide",
      buttons: [{ label: "Cancel" }, {
        label: "Import",
        primary: true,
        onClick: async () => {
          const state = writableStore(store);
          if (!state) return false;
          const alias = aliasInput.value.trim();
          const pemText = pemArea.value.trim();
          const privateKeyText = keyArea ? keyArea.value.trim() : void 0;
          if (!alias) {
            toast2("Alias is required", "warn");
            return false;
          }
          if (!isValidPemCertificate(pemText)) {
            toast2("Not a valid PEM certificate", "error");
            return false;
          }
          if (store === "private" && !isValidPemPrivateKey(privateKeyText)) {
            toast2("Not a valid PEM private key", "error");
            return false;
          }
          const stillCurrent = () => body.isConnected && mountedRef.current && aliasInput.value.trim() === alias && pemArea.value.trim() === pemText && (keyArea ? keyArea.value.trim() : void 0) === privateKeyText;
          let res;
          try {
            res = await verifyCertificate(pemText, privateKeyText || null);
          } catch (e) {
            res = { success: false, error: e.message };
          }
          if (!stillCurrent()) return false;
          if (!res.success && !await confirmDialog("Verification failed", (res.error || "Certificate verification failed") + "\n\nImport anyway?", { danger: true, okLabel: "Import anyway" })) return false;
          if (!stillCurrent() || !writableStore(store, state)) return false;
          if (storesRef.current[store].some((c) => (c.alias || "").toLowerCase() === alias.toLowerCase()) && !await confirmReplace(alias, store)) return false;
          if (!stillCurrent()) return false;
          return writeStore(store, state, (current) => updateCertificates(store, { alias, pemText, privateKeyText }, current), "Imported", "Import failed");
        }
      }]
    });
  }
  function openImportUrl() {
    if (!writableStore("trusted")) return;
    const urlInput = textInput("https://", { style: { flex: "1" } });
    const aliasInput = textInput("", { placeholder: "Alias", style: { width: "240px" } });
    const heading = h("div", { style: { fontWeight: "600", fontSize: "13px", display: "none" } }, "Select a certificate to import");
    const listWrap = h("div", { style: { flexDirection: "column", gap: "6px", maxHeight: "260px", overflow: "auto", display: "none" } });
    const verifyOut = h("div", { style: { marginTop: "2px" } });
    let chosen = null;
    let selectedUrl = null;
    let requestRevision = 0;
    let pending = false;
    let closed = false;
    const rows = [];
    const choose = (c) => {
      chosen = c;
      if (c.alias) aliasInput.value = c.alias;
      verifyInto(verifyOut, toCertPem(c.certificate), null);
    };
    const fetchBtn = h("button.btn.btn-sm", { type: "button" }, "Fetch");
    function invalidateSelection() {
      ++requestRevision;
      chosen = null;
      selectedUrl = null;
      pending = false;
      rows.length = 0;
      clear(listWrap);
      verifyInto(verifyOut, "");
      heading.style.display = "none";
      listWrap.style.display = "none";
      aliasInput.value = "";
      fetchBtn.disabled = false;
      fetchBtn.textContent = "Fetch";
    }
    urlInput.addEventListener("input", invalidateSelection);
    fetchBtn.addEventListener("click", async () => {
      if (closed || !mountedRef.current || pending) return;
      const url = urlInput.value.trim();
      invalidateSelection();
      const request = requestRevision;
      const isCurrent = () => !closed && mountedRef.current && request === requestRevision && urlInput.value.trim() === url;
      pending = true;
      fetchBtn.disabled = true;
      fetchBtn.textContent = "Fetching\u2026";
      try {
        const certs = await fetchRemoteCertificates(url);
        if (!isCurrent()) return;
        selectedUrl = url;
        heading.style.display = certs.length ? "block" : "none";
        listWrap.style.display = certs.length ? "flex" : "none";
        const name = "tlsremote-" + Math.random().toString(36).slice(2);
        certs.forEach((c, i) => {
          const row = optionRow({
            name,
            checked: i === 0,
            primary: c.alias || c.name || c.subject,
            secondary: c.subject,
            badge: c.type && c.type !== "Unknown" ? c.type : null,
            onSelect: () => {
              if (isCurrent()) {
                choose(c);
                rows.forEach((r) => r.paint());
              }
            }
          });
          rows.push(row);
          listWrap.appendChild(row.el);
        });
        if (certs.length) choose(certs[0]);
        else toast2("No certificates returned", "warn");
      } catch (e) {
        if (isCurrent()) toast2(e.message || "Fetch failed", "error");
      } finally {
        if (isCurrent()) {
          pending = false;
          fetchBtn.disabled = false;
          fetchBtn.textContent = "Fetch";
        }
      }
    });
    const body = h(
      "div",
      { style: { minWidth: "560px", display: "flex", flexDirection: "column", gap: "8px" } },
      h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, h("label", "URL"), urlInput, fetchBtn),
      heading,
      listWrap,
      h("label", "Alias"),
      aliasInput,
      verifyOut
    );
    modal({
      title: "Import Certificate from URL",
      body,
      size: "wide",
      onClose: () => {
        closed = true;
        ++requestRevision;
      },
      buttons: [{ label: "Cancel" }, {
        label: "Import",
        primary: true,
        onClick: async () => {
          const state = writableStore("trusted");
          if (!state) return false;
          if (closed || pending || !chosen || selectedUrl !== urlInput.value.trim()) {
            toast2("Fetch and select a certificate for the current URL first", "warn");
            return false;
          }
          const selected = chosen;
          const request = requestRevision;
          const url = selectedUrl;
          const alias = aliasInput.value.trim();
          if (!alias) {
            toast2("Alias is required", "warn");
            return false;
          }
          const stillSelected = () => {
            if (!closed && !pending && request === requestRevision && chosen === selected && urlInput.value.trim() === url && aliasInput.value.trim() === alias) return true;
            if (!closed && mountedRef.current) toast2("The URL or certificate selection changed. Fetch and select a certificate again.", "warn");
            return false;
          };
          const pemText = selected.certificate;
          let res;
          try {
            res = await verifyCertificate(toCertPem(pemText), null);
          } catch (e) {
            res = { success: false, error: e.message };
          }
          if (!stillSelected() || !writableStore("trusted", state)) return false;
          if (!res.success && !await confirmDialog("Verification failed", (res.error || "Certificate verification failed") + "\n\nImport anyway?", { danger: true, okLabel: "Import anyway" })) return false;
          if (!stillSelected() || !writableStore("trusted", state)) return false;
          if (storesRef.current.trusted.some((c) => (c.alias || "").toLowerCase() === alias.toLowerCase()) && !await confirmReplace(alias, "trusted")) return false;
          if (!stillSelected()) return false;
          return writeStore("trusted", state, (current) => updateCertificates("trusted", { alias, pemText }, current), "Imported", "Import failed");
        }
      }]
    });
  }
  function openImportChain() {
    if (!writableStore("trusted")) return;
    const aliasInput = textInput("", { placeholder: "Alias", style: { width: "240px" } });
    const pemArea = h("textarea", { rows: 6, placeholder: "-----BEGIN CERTIFICATE-----\n\u2026\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\n\u2026", style: { width: "100%", fontFamily: "var(--font-mono)", fontSize: "12px" } });
    const foundMsg = h("div.hint", { style: { display: "none" } });
    const listWrap = h("div", { style: { flexDirection: "column", gap: "6px", maxHeight: "220px", overflow: "auto", display: "none" } });
    const verifyOut = h("div", { style: { marginTop: "2px" } });
    let parsed = [];
    let chosen = null;
    let parseRevision = 0;
    const rows = [];
    const pickCert = h("button.btn.btn-sm", { type: "button" }, "Choose file\u2026");
    const choose = (c) => {
      chosen = c;
      if (c.alias) aliasInput.value = c.alias;
      verifyInto(verifyOut, c.certificate, null);
    };
    async function reparse() {
      const request = ++parseRevision;
      const text = pemArea.value.trim();
      clear(listWrap);
      verifyInto(verifyOut, "");
      rows.length = 0;
      chosen = null;
      listWrap.style.display = "none";
      if (!text) {
        foundMsg.style.display = "none";
        listWrap.style.display = "none";
        return;
      }
      foundMsg.style.display = "block";
      foundMsg.textContent = "Parsing certificates\u2026";
      const result = await parseCertificateChainFromPem(text);
      if (!mountedRef.current || !pemArea.isConnected || request !== parseRevision || pemArea.value.trim() !== text) return;
      parsed = result;
      if (!parsed.length) {
        foundMsg.textContent = "No valid certificates found in the provided text";
        listWrap.style.display = "none";
        return;
      }
      foundMsg.textContent = `Found ${parsed.length} certificate${parsed.length > 1 ? "s" : ""} in the chain`;
      listWrap.style.display = "flex";
      const name = "tlschain-" + Math.random().toString(36).slice(2);
      parsed.forEach((c, i) => {
        const row = optionRow({
          name,
          checked: i === 0,
          primary: c.alias || c.name || c.subject || "Certificate #" + (i + 1),
          secondary: c.subject,
          badge: c.type && c.type !== "Unknown" ? c.type : null,
          onSelect: () => {
            choose(c);
            rows.forEach((r) => r.paint());
          }
        });
        rows.push(row);
        listWrap.appendChild(row.el);
      });
      choose(parsed[0]);
    }
    pemArea.addEventListener("input", reparse);
    pickCert.addEventListener("click", async () => {
      const f = await pickFile(".pem,.crt,.cer");
      if (f) {
        pemArea.value = String(f.content || "");
        reparse();
      }
    });
    const body = h(
      "div",
      { style: { minWidth: "560px", display: "flex", flexDirection: "column", gap: "8px" } },
      h("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, h("label", { style: { flex: "1" } }, "Certificate chain (PEM)"), pickCert),
      pemArea,
      foundMsg,
      listWrap,
      h("label", "Alias"),
      aliasInput,
      verifyOut
    );
    modal({
      title: "Import Certificate Chain",
      body,
      size: "wide",
      buttons: [{ label: "Cancel" }, {
        label: "Import",
        primary: true,
        onClick: async () => {
          const state = writableStore("trusted");
          if (!state) return false;
          if (!chosen) {
            toast2("Paste a chain and select a certificate", "warn");
            return false;
          }
          const selected = chosen;
          const request = parseRevision;
          const certificate = chosen.certificate;
          const alias = aliasInput.value.trim();
          if (!alias) {
            toast2("Alias is required", "warn");
            return false;
          }
          const stillSelected = () => body.isConnected && mountedRef.current && request === parseRevision && chosen === selected && aliasInput.value.trim() === alias;
          let res;
          try {
            res = await verifyCertificate(certificate, null);
          } catch (e) {
            res = { success: false, error: e.message };
          }
          if (!stillSelected()) return false;
          if (!res.success && !await confirmDialog("Verification failed", (res.error || "Certificate verification failed") + "\n\nImport anyway?", { danger: true, okLabel: "Import anyway" })) return false;
          if (!stillSelected() || !writableStore("trusted", state)) return false;
          if (storesRef.current.trusted.some((c) => (c.alias || "").toLowerCase() === alias.toLowerCase()) && !await confirmReplace(alias, "trusted")) return false;
          if (!stillSelected()) return false;
          return writeStore("trusted", state, (current) => updateCertificates("trusted", { alias, pemText: certificate }, current), "Imported", "Import failed");
        }
      }]
    });
  }
  if (phase === "loading") return /* @__PURE__ */ React.createElement("div", { className: "dt-empty", style: { padding: "40px" } }, "Loading certificates\u2026");
  if (phase === "missing") {
    const managerUrl = `${engineUrl}/tls-manager`;
    return /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-body", style: { maxWidth: "760px" } }, /* @__PURE__ */ React.createElement("p", null, "The TLS Manager engine plugin wasn't detected (its ", /* @__PURE__ */ React.createElement("code", null, "/api/tlsmanager"), " endpoints returned 404). Install the TLS Manager extension on the engine and refresh."), /* @__PURE__ */ React.createElement("p", { className: "text-text-faint" }, "If a standalone TLS Manager UI is deployed, it's at ", /* @__PURE__ */ React.createElement("a", { href: managerUrl, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--accent)" } }, managerUrl), "."), /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn", onClick: refresh }, "Retry")));
  }
  const tabDef = STORE_TABS.find((t) => t.key === tab) || STORE_TABS[0];
  const storeState = storeStateRef.current[tab];
  const canWrite = storeState.status === "ready" && !writePendingRef.current;
  const act = { openDetails, editAlias, removeCert, canWrite };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "tabs", style: { marginBottom: "10px" } }, STORE_TABS.map((t) => /* @__PURE__ */ React.createElement("button", { key: t.key, type: "button", className: "tab" + (t.key === tab ? " active" : ""), onClick: () => setTab(t.key) }, t.label, " (", storesRef.current[t.key].length, ")"))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "panel-header" }, tabDef.label, /* @__PURE__ */ React.createElement("div", { className: "panel-tools" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm", disabled: writePendingRef.current, onClick: refresh }, "Refresh"), tab === "trusted" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm", disabled: !canWrite, onClick: () => openImportFile("trusted") }, "Import Certificate"), tab === "trusted" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm", disabled: !canWrite, onClick: openImportChain }, "Import Chain"), tab === "trusted" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm", disabled: !canWrite, onClick: openImportUrl }, "Import from URL"), tab === "private" && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn btn-sm btn-primary", disabled: !canWrite, onClick: () => openImportFile("private") }, "Import Key Pair"))), /* @__PURE__ */ React.createElement("div", { className: "panel-body flush" }, tabDef.readonly && /* @__PURE__ */ React.createElement("div", { className: "hint", style: { padding: "8px 14px" } }, "Read-only system truststore (from the engine's JRE)."), storeState.error && /* @__PURE__ */ React.createElement("div", { role: "alert", style: { padding: "12px 14px", color: "var(--err)" } }, storeState.error), certTableEl(storesRef.current[tab], tab, act))), /* @__PURE__ */ React.createElement("div", { className: "text-text-faint", style: { marginTop: "10px", fontSize: "11px" } }, version ? `TLS Manager Plugin ${version} \xB7 ` : "", "Sponsored by NovaMap Health & Diridium Technologies, donated to the Open Integration Engine initiative."));
}
function register(platform2) {
  platform2.registerConnectorPropertiesPanel(tlsPanel);
  platform2.registerSettingsPanel({
    label: "TLS Manager",
    order: 110,
    component: TlsManagerPanel
  });
}
export {
  register
};
/*! Bundled license information:

asn1js/build/index.js:
  (*!
   * Copyright (c) 2014, GMO GlobalSign
   * Copyright (c) 2015-2022, Peculiar Ventures
   * All rights reserved.
   * 
   * Author 2014-2019, Yury Strozhevsky
   * 
   * Redistribution and use in source and binary forms, with or without modification,
   * are permitted provided that the following conditions are met:
   * 
   * * Redistributions of source code must retain the above copyright notice, this
   *   list of conditions and the following disclaimer.
   * 
   * * Redistributions in binary form must reproduce the above copyright notice, this
   *   list of conditions and the following disclaimer in the documentation and/or
   *   other materials provided with the distribution.
   * 
   * * Neither the name of the copyright holder nor the names of its
   *   contributors may be used to endorse or promote products derived from
   *   this software without specific prior written permission.
   * 
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
   * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
   * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
   * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
   * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
   * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   * 
   *)

pkijs/build/index.js:
  (*!
   * Copyright (c) 2014, GlobalSign
   * Copyright (c) 2015-2019, Peculiar Ventures
   * All rights reserved.
   * 
   * Author 2014-2019, Yury Strozhevsky
   * 
   * Redistribution and use in source and binary forms, with or without modification,
   * are permitted provided that the following conditions are met:
   * 
   * * Redistributions of source code must retain the above copyright notice, this
   *   list of conditions and the following disclaimer.
   * 
   * * Redistributions in binary form must reproduce the above copyright notice, this
   *   list of conditions and the following disclaimer in the documentation and/or
   *   other materials provided with the distribution.
   * 
   * * Neither the name of the {organization} nor the names of its
   *   contributors may be used to endorse or promote products derived from
   *   this software without specific prior written permission.
   * 
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
   * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
   * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
   * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
   * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
   * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   * 
   *)

pkijs/build/index.js:
  (*! NOTE Bag type must be imported after the SafeBagValueFactory declaration *)
*/
