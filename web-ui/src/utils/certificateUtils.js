import {
  bytesToHex,
  decodeAltNames,
  decodeKeyUsageBits,
  digestHex,
  findExtensionByOid,
  OID,
  parsePemCertificate,
  pemToDer,
  rdnToString,
} from './pkiHelpers.js'
import { parseCertificateChain } from './verificationUtils.js'
import { notificationService } from '../services/notificationService.js'

/**
 * Convert an X.509 time string (YYMMDDhhmmssZ / YYYYMMDDhhmmssZ) to a Date.
 * Kept for backward compatibility with any external callers - internal code
 * paths now read Date objects directly off pkijs.Certificate.notBefore/notAfter.
 *
 * @param {string} timeStr
 * @returns {Date|null}
 */
export function convertX509TimeToDate(timeStr) {
  if (!timeStr) return null
  try {
    const m = /^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(timeStr)
    if (!m) return null
    let year = parseInt(m[1], 10)
    if (m[1].length === 2) {
      year += year >= 50 ? 1900 : 2000
    }
    const month = parseInt(m[2], 10) - 1
    const day = parseInt(m[3], 10)
    const hour = parseInt(m[4], 10)
    const minute = parseInt(m[5], 10)
    const second = parseInt(m[6], 10)
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  } catch {
    return null
  }
}

/**
 * Parse a Distinguished Name string into an attribute object.
 * Input: "CN=example.com, O=Org, C=US"
 * Output: { CN: "example.com", O: "Org", C: "US" }
 * @param {string} dnString
 * @returns {Object}
 */
export function parseDNString(dnString) {
  const attrs = {}
  if (!dnString) return attrs

  const parts = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < dnString.length; i++) {
    const char = dnString[i]
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current.trim())

  parts.forEach(part => {
    const equalIndex = part.indexOf('=')
    if (equalIndex > 0) {
      const key = part.substring(0, equalIndex).trim()
      let value = part.substring(equalIndex + 1).trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      attrs[key] = value
    }
  })

  return attrs
}

/**
 * Format a parsed DN object back into the canonical string used by the UI.
 * @param {Object} dnObj
 * @returns {string}
 */
export function formatDNFromObject(dnObj) {
  if (!dnObj || typeof dnObj !== 'object') return 'Unknown'

  const parts = []
  const ordered = ['CN', 'OU', 'O', 'L', 'ST', 'C', 'emailAddress']

  for (const attr of ordered) {
    if (dnObj[attr]) parts.push(`${attr}=${dnObj[attr]}`)
  }

  Object.keys(dnObj).forEach(key => {
    if (!ordered.includes(key) && dnObj[key]) {
      parts.push(`${key}=${dnObj[key]}`)
    }
  })

  return parts.length > 0 ? parts.join(', ') : 'Unknown'
}

/**
 * Determine certificate type based on extensions and self-signed-ness.
 * Returns one of: 'Root CA', 'Intermediate', 'Server Certificate',
 * 'Client Certificate', 'End-entity'.
 *
 * @param {pkijs.Certificate} cert
 */
function determineCertificateType(cert) {
  try {
    const bcExt = findExtensionByOid(cert, OID.EXT_BASIC_CONSTRAINTS)
    const cA = !!(bcExt && bcExt.parsedValue && bcExt.parsedValue.cA)

    const kuExt = findExtensionByOid(cert, OID.EXT_KEY_USAGE)
    const keyUsageNames = kuExt ? decodeKeyUsageBits(kuExt.parsedValue) : []
    const isCA = cA || keyUsageNames.includes('keyCertSign')

    if (isCA) {
      const subject = rdnToString(cert.subject)
      const issuer = rdnToString(cert.issuer)
      return subject === issuer ? 'Root CA' : 'Intermediate'
    }

    const ekuExt = findExtensionByOid(cert, OID.EXT_EXTENDED_KEY_USAGE)
    const keyPurposes = ekuExt && ekuExt.parsedValue && Array.isArray(ekuExt.parsedValue.keyPurposes)
      ? ekuExt.parsedValue.keyPurposes
      : []

    if (keyPurposes.includes(OID.EKU_SERVER_AUTH)) return 'Server Certificate'
    if (keyPurposes.includes(OID.EKU_CLIENT_AUTH)) return 'Client Certificate'
  } catch (error) {
    console.warn('Error determining certificate type:', error)
  }
  return 'End-entity'
}

