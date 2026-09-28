import { X509, KEYUTIL, KJUR, zulutodate } from 'jsrsasign'
import { parseCertificateChain } from './verificationUtils.js'
import { notificationService } from './notificationService.js'

/**
 * Convert X509 time string to Date object using jsrsasign utility
 * @param {string} timeStr - X509 time format string (YYYYMMDDHHmmssZ or YYMMDDHHmmssZ)
 * @returns {Date} Date object
 */
export function convertX509TimeToDate(timeStr) {
  if (!timeStr) return null
  
  try {
    // Convert the YYMMDDhhmmssZ string to an ISO-like format
    const isoString = zulutodate(timeStr)
    
    // The t2d output is in 'YYYY/MM/DD hh:mm:ss GMT' format, which Date() can parse
    return new Date(isoString)
  } catch (error) {
    return null
  }
}

/**
 * Parse Distinguished Name string to object
 * Input: "CN=example.com, O=Org, C=US"
 * Output: { CN: "example.com", O: "Org", C: "US" }
 * @param {string} dnString - DN string
 * @returns {Object} Parsed DN object
 */
export function parseDNString(dnString) {
  const attrs = {}
  if (!dnString) return attrs
  
  // Split by comma, but handle quoted values
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
  if (current.trim()) {
    parts.push(current.trim())
  }
  
  parts.forEach(part => {
    const equalIndex = part.indexOf('=')
    if (equalIndex > 0) {
      const key = part.substring(0, equalIndex).trim()
      let value = part.substring(equalIndex + 1).trim()
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      attrs[key] = value
    }
  })
  
  return attrs
}

/**
 * Format DN object to string (for compatibility)
 * @param {Object} dnObj - DN object with attributes
 * @returns {string} Formatted DN string
 */
export function formatDNFromObject(dnObj) {
  if (!dnObj || typeof dnObj !== 'object') return 'Unknown'
  
  const parts = []
  const attributes = ['CN', 'OU', 'O', 'L', 'ST', 'C', 'emailAddress']
  
  // Add preferred attributes in order
  for (const attr of attributes) {
    if (dnObj[attr]) {
      parts.push(`${attr}=${dnObj[attr]}`)
    }
  }
  
  // Add any remaining attributes
  Object.keys(dnObj).forEach(key => {
    if (!attributes.includes(key) && dnObj[key]) {
      parts.push(`${key}=${dnObj[key]}`)
    }
  })
  
  return parts.length > 0 ? parts.join(', ') : 'Unknown'
}

/**
 * Parse a Base64-encoded PEM certificate and extract relevant information
 * @param {string} base64Pem - Base64-encoded PEM certificate
 * @returns {Object} Parsed certificate information
 */
