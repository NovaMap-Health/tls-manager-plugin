import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

/**
 * Shared helpers used by certificateUtils.js and verificationUtils.js.
 *
 * pkijs operates on DER buffers and ASN.1 structures, so most of these helpers
 * exist to bridge between PEM strings / hex strings used by the rest of the app
 * and the structures pkijs produces.
 */

const PEM_HEADER_RE = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/

const OID_TO_NAME = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.9': 'STREET',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.5': 'serialNumber',
  '2.5.4.12': 'T',
  '2.5.4.42': 'GN',
  '2.5.4.43': 'I',
  '2.5.4.4': 'SN',
  '0.9.2342.19200300.100.1.25': 'DC',
  '0.9.2342.19200300.100.1.1': 'UID',
  '1.2.840.113549.1.9.1': 'emailAddress',
}

const CURVE_OID_TO_NAME = {
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
}

const CURVE_NAME_TO_BITS = {
  'P-256': 256,
  'P-384': 384,
  'P-521': 521,
}

const SIG_ALGORITHM_OID_NAMES = {
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.113549.1.1.10': 'rsassa-pss',
  '1.2.840.10045.4.1': 'ecdsa-with-SHA1',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
}

export const OID = {
  RSA_ENCRYPTION: '1.2.840.113549.1.1.1',
  EC_PUBLIC_KEY: '1.2.840.10045.2.1',
  EXT_BASIC_CONSTRAINTS: '2.5.29.19',
  EXT_KEY_USAGE: '2.5.29.15',
  EXT_EXTENDED_KEY_USAGE: '2.5.29.37',
  EXT_SUBJECT_ALT_NAME: '2.5.29.17',
  EKU_SERVER_AUTH: '1.3.6.1.5.5.7.3.1',
  EKU_CLIENT_AUTH: '1.3.6.1.5.5.7.3.2',
}

const KEY_USAGE_NAMES = [
  'digitalSignature',
  'nonRepudiation',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'encipherOnly',
  'decipherOnly',
]

/**
 * Decode a PEM block (any kind) into a DER ArrayBuffer.
 *
 * Lenient on input: bare base64, a single PEM block, or even doubly-wrapped
 * PEM (which can happen when a value that is already PEM is passed through
 * `base64ToPem` again) all decode correctly. Every `-----BEGIN/END FOO-----`
 * marker line is stripped, then the residual base64 is decoded.
 *
 * @param {string} pem
 * @returns {ArrayBuffer}
 */
