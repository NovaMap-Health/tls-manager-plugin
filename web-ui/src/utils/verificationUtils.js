import * as pkijs from 'pkijs'
import {
  bytesToHex,
  decodeAltNames,
  describePublicKey,
  digestHex,
  extractCertificatePems,
  findExtensionByOid,
  hexWithColons,
  importCertPublicKey,
  importPrivateKeyFromPem,
  OID,
  pemToDer,
  rdnToString,
  sigAlgorithmName,
} from './pkiHelpers.js'
import { isValidPemCertificate, isValidPemPrivateKey, parseDNString } from './certificateUtils.js'

/**
 * Parse a PEM blob (single cert or chain) into an array of
 * { pem, cert, der } records, where `cert` is a pkijs.Certificate.
 *
 * Synchronous because pkijs.Certificate.fromBER is synchronous - only the
 * Web Crypto operations (verify, getPublicKey, importKey) are async.
 *
 * @param {string} certText
 * @returns {Array<{pem: string, cert: pkijs.Certificate, der: ArrayBuffer}>}
 */
export function parseCertificateChain(certText) {
  const certificates = []
  const pems = extractCertificatePems(certText || '')
  for (const pem of pems) {
    try {
      const der = pemToDer(pem)
      const cert = pkijs.Certificate.fromBER(der)
      certificates.push({ pem, cert, der })
    } catch {
      // Failed to parse certificate - skip it (matches previous behavior)
    }
  }
  return certificates
}

/**
 * Validate ordering, issuer linkage, signatures, and basic constraints
 * across an array of parsed certificates (output of parseCertificateChain).
 *
 * Async because pkijs.Certificate.verify(parent) is async.
 *
 * @param {Array<{cert: pkijs.Certificate}>} certificates
 * @returns {Promise<{isValid: boolean, errors: string[], warnings: string[], details: string[]}>}
 */
export async function validateCertificateChain(certificates) {
  const validation = { isValid: true, errors: [], warnings: [], details: [] }

  if (!certificates || certificates.length <= 1) {
    validation.details.push('Single certificate provided - no chain validation needed')
    return validation
  }

  for (let i = 0; i < certificates.length - 1; i++) {
    const cert = certificates[i].cert
    const issuerCert = certificates[i + 1].cert

    validation.details.push(`Checking certificate ${i + 1} against issuer certificate ${i + 2}`)

    const certIssuer = rdnToString(cert.issuer)
    const issuerSubject = rdnToString(issuerCert.subject)
    if (certIssuer !== issuerSubject) {
      validation.isValid = false
      validation.errors.push(`Certificate ${i + 1} issuer "${certIssuer}" does not match certificate ${i + 2} subject "${issuerSubject}"`)
    } else {
      validation.details.push(`✓ Issuer names match for certificates ${i + 1} and ${i + 2}`)
    }

    try {
      const isSignatureValid = await cert.verify(issuerCert)
      if (isSignatureValid) {
        validation.details.push(`✓ Certificate ${i + 1} signature verified by certificate ${i + 2}`)
      } else {
        validation.isValid = false
        validation.errors.push(`Certificate ${i + 1} signature verification failed against certificate ${i + 2}`)
      }
    } catch (error) {
      validation.isValid = false
      validation.errors.push(`Error verifying certificate ${i + 1} signature: ${error.message}`)
    }

    const certNotBefore = cert.notBefore?.value
    const certNotAfter = cert.notAfter?.value
    const issuerNotBefore = issuerCert.notBefore?.value
    const issuerNotAfter = issuerCert.notAfter?.value

    if (certNotBefore && issuerNotBefore && certNotBefore < issuerNotBefore) {
      validation.warnings.push(`Certificate ${i + 1} valid from date is before its issuer's valid from date`)
    }
    if (certNotAfter && issuerNotAfter && certNotAfter > issuerNotAfter) {
      validation.warnings.push(`Certificate ${i + 1} expires after its issuer certificate ${i + 2}`)
    }
  }

  const root = certificates[certificates.length - 1].cert
  const rootIssuer = rdnToString(root.issuer)
  const rootSubject = rdnToString(root.subject)

  if (rootIssuer === rootSubject) {
    try {
      const isSelfSigned = await root.verify(root)
      if (isSelfSigned) {
        validation.details.push('✓ Root certificate is properly self-signed')
      } else {
        validation.warnings.push('Root certificate appears self-signed but signature verification failed')
      }
    } catch (error) {
      validation.warnings.push(`Error verifying root certificate self-signature: ${error.message}`)
    }
  } else {
    validation.warnings.push('Root certificate is not self-signed - chain may be incomplete')
  }

  certificates.forEach((certObj, index) => {
    const cert = certObj.cert
    const bcExt = findExtensionByOid(cert, OID.EXT_BASIC_CONSTRAINTS)
    const bc = bcExt ? bcExt.parsedValue : null

    if (index === 0) {
      if (bc && bc.cA) {
        validation.warnings.push('End entity certificate has CA flag set to true')
      }
    } else {
      if (!bc || !bc.cA) {
        validation.warnings.push(`Certificate ${index + 1} should be a CA but basicConstraints CA flag is not set`)
      }

      if (bc && bc.pathLenConstraint !== undefined) {
        const pathLen = typeof bc.pathLenConstraint === 'number'
          ? bc.pathLenConstraint
          : (bc.pathLenConstraint?.valueBlock?.valueDec ?? null)
        if (pathLen !== null) {
          const remainingCAs = certificates.length - index - 2
          if (remainingCAs > pathLen) {
            validation.errors.push(`Certificate ${index + 1} pathLenConstraint (${pathLen}) exceeded by chain depth`)
            validation.isValid = false
          }
        }
      }
    }
  })

  return validation
}