function formatDate(date) {
  if (!date) return 'Unknown'
  const dateObj = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(dateObj.getTime())) return 'Unknown'
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a PEM (or bare-base64) certificate and extract the fields the UI relies on.
 *
 * @param {string} base64Pem - PEM string or bare base64 of a single certificate
 * @returns {Promise<Object>} parsed certificate description
 */
export async function parseCertificate(base64Pem) {
  try {
    const der = pemToDer(base64Pem)
    const cert = parsePemCertificate(base64Pem)

    const subjectFormatted = rdnToString(cert.subject)
    const subject = parseDNString(subjectFormatted)

    const issuerFormatted = rdnToString(cert.issuer)
    const issuer = parseDNString(issuerFormatted)

    const type = determineCertificateType(cert)

    const notBefore = cert.notBefore?.value || null
    const notAfter = cert.notAfter?.value || null
    const validFrom = formatDate(notBefore)
    const validTo = formatDate(notAfter)

    const fingerprintSha1 = await digestHex(der, 'SHA-1')

    const serialNumberHex = bytesToHex(cert.serialNumber.valueBlock.valueHexView)
    const serialNumber = serialNumberHex || cert.serialNumber.valueBlock.valueDec

    const version = cert.version

    const extensions = []

    const bcExt = findExtensionByOid(cert, OID.EXT_BASIC_CONSTRAINTS)
    if (bcExt && bcExt.parsedValue) {
      extensions.push({
        name: 'basicConstraints',
        cA: !!bcExt.parsedValue.cA,
        critical: !!bcExt.critical,
      })
    }

    const kuExt = findExtensionByOid(cert, OID.EXT_KEY_USAGE)
    if (kuExt && kuExt.parsedValue) {
      const names = decodeKeyUsageBits(kuExt.parsedValue)
      if (names.length > 0) {
        extensions.push({
          name: 'keyUsage',
          names,
          critical: !!kuExt.critical,
        })
      }
    }

    const ekuExt = findExtensionByOid(cert, OID.EXT_EXTENDED_KEY_USAGE)
    if (ekuExt && ekuExt.parsedValue && Array.isArray(ekuExt.parsedValue.keyPurposes)) {
      extensions.push({
        name: 'extKeyUsage',
        names: ekuExt.parsedValue.keyPurposes,
        critical: !!ekuExt.critical,
      })
    }

    const sanExt = findExtensionByOid(cert, OID.EXT_SUBJECT_ALT_NAME)
    const subjectAltNames = sanExt && sanExt.parsedValue
      ? decodeAltNames(sanExt.parsedValue.altNames)
      : { dns: [], ip: [], uri: [], email: [], dn: [] }

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
      raw: cert,
    }
  } catch (error) {
    return {
      subject: null,
      subjectStr: 'Parse Error',
      issuer: null,
      issuerStr: 'Parse Error',
      type: 'Unknown',
      validFrom: 'Unknown',
      validTo: 'Unknown',
      fingerprintSha1: 'Unknown',
      error: error.message,
    }
  }
}

/**
 * Validate that a string contains a parseable PEM certificate. Synchronous so
 * components can short-circuit before kicking off async verification.
 * @param {string} pemString
 */
export function isValidPemCertificate(pemString) {
  try {
    if (!pemString.includes('-----BEGIN CERTIFICATE-----') ||
        !pemString.includes('-----END CERTIFICATE-----')) {
      return false
    }
    parsePemCertificate(pemString)
    return true
  } catch {
    return false
  }
}

/**
 * Validate that a string looks like a supported PEM private key. We do
 * structural validation only (header presence + base64 sanity); algorithm
 * compatibility with Web Crypto is checked later via importPrivateKeyFromPem.
 *
 * NOTE: DSA private keys are no longer supported - Web Crypto cannot import
 * them. A clear failure surfaces the next time the key is used for matching.
 *
 * @param {string} pemString
 */
export function isValidPemPrivateKey(pemString) {
  if (!pemString) return false

  const accepted = (
    (pemString.includes('-----BEGIN PRIVATE KEY-----') && pemString.includes('-----END PRIVATE KEY-----')) ||
    (pemString.includes('-----BEGIN RSA PRIVATE KEY-----') && pemString.includes('-----END RSA PRIVATE KEY-----')) ||
    (pemString.includes('-----BEGIN EC PRIVATE KEY-----') && pemString.includes('-----END EC PRIVATE KEY-----'))
  )

  if (!accepted) return false

  try {
    pemToDer(pemString)
    return true
  } catch {
    return false
  }
}