export function pemToDer(pem) {
  const b64 = pem
    .replace(/-----(?:BEGIN|END)[^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}

/**
 * Read just the PEM type (e.g. "CERTIFICATE", "PRIVATE KEY", "EC PRIVATE KEY").
 * @param {string} pem
 * @returns {string|null}
 */
export function pemType(pem) {
  const match = PEM_HEADER_RE.exec(pem)
  return match ? match[1] : null
}

/**
 * Convert a Uint8Array or ArrayBuffer to an uppercase hex string (no separators).
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let out = ''
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, '0')
  }
  return out.toUpperCase()
}

/**
 * Format hex into colon-separated pairs (AA:BB:CC...).
 * @param {string} hex
 */
export function hexWithColons(hex) {
  return hex.toUpperCase().replace(/(.{2})(?!$)/g, '$1:')
}

/**
 * Render a pkijs RelativeDistinguishedNames object as an RFC-4514-ish string.
 * @param {Object} rdn - cert.subject or cert.issuer from pkijs.Certificate
 * @returns {string}
 */
export function rdnToString(rdn) {
  if (!rdn || !Array.isArray(rdn.typesAndValues)) return ''
  return rdn.typesAndValues
    .map(tv => {
      const name = OID_TO_NAME[tv.type] || tv.type
      const value = tv.value && tv.value.valueBlock && tv.value.valueBlock.value
      return value !== undefined ? `${name}=${value}` : `${name}=`
    })
    .join(', ')
}

/**
 * Get all certificate PEM blocks from a string that may contain a chain.
 * @param {string} text
 * @returns {string[]}
 */
export function extractCertificatePems(text) {
  const re = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
  return text.match(re) || []
}

/**
 * Parse a single PEM CERTIFICATE block into a pkijs.Certificate.
 * @param {string} pem
 * @returns {pkijs.Certificate}
 */
export function parsePemCertificate(pem) {
  const der = pemToDer(pem)
  return pkijs.Certificate.fromBER(der)
}

/**
 * Decode the IP address bytes from a SAN GeneralName of type 7 into a printable
 * dotted (IPv4) or colon-hex (IPv6) string.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {string}
 */
function ipBytesToString(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (view.length === 4) {
    return Array.from(view).join('.')
  }
  if (view.length === 16) {
    const parts = []
    for (let i = 0; i < 16; i += 2) {
      parts.push(((view[i] << 8) | view[i + 1]).toString(16))
    }
    return parts.join(':')
  }
  return bytesToHex(view)
}

/**
 * Convert a pkijs AltName.altNames array (GeneralName[]) into the shape used
 * throughout the UI: { dns, ip, uri, email, dn }.
 * @param {Array} altNames
 */
export function decodeAltNames(altNames) {
  const out = { dns: [], ip: [], uri: [], email: [], dn: [] }
  if (!Array.isArray(altNames)) return out

  for (const gn of altNames) {
    if (!gn) continue
    switch (gn.type) {
      case 1: // rfc822Name
        if (typeof gn.value === 'string') out.email.push(gn.value)
        break
      case 2: // dNSName
        if (typeof gn.value === 'string') out.dns.push(gn.value)
        break
      case 6: // uniformResourceIdentifier
        if (typeof gn.value === 'string') out.uri.push(gn.value)
        break
      case 7: { // iPAddress (OctetString)
        const hex = gn.value && gn.value.valueBlock && gn.value.valueBlock.valueHexView
        if (hex) out.ip.push(ipBytesToString(hex))
        break
      }
      case 4: { // directoryName
        const dirName = rdnToString(gn.value)
        if (dirName) out.dn.push(dirName)
        break
      }
      default:
        break
    }
  }
  return out
}

/**
 * Decode a KeyUsage BIT STRING (extnValue parsedValue) into the usage name list.
 * @param {Object} parsedBitString - asn1js.BitString instance
 * @returns {string[]}
 */
export function decodeKeyUsageBits(parsedBitString) {
  if (!parsedBitString || !parsedBitString.valueBlock) return []
  const bytes = parsedBitString.valueBlock.valueHexView
    || new Uint8Array(parsedBitString.valueBlock.valueHex || new ArrayBuffer(0))
  const unusedBits = parsedBitString.valueBlock.unusedBits || 0
  if (!bytes || bytes.length === 0) return []
  const totalBits = bytes.length * 8 - unusedBits
  const out = []
  for (let i = 0; i < totalBits && i < KEY_USAGE_NAMES.length; i++) {
    const byteIdx = Math.floor(i / 8)
    const bitInByte = 7 - (i % 8)
    if ((bytes[byteIdx] >> bitInByte) & 1) {
      out.push(KEY_USAGE_NAMES[i])
    }
  }
  return out
}

/**
 * Find a parsed extension value by extension OID.
 * Returns the parsedValue object (e.g. pkijs.BasicConstraints) or null.
 */
export function findExtensionByOid(cert, oid) {
  if (!cert || !Array.isArray(cert.extensions)) return null
  return cert.extensions.find(ext => ext.extnID === oid) || null
}

/**
 * Resolve an EC curve OID to a Web Crypto namedCurve string.
 * @param {string} oid
 * @returns {string|null}
 */
export function curveOidToName(oid) {
  return CURVE_OID_TO_NAME[oid] || null
}

/**
 * Resolve the size in bits of a Web Crypto named EC curve.
 */
export function curveNameToBits(name) {
  return CURVE_NAME_TO_BITS[name] || null
}

/**
 * Friendly name for a signature algorithm OID, falling back to the OID itself.
 */
export function sigAlgorithmName(oid) {
  if (!oid) return 'Unknown'
  return SIG_ALGORITHM_OID_NAMES[oid] || oid
}

/**
 * Inspect a pkijs.Certificate's SubjectPublicKeyInfo and return:
 *   { type: 'RSA' | 'EC', namedCurve?: 'P-256' | 'P-384' | 'P-521', bits?: number }
 * Returns null for unsupported algorithms.
 */
export function describePublicKey(cert) {
  const algoOid = cert?.subjectPublicKeyInfo?.algorithm?.algorithmId
  if (!algoOid) return null

  if (algoOid === OID.RSA_ENCRYPTION) {
    let bits
    try {
      const view = cert.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView
      const buf = new ArrayBuffer(view.byteLength)
      new Uint8Array(buf).set(view)
      const rsa = pkijs.RSAPublicKey.fromBER(buf)
      const mod = rsa.modulus.valueBlock.valueHexView
      let lead = 0
      while (lead < mod.length && mod[lead] === 0) lead++
      bits = (mod.length - lead) * 8
    } catch {
      bits = undefined
    }
    return { type: 'RSA', bits }
  }

  if (algoOid === OID.EC_PUBLIC_KEY) {
    const params = cert.subjectPublicKeyInfo.algorithm.algorithmParams
    const curveOid = params && typeof params.valueBlock?.toString === 'function'
      ? params.valueBlock.toString()
      : null
    const namedCurve = curveOidToName(curveOid)
    return { type: 'EC', namedCurve, bits: namedCurve ? curveNameToBits(namedCurve) : undefined }
  }

  return null
}

/**
 * Import the public key from a pkijs.Certificate as a Web Crypto CryptoKey
 * suitable for signature verification. We pin SHA-256 for RSA and rely on the
 * certificate's EC named curve for ECDSA so we can deterministically pair this
 * key with a private key imported by importPrivateKeyFromPem().
 *
 * @param {pkijs.Certificate} cert
 * @returns {Promise<CryptoKey>}
 */
export async function importCertPublicKey(cert) {
  const desc = describePublicKey(cert)
  if (!desc) throw new Error('Unsupported certificate public key algorithm')

  if (desc.type === 'RSA') {
    return cert.getPublicKey({
      algorithm: {
        algorithm: { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
        usages: ['verify'],
      },
    })
  }

  if (desc.type === 'EC') {
    if (!desc.namedCurve) throw new Error('Unsupported EC named curve in certificate')
    return cert.getPublicKey({
      algorithm: {
        algorithm: { name: 'ECDSA', namedCurve: desc.namedCurve },
        usages: ['verify'],
      },
    })
  }

  throw new Error(`Unsupported public key type: ${desc.type}`)
}

/**
 * Build a PKCS#8 DER buffer from a parsed RSAPrivateKey (PKCS#1 form).
 */
function wrapRsaPkcs1AsPkcs8(rsaKeyDer) {
  const wrapped = new pkijs.PrivateKeyInfo({
    version: 0,
    privateKeyAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: OID.RSA_ENCRYPTION,
      algorithmParams: new asn1js.Null(),
    }),
    privateKey: new asn1js.OctetString({ valueHex: rsaKeyDer }),
  })
  return wrapped.toSchema().toBER(false)
}

/**
 * Build a PKCS#8 DER buffer from a parsed ECPrivateKey (SEC1 form).
 */
function wrapEcSec1AsPkcs8(sec1Der, curveOid) {
  const wrapped = new pkijs.PrivateKeyInfo({
    version: 0,
    privateKeyAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: OID.EC_PUBLIC_KEY,
      algorithmParams: new asn1js.ObjectIdentifier({ value: curveOid }),
    }),
    privateKey: new asn1js.OctetString({ valueHex: sec1Der }),
  })
  return wrapped.toSchema().toBER(false)
}