export function parseCertificate(base64Pem) {
  try {
    const pemString = base64Pem
    
    // Parse the PEM certificate
    const cert = new X509()
    cert.readCertPEM(pemString)
    
    // Extract subject information
    const subjectStr = cert.getSubjectString()
    const subject = parseDNString(subjectStr)
    const subjectFormatted = formatDNFromObject(subject)
    
    // Extract issuer information
    const issuerStr = cert.getIssuerString()
    const issuer = parseDNString(issuerStr)
    const issuerFormatted = formatDNFromObject(issuer)
    
    // Determine certificate type
    const type = determineCertificateType(cert)
    
    // Format validity dates
    const notBefore = convertX509TimeToDate(cert.getNotBefore())
    const notAfter = convertX509TimeToDate(cert.getNotAfter())
    const validFrom = formatDate(notBefore)
    const validTo = formatDate(notAfter)
    
    // Calculate SHA-1 fingerprint
    const derHex = cert.hex  // DER-encoded certificate as hex string
    const fingerprintSha1 = KJUR.crypto.Util.hashHex(derHex, 'sha1').toUpperCase()
    
    // Get serial number
    const serialNumber = cert.getSerialNumberHex() || cert.getSerialNumber()
    
    // Get version
    const version = cert.getVersion()
    
    // Get extensions (for compatibility, create a simplified structure)
    // Wrap extension access in try-catch since some certificates may not have all extensions
    const extensions = []
     
    let basicConstraints = null
    try {
      basicConstraints = cert.getExtBasicConstraints()
      if (basicConstraints) {
        extensions.push({ name: basicConstraints.extname, cA: basicConstraints.cA, critical: basicConstraints.critical })
      }
    } catch (e) {
      // Extension doesn't exist or can't be read - skip
    }
    
    let keyUsage = null
    try {
      keyUsage = cert.getExtKeyUsage()
      
      if (keyUsage && keyUsage.names && Array.isArray(keyUsage.names)) {
        extensions.push({ name: keyUsage.extname, names: keyUsage.names, critical: keyUsage.critical })
      }
    } catch (e) {
      // Extension doesn't exist or can't be read - skip
    }
    
    let extKeyUsage = null
    try {
      extKeyUsage = cert.getExtExtKeyUsage()
      // console.log(extKeyUsage, fingerprintSha1)
      if (extKeyUsage) {
        extensions.push({ 
          name: extKeyUsage.extname, 
          names: extKeyUsage.array,
          critical: extKeyUsage.critical
        })
      }
    } catch (e) {
      // Extension doesn't exist or can't be read - skip
    }
    
    // Extract Subject Alternative Names (SAN)
    let subjectAltName = null
    let subjectAltNames = {
      dns: [],
      ip: [],
      uri: [],
      email: [],
      dn: []
    }
    try {
      subjectAltName = cert.getExtSubjectAltName()
      if (subjectAltName && subjectAltName.array && Array.isArray(subjectAltName.array)) {
        // Process SAN array and group by type
        // GeneralName is a union type: { dns: string } | { ip: string } | { uri: string } | { rfc822: string } | { dn: X500Name } | { other: ... } | undefined
        subjectAltName.array.forEach(item => {
          // Each item is a GeneralName union type - check each possible property
          if (item && typeof item === 'object') {
            if (item.dns) {
              // DNS name
              subjectAltNames.dns.push(item.dns)
            } else if (item.ip) {
              // IP address
              subjectAltNames.ip.push(item.ip)
            } else if (item.uri) {
              // URI
              subjectAltNames.uri.push(item.uri)
            } else if (item.rfc822) {
              // RFC 822 email address
              subjectAltNames.email.push(item.rfc822)
            } else if (item.dn) {
              // Distinguished Name (X500Name object)
              // X500Name has a str property for string representation
              if (item.dn.str) {
                subjectAltNames.dn.push(item.dn.str)
              } else if (typeof item.dn === 'string') {
                // Fallback if it's already a string
                subjectAltNames.dn.push(item.dn)
              } else if (item.dn.array && Array.isArray(item.dn.array)) {
                // Format DN from array structure if str is not available
                const dnParts = []
                item.dn.array.forEach(dnPart => {
                  if (Array.isArray(dnPart) && dnPart.length > 0) {
                    const dnObj = dnPart[0]
                    if (dnObj && dnObj.value) {
                      const attrName = dnObj.type || 'UNKNOWN'
                      dnParts.push(`${attrName}=${dnObj.value}`)
                    }
                  }
                })
                if (dnParts.length > 0) {
                  subjectAltNames.dn.push(dnParts.join(', '))
                }
              }
            }
            // Note: item.other is not currently handled, but could be added if needed
          }
        })
        
      }
    } catch (e) {
      // Extension doesn't exist or can't be read - skip
    }
    
    return {
      subject,
      subjectStr: subjectFormatted,
      issuer,
      issuerStr: issuerFormatted,
      type,
      validFrom,
      validTo,
      fingerprintSha1,
      serialNumber,
      version,
      extensions,
      subjectAltNames,
      raw: cert
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
      error: error.message
    }
  }
}

/**
 * Format a Distinguished Name (DN) object to string
 * @param {Object} dn - Distinguished Name object (from node-forge or parsed DN object)
 * @returns {string} Formatted DN string
 */
function formatDN(dn) {
  if (!dn) return 'Unknown'
  
  // If it's a string, return it directly
  if (typeof dn === 'string') {
    return dn
  }
  
  // If it has getField method (node-forge style), use that
  if (typeof dn.getField === 'function') {
    const parts = []
    const attributes = ['CN', 'OU', 'O', 'L', 'ST', 'C', 'emailAddress']
    
    for (const attr of attributes) {
      const field = dn.getField(attr)
      if (field) {
        const value = field.value || field
        parts.push(`${attr}=${value}`)
      }
    }
    
    const allAttrs = dn.attributes || []
    for (const attr of allAttrs) {
      if (!attributes.includes(attr.name)) {
        parts.push(`${attr.name}=${attr.value}`)
      }
    }
    
    return parts.join(', ')
  }
  
  // Otherwise, treat as parsed DN object
  return formatDNFromObject(dn)
}