export function pemToBase64(pemString) {
  try {
    return pemString
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '')
  } catch {
    const errorMessage = 'Invalid PEM format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

export function privateKeyPemToBase64(pemString) {
  try {
    return pemString
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
      .replace(/-----END RSA PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
      .replace(/-----END EC PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')
  } catch {
    const errorMessage = 'Invalid private key PEM format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

export function base64ToPem(base64Cert) {
  try {
    if (typeof base64Cert === 'string' && base64Cert.includes('-----BEGIN ')) {
      return base64Cert
    }
    return `-----BEGIN CERTIFICATE-----\n${base64Cert}\n-----END CERTIFICATE-----`
  } catch {
    const errorMessage = 'Invalid Base64 format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

export function base64ToPrivateKeyPem(base64Key) {
  try {
    if (typeof base64Key === 'string' && base64Key.includes('-----BEGIN ')) {
      return base64Key
    }
    return `-----BEGIN PRIVATE KEY-----\n${base64Key}\n-----END PRIVATE KEY-----`
  } catch {
    const errorMessage = 'Invalid Base64 private key format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Suggest an alias from a parseCertificate() result: prefer subject CN, then
 * any DNS SAN, then the first DN component.
 */
export function getSuggestedAlias(details) {
  if (!details) return null

  const subjectStr = details.subjectStr || ''
  const cnMatch = subjectStr.match(/CN=([^,]+)/)
  if (cnMatch && cnMatch[1]) return cnMatch[1].trim()

  const dnsName = details.subjectAltNames?.dns?.[0]
  if (dnsName) return dnsName.trim()

  const firstPart = subjectStr.split(',')[0]
  if (firstPart && firstPart.includes('=')) {
    return firstPart.split('=')[1]?.trim()
  }
  return null
}

/**
 * Parse a chain of certificates from PEM text and return an array of
 * UI-friendly descriptors. Async because parseCertificate is async.
 *
 * @param {string} pemText
 * @returns {Promise<Array>}
 */
export async function parseCertificateChainFromPem(pemText) {
  if (!pemText || !pemText.trim()) return []

  try {
    const chainCertificates = parseCertificateChain(pemText)
    if (chainCertificates.length === 0) return []

    const certificates = []
    for (let index = 0; index < chainCertificates.length; index++) {
      const chainCert = chainCertificates[index]
      try {
        const parsed = await parseCertificate(chainCert.pem)

        if (parsed.error) {
          certificates.push({
            certificate: chainCert.pem,
            alias: `Certificate ${index + 1}`,
            name: 'Invalid Certificate',
            type: 'Invalid',
            subject: `Parse Error: ${parsed.error}`,
            issuer: 'Unknown',
            validFrom: 'Unknown',
            validTo: 'Unknown',
            fingerprintSha1: 'Unknown',
            parsedCertificate: parsed,
            error: parsed.error,
          })
          continue
        }

        certificates.push({
          certificate: chainCert.pem,
          alias: getSuggestedAlias(parsed) || `Certificate ${index + 1}`,
          name: parsed.subject?.CN || 'Unknown',
          type: parsed.type || 'Unknown',
          subject: parsed.subjectStr || 'Unknown',
          issuer: parsed.issuerStr || 'Unknown',
          validFrom: parsed.validFrom,
          validTo: parsed.validTo,
          fingerprintSha1: parsed.fingerprintSha1,
          parsedCertificate: parsed,
        })
      } catch (parseError) {
        notificationService.showWarning(`Failed to parse certificate ${index + 1} in chain: ${parseError.message}`)
        certificates.push({
          certificate: chainCert.pem,
          alias: `Certificate ${index + 1}`,
          name: 'Parse Error',
          type: 'Invalid',
          subject: `Parse Error: ${parseError.message}`,
          issuer: 'Unknown',
          validFrom: 'Unknown',
          validTo: 'Unknown',
          fingerprintSha1: 'Unknown',
          error: parseError.message,
        })
      }
    }

    return certificates
  } catch {
    return []
  }
}