/**
 * Extract the *private key* PEM block from a string that may contain other
 * leading blocks (notably "EC PARAMETERS" emitted by OpenSSL alongside an EC
 * private key). Returns the first matching block, or null.
 *
 * @param {string} pem
 */
function extractPrivateKeyBlock(pem) {
  const re = /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/g
  const match = re.exec(pem)
  return match ? match[0] : null
}

/**
 * Import a PEM-encoded private key (PKCS#8, PKCS#1 RSA, or SEC1 EC) as a Web
 * Crypto CryptoKey usable for SHA-256 signing.
 *
 * Returns: { key: CryptoKey, type: 'RSA'|'EC', namedCurve?: string }
 * Throws on unsupported formats (notably DSA, which Web Crypto does not support).
 *
 * @param {string} pem
 */
export async function importPrivateKeyFromPem(pem) {
  const block = extractPrivateKeyBlock(pem) || pem
  const type = pemType(block)
  if (!type) throw new Error('Not a PEM private key')

  if (type === 'DSA PRIVATE KEY') {
    throw new Error('DSA private keys are not supported in this environment')
  }

  if (type === 'PRIVATE KEY') {
    const der = pemToDer(block)
    const pki = pkijs.PrivateKeyInfo.fromBER(der)
    const algoOid = pki.privateKeyAlgorithm.algorithmId

    if (algoOid === OID.RSA_ENCRYPTION) {
      const key = await crypto.subtle.importKey(
        'pkcs8', der,
        { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
        true, ['sign']
      )
      return { key, type: 'RSA' }
    }

    if (algoOid === OID.EC_PUBLIC_KEY) {
      const params = pki.privateKeyAlgorithm.algorithmParams
      const curveOid = params && typeof params.valueBlock?.toString === 'function'
        ? params.valueBlock.toString()
        : null
      const namedCurve = curveOidToName(curveOid)
      if (!namedCurve) throw new Error(`Unsupported EC curve OID: ${curveOid}`)
      const key = await crypto.subtle.importKey(
        'pkcs8', der,
        { name: 'ECDSA', namedCurve },
        true, ['sign']
      )
      return { key, type: 'EC', namedCurve }
    }

    throw new Error(`Unsupported private key algorithm: ${algoOid}`)
  }

  if (type === 'RSA PRIVATE KEY') {
    const der = pemToDer(block)
    const pkcs8 = wrapRsaPkcs1AsPkcs8(der)
    const key = await crypto.subtle.importKey(
      'pkcs8', pkcs8,
      { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
      true, ['sign']
    )
    return { key, type: 'RSA' }
  }

  if (type === 'EC PRIVATE KEY') {
    const der = pemToDer(block)
    const ec = pkijs.ECPrivateKey.fromBER(der)
    const curveOid = ec.namedCurve
    if (!curveOid) throw new Error('EC private key has no namedCurve OID')
    const namedCurve = curveOidToName(curveOid)
    if (!namedCurve) throw new Error(`Unsupported EC curve OID: ${curveOid}`)
    const pkcs8 = wrapEcSec1AsPkcs8(der, curveOid)
    const key = await crypto.subtle.importKey(
      'pkcs8', pkcs8,
      { name: 'ECDSA', namedCurve },
      true, ['sign']
    )
    return { key, type: 'EC', namedCurve }
  }

  throw new Error(`Unsupported PEM private key type: ${type}`)
}

/**
 * Compute a hash over a buffer and return the result as a hex string.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @param {'SHA-1'|'SHA-256'|'SHA-384'|'SHA-512'} algorithm
 * @returns {Promise<string>} uppercase hex
 */
export async function digestHex(buffer, algorithm) {
  const data = buffer instanceof Uint8Array ? buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) : buffer
  const hash = await crypto.subtle.digest(algorithm, data)
  return bytesToHex(new Uint8Array(hash))
}