/**
 * Verify that a private key matches a certificate by performing a sign+verify
 * round-trip with Web Crypto.
 *
 * @param {{cert: pkijs.Certificate}} certObj
 * @param {string} keyPem
 * @returns {Promise<{isValid: boolean, message: string}>}
 */
export async function validatePrivateKey(certObj, keyPem) {
  try {
    let imported
    try {
      imported = await importPrivateKeyFromPem(keyPem)
    } catch (e) {
      return { isValid: false, message: `Failed to parse private key: ${e.message}` }
    }

    let certPubKey
    try {
      certPubKey = await importCertPublicKey(certObj.cert)
    } catch (e) {
      return { isValid: false, message: `Failed to parse certificate public key: ${e.message}` }
    }

    if (certPubKey.algorithm.name !== imported.key.algorithm.name) {
      return { isValid: false, message: 'Private key does not match the certificate (algorithm mismatch)' }
    }

    if (imported.type === 'EC' && imported.namedCurve !== certPubKey.algorithm.namedCurve) {
      return { isValid: false, message: 'Private key does not match the certificate (EC curve mismatch)' }
    }

    const data = new TextEncoder().encode('test-data-for-validation')
    let signOpts
    if (imported.type === 'RSA') {
      signOpts = { name: 'RSASSA-PKCS1-v1_5' }
    } else if (imported.type === 'EC') {
      signOpts = { name: 'ECDSA', hash: { name: 'SHA-256' } }
    } else {
      return { isValid: false, message: `Unsupported key type: ${imported.type}` }
    }

    const signature = await crypto.subtle.sign(signOpts, imported.key, data)
    const ok = await crypto.subtle.verify(signOpts, certPubKey, signature, data)

    return ok
      ? { isValid: true, message: 'Private key matches the certificate!' }
      : { isValid: false, message: 'Private key does not match the certificate' }
  } catch (error) {
    return { isValid: false, message: `Error validating private key: ${error.message}` }
  }
}

/**
 * Return a human status string based on validity period.
 * @param {pkijs.Certificate} cert
 */
export function getCertStatus(cert) {
  const now = new Date()
  const notBefore = cert.notBefore?.value
  const notAfter = cert.notAfter?.value

  if (notBefore && now < notBefore) return '⏳ Not yet valid'
  if (notAfter && now > notAfter) return '⚠️ Expired'
  return '✅ Valid'
}

/**
 * Compute a colon-separated fingerprint of a certificate's DER encoding.
 *
 * @param {ArrayBuffer|Uint8Array} der - DER bytes of the certificate
 * @param {'sha1'|'sha256'|'sha384'|'sha512'} algorithm
 * @returns {Promise<string>}
 */
export async function getFingerprint(der, algorithm = 'sha1') {
  const algMap = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }
  const hex = await digestHex(der, algMap[algorithm] || 'SHA-1')
  return hexWithColons(hex)
}

/**
 * Format SAN entries from a certificate as a flat array of strings, e.g.
 * ['DNS: example.com', 'IP: 10.0.0.1', 'Email: a@b.com'].
 * @param {pkijs.Certificate} cert
 */
export function getSANs(cert) {
  try {
    const sanExt = findExtensionByOid(cert, OID.EXT_SUBJECT_ALT_NAME)
    if (!sanExt || !sanExt.parsedValue) return []
    const grouped = decodeAltNames(sanExt.parsedValue.altNames)
    const out = []
    grouped.dns.forEach(v => out.push(`DNS: ${v}`))
    grouped.ip.forEach(v => out.push(`IP: ${v}`))
    grouped.email.forEach(v => out.push(`Email: ${v}`))
    grouped.uri.forEach(v => out.push(`URI: ${v}`))
    grouped.dn.forEach(v => out.push(`DN: ${v}`))
    return out
  } catch {
    return []
  }
}