/**
 * Determine certificate type based on extensions and usage
 * @param {Object} cert - Certificate object (X509 from jsrsasign)
 * @returns {string} Certificate type
 */
function determineCertificateType(cert) {
  try {
    // Check for CA certificate
    let basicConstraints = null
    try {
      basicConstraints = cert.getExtBasicConstraints()
    } catch (e) {
      // Extension doesn't exist or can't be read - continue
    }
    
    // Check for keyUsage with keyCertSign
    let keyUsage = null
    try {
      keyUsage = cert.getExtKeyUsage()
    } catch (e) {
      // Extension doesn't exist or can't be read - continue
    }
    
    const isCA = (basicConstraints && basicConstraints.ca) || 
                 (keyUsage && keyUsage.names && Array.isArray(keyUsage.names) && keyUsage.names.includes('keyCertSign'))
    
    if (isCA) {
      // Determine if Root CA or Intermediate by checking if self-signed
      const subject = cert.getSubjectString()
      const issuer = cert.getIssuerString()
      
      if (subject === issuer) {
        return 'Root CA'
      }
      return 'Intermediate'
    }
    
    // Check for server certificate
    // getExtExtKeyUsage() returns array of OID strings
    let extKeyUsage = null
    try {
      extKeyUsage = cert.getExtExtKeyUsage()
    } catch (e) {
      // Extension doesn't exist or can't be read - continue
    }
    
    if (extKeyUsage && Array.isArray(extKeyUsage)) {
      if (extKeyUsage.includes('1.3.6.1.5.5.7.3.1')) {  // serverAuth OID
        return 'Server Certificate'
      }
      // Check for client certificate
      if (extKeyUsage.includes('1.3.6.1.5.5.7.3.2')) {  // clientAuth OID
        return 'Client Certificate'
      }
    }
  } catch (error) {
    // If any unexpected error occurs, log it and return default
    console.warn('Error determining certificate type:', error)
  }
  
  return 'End-entity'
}


/**
 * Format a date object to YYYY-MM-DD string
 * @param {Date|string} date - Date object or ASN1 time string
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return 'Unknown'
  
  // If it's a string (X509 time), convert to Date first
  let dateObj = date
  if (typeof date === 'string') {
    dateObj = convertX509TimeToDate(date)
    if (!dateObj) return 'Unknown'
  }
  
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Validate if a string contains valid PEM certificate data
 * @param {string} pemString - PEM certificate string
 * @returns {boolean} True if valid PEM certificate
 */
export function isValidPemCertificate(pemString) {
  try {
    // Check if it contains certificate markers
    if (!pemString.includes('-----BEGIN CERTIFICATE-----') || 
        !pemString.includes('-----END CERTIFICATE-----')) {
      return false
    }
    
    // Try to parse it
    const cert = new X509()
    cert.readCertPEM(pemString)
    
    return true
  } catch (error) {
    return false
  }
}

/**
 * Validate if a string contains valid PEM private key data
 * @param {string} pemString - PEM private key string
 * @returns {boolean} True if valid PEM private key
 */
export function isValidPemPrivateKey(pemString) {
  try {
    // Check if it contains private key markers (support multiple formats)
    const hasPrivateKeyMarkers = (
      (pemString.includes('-----BEGIN PRIVATE KEY-----') && pemString.includes('-----END PRIVATE KEY-----')) ||
      (pemString.includes('-----BEGIN RSA PRIVATE KEY-----') && pemString.includes('-----END RSA PRIVATE KEY-----')) ||
      (pemString.includes('-----BEGIN EC PRIVATE KEY-----') && pemString.includes('-----END EC PRIVATE KEY-----')) ||
      (pemString.includes('-----BEGIN DSA PRIVATE KEY-----') && pemString.includes('-----END DSA PRIVATE KEY-----'))
    )
    
    if (!hasPrivateKeyMarkers) {
      return false
    }
    
    // Try to parse it as a private key
    const privateKey = KEYUTIL.getKey(pemString)
    
    return !!privateKey
  } catch (error) {
    return false
  }
}

/**
 * Convert PEM string to Base64-encoded format
 * @param {string} pemString - PEM certificate string
 * @returns {string} Base64-encoded certificate
 */
export function pemToBase64(pemString) {
  try {
    // Remove PEM headers and footers
    const base64Content = pemString
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '') // Remove whitespace
    
    return base64Content
  } catch (error) {
    const errorMessage = 'Invalid PEM format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Convert PEM private key string to Base64-encoded format
 * @param {string} pemString - PEM private key string
 * @returns {string} Base64-encoded private key
 */
export function privateKeyPemToBase64(pemString) {
  try {
    // Remove all possible private key headers and footers
    const base64Content = pemString
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
      .replace(/-----END RSA PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
      .replace(/-----END EC PRIVATE KEY-----/g, '')
      .replace(/-----BEGIN DSA PRIVATE KEY-----/g, '')
      .replace(/-----END DSA PRIVATE KEY-----/g, '')
      .replace(/\s/g, '') // Remove whitespace
    
    return base64Content
  } catch (error) {
    const errorMessage = 'Invalid private key PEM format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Convert Base64-encoded certificate to PEM format
 * @param {string} base64Cert - Base64-encoded certificate
 * @returns {string} PEM certificate string
 */
export function base64ToPem(base64Cert) {
  try {
    // Add PEM headers
    const pemString = `-----BEGIN CERTIFICATE-----\n${base64Cert}\n-----END CERTIFICATE-----`
    return pemString
  } catch (error) {
    const errorMessage = 'Invalid Base64 format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Convert Base64-encoded private key to PEM format
 * @param {string} base64Key - Base64-encoded private key
 * @returns {string} PEM private key string
 */
export function base64ToPrivateKeyPem(base64Key) {
  try {
    // Add PEM headers for private key
    const pemString = `-----BEGIN PRIVATE KEY-----\n${base64Key}\n-----END PRIVATE KEY-----`
    return pemString
  } catch (error) {
    const errorMessage = 'Invalid Base64 private key format'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}


// Get suggested alias from certificate details
export function getSuggestedAlias(details) {
  if (!details) return null
  
  // Try to get CN from subject
  const subjectStr = details.subjectStr || ''
  const cnMatch = subjectStr.match(/CN=([^,]+)/)
  if (cnMatch && cnMatch[1]) {
    return cnMatch[1].trim()
  }
  
  // Try to get first DNS name from SAN
  if (details.raw && details.raw.extensions) {
    const sanExtension = details.raw.extensions.find(ext => ext.name === 'subjectAltName')
    if (sanExtension && sanExtension.altNames) {
      const dnsName = sanExtension.altNames.find(altName => altName.type === 2) // DNS type
      if (dnsName && dnsName.value) {
        return dnsName.value.trim()
      }
    }
  }
  
  // Fallback to first part of subject
  const firstPart = subjectStr.split(',')[0]
  if (firstPart && firstPart.includes('=')) {
    return firstPart.split('=')[1]?.trim()
  }
  
  return null
}

/**
 * Parse a certificate chain from PEM text and return array of certificate objects
 * @param {string} pemText - PEM certificate text (can contain multiple certificates)
 * @returns {Array} Array of certificate objects with structure: { certificate: pem, alias, subject, issuer, ... }
 */
export function parseCertificateChainFromPem(pemText) {
  if (!pemText || !pemText.trim()) {
    return []
  }

  try {
    // Parse the certificate chain using verificationUtils
    const chainCertificates = parseCertificateChain(pemText)
    
    if (chainCertificates.length === 0) {
      return []
    }

    // Parse each certificate to get details
    const certificates = []
    chainCertificates.forEach((chainCert, index) => {
      try {
        const parsed = parseCertificate(chainCert.pem)
        
        // Handle parse errors gracefully
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
            error: parsed.error
          })
          return
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
          parsedCertificate: parsed
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
          error: parseError.message
        })
      }
    })

    return certificates
  } catch (error) {
    return []
  }
}