/**
 * Get key size in bits or 'Unknown' for a certificate's public key.
 * @param {pkijs.Certificate} cert
 */
export function getKeySize(cert) {
  const desc = describePublicKey(cert)
  if (!desc) return 'Unknown'
  return desc.bits || 'Unknown'
}

/**
 * Pull a single field (e.g. CN) out of the cert's subject or issuer DN.
 * @param {pkijs.Certificate} cert
 * @param {string} field
 * @param {'subject'|'issuer'} type
 */
export function getSubjectField(cert, field, type = 'subject') {
  const dnString = type === 'subject' ? rdnToString(cert.subject) : rdnToString(cert.issuer)
  const attrs = parseDNString(dnString)
  return attrs[field] || 'Not specified'
}

/**
 * Top-level orchestrator: parse cert text, validate the chain, optionally
 * validate a private key against the leaf, and return the result shape the UI
 * components expect.
 *
 * @param {string} certText
 * @param {string|null} keyText
 */
export async function verifyCertificate(certText, keyText = null) {
  try {
    if (!certText || !certText.trim()) {
      return { success: false, error: 'Invalid certificate. Make sure the file is a .pem.' }
    }
    if (!isValidPemCertificate(certText)) {
      return { success: false, error: 'Invalid certificate. Make sure the file is a .pem.' }
    }
    if (keyText && keyText.trim() && !isValidPemPrivateKey(keyText)) {
      return { success: false, error: 'Invalid private key. Make sure the file is a .key.' }
    }

    const certificates = parseCertificateChain(certText)
    if (certificates.length === 0) {
      return { success: false, error: 'Invalid certificate. Make sure the file is a .pem.' }
    }

    const primary = certificates[0].cert
    const primaryDer = certificates[0].der
    const notBefore = primary.notBefore?.value
    const notAfter = primary.notAfter?.value

    const sigAlg = sigAlgorithmName(primary.signatureAlgorithm?.algorithmId)
    const keyDesc = describePublicKey(primary)
    const pubKeyAlg = keyDesc?.type === 'EC' ? 'ECDSA' : (keyDesc?.type === 'RSA' ? 'RSA' : 'Unknown')

    const serial = bytesToHex(primary.serialNumber.valueBlock.valueHexView)
      || primary.serialNumber.valueBlock.valueDec

    const certDetails = {
      subject: getSubjectField(primary, 'CN'),
      issuer: getSubjectField(primary, 'CN', 'issuer'),
      serialNumber: serial,
      validFrom: notBefore ? notBefore.toISOString() : 'Unknown',
      validTo: notAfter ? notAfter.toISOString() : 'Unknown',
      status: getCertStatus(primary),
      signatureAlgorithm: sigAlg,
      publicKeyAlgorithm: pubKeyAlg,
      keySize: getKeySize(primary),
      fingerprintSha1: await getFingerprint(primaryDer, 'sha1'),
      fingerprintSha256: await getFingerprint(primaryDer, 'sha256'),
      sans: getSANs(primary),
    }

    const chainValidation = await validateCertificateChain(certificates)

    let keyValidation = null
    if (keyText && keyText.trim()) {
      keyValidation = await validatePrivateKey(certificates[0], keyText)
      if (!keyValidation || !keyValidation.isValid) {
        return {
          success: false,
          certificates,
          certDetails,
          chainValidation,
          keyValidation,
          error: 'Certificate does not match private key.',
        }
      }
    }

    const chainValid = chainValidation && chainValidation.isValid
    const keyValid = !keyText || !keyText.trim() || (keyValidation && keyValidation.isValid)
    const overallSuccess = chainValid && keyValid

    return {
      success: overallSuccess,
      certificates,
      certDetails,
      chainValidation,
      keyValidation,
      chainDetails: certificates.length > 1 ? certificates.map((certObj, index) => {
        const certNotBefore = certObj.cert.notBefore?.value
        const certNotAfter = certObj.cert.notAfter?.value
        return {
          index: index + 1,
          type: index === 0 ? 'End Entity' : index === certificates.length - 1 ? 'Root CA' : 'Intermediate CA',
          subject: getSubjectField(certObj.cert, 'CN'),
          issuer: getSubjectField(certObj.cert, 'CN', 'issuer'),
          validFrom: certNotBefore ? certNotBefore.toDateString() : 'Unknown',
          validTo: certNotAfter ? certNotAfter.toDateString() : 'Unknown',
        }
      }) : null,
      error: !overallSuccess
        ? (!chainValid ? 'Certificate chain validation failed' : 'Private key validation failed')
        : null,
    }
  } catch (error) {
    return { success: false, error: `Error parsing certificate: ${error.message}` }
  }
}
