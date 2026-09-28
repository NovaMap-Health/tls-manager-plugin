import { X509, KEYUTIL, KJUR, RSAKey } from 'jsrsasign'
import { convertX509TimeToDate, parseDNString, isValidPemCertificate, isValidPemPrivateKey } from './certificateUtils.js'

/**
 * Parse a certificate chain from PEM text (supports multiple certificates)
 * @param {string} certText - PEM certificate text (can contain multiple certificates)
 * @returns {Array} Array of certificate objects with pem and cert properties
 */
export function parseCertificateChain(certText) {
  const certificates = []
  const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
  const matches = certText.match(certRegex)

  if (matches) {
    matches.forEach(certPem => {
      try {
        const cert = new X509()
        cert.readCertPEM(certPem)
        certificates.push({ pem: certPem, cert: cert })
      } catch (e) {
        // Failed to parse certificate - skip it
      }
    })
  }

  return certificates
}

/**
 * Validate a certificate chain for proper ordering and signatures
 * @param {Array} certificates - Array of certificate objects
 * @returns {Object} Validation result with isValid, errors, warnings, and details
 */
export function validateCertificateChain(certificates) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    details: []
  }

  if (certificates.length === 1) {
    validation.details.push('Single certificate provided - no chain validation needed')
    return validation
  }

  // Check chain order and signatures
  for (let i = 0; i < certificates.length - 1; i++) {
    const cert = certificates[i].cert
    const issuerCert = certificates[i + 1].cert
    const certPem = certificates[i].pem
    const issuerPem = certificates[i + 1].pem

    validation.details.push(`Checking certificate ${i + 1} against issuer certificate ${i + 2}`)

    // Check if issuer name matches
    const certIssuer = cert.getIssuerString()
    const issuerSubject = issuerCert.getSubjectString()

    if (certIssuer !== issuerSubject) {
      validation.isValid = false
      validation.errors.push(`Certificate ${i + 1} issuer "${certIssuer}" does not match certificate ${i + 2} subject "${issuerSubject}"`)
    } else {
      validation.details.push(`✓ Issuer names match for certificates ${i + 1} and ${i + 2}`)
    }

    // Verify signature
    try {
      const isSignatureValid = cert.verifySignature(issuerPem)  // jsrsasign requires PEM string
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

    // Check validity periods
    const certNotBefore = convertX509TimeToDate(cert.getNotBefore())
    const certNotAfter = convertX509TimeToDate(cert.getNotAfter())
    const issuerNotBefore = convertX509TimeToDate(issuerCert.getNotBefore())
    const issuerNotAfter = convertX509TimeToDate(issuerCert.getNotAfter())

    if (certNotBefore < issuerNotBefore) {
      validation.warnings.push(`Certificate ${i + 1} valid from date is before its issuer's valid from date`)
    }
    if (certNotAfter > issuerNotAfter) {
      validation.warnings.push(`Certificate ${i + 1} expires after its issuer certificate ${i + 2}`)
    }
  }

  // Check if root is self-signed
  const rootCert = certificates[certificates.length - 1].cert
  const rootPem = certificates[certificates.length - 1].pem
  const rootIssuer = rootCert.getIssuerString()
  const rootSubject = rootCert.getSubjectString()

  if (rootIssuer === rootSubject) {
    try {
      const isSelfSigned = rootCert.verifySignature(rootPem)
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

  // Check certificate purposes and constraints
  certificates.forEach((certObj, index) => {
    const cert = certObj.cert
    let basicConstraints = null
    try {
      basicConstraints = cert.getExtBasicConstraints()
    } catch (e) {
      // Extension doesn't exist or can't be read - continue with null
    }

    if (index === 0) {
      // End entity certificate
      if (basicConstraints && basicConstraints.ca) {  // lowercase 'ca' in jsrsasign
        validation.warnings.push('End entity certificate has CA flag set to true')
      }
    } else {
      // CA certificates
      if (!basicConstraints || !basicConstraints.ca) {  // lowercase 'ca' in jsrsasign
        validation.warnings.push(`Certificate ${index + 1} should be a CA but basicConstraints CA flag is not set`)
      }

      if (basicConstraints && typeof basicConstraints.pathLenConstraint === 'number') {
        const remainingCAs = certificates.length - index - 2 // Exclude self and count remaining CAs
        if (remainingCAs > basicConstraints.pathLenConstraint) {
          validation.errors.push(`Certificate ${index + 1} pathLenConstraint (${basicConstraints.pathLenConstraint}) exceeded by chain depth`)
          validation.isValid = false
        }
      }
    }
  })

  return validation
}

/**
 * Validate if a private key matches a certificate
 * @param {Object} certObj - Certificate object with cert property (X509 object)
 * @param {string} keyPem - PEM private key string
 * @returns {Object} Validation result with isValid and message
 */
export function validatePrivateKey(certObj, keyPem) {
  try {
    // Parse private key using KEYUTIL (handles all formats automatically)
    const privateKey = KEYUTIL.getKey(keyPem)
    if (!privateKey) {
      return { isValid: false, message: 'Failed to parse private key' }
    }

    // Get public key from certificate
    const certPubKeyPem = certObj.cert.getPublicKey()
    const certPubKey = KEYUTIL.getKey(certPubKeyPem)
    if (!certPubKey) {
      return { isValid: false, message: 'Failed to parse certificate public key' }
    }

    // Extract public key from private key object
    // For RSA: private key has n and e (public components)
    // For EC: private key has x and y (public point coordinates)
    let pubKeyFromPrivate = null
    try {
      // Try to create a public key PEM from the private key
      // For RSA keys, we can construct a public key object from n and e
      if (privateKey.n && privateKey.e) {
        // RSA key - construct public key object
        pubKeyFromPrivate = new RSAKey()
        pubKeyFromPrivate.setPublic(privateKey.n, privateKey.e)
        const pubKeyPemFromPrivate = KEYUTIL.getPEM(pubKeyFromPrivate)
        
        // Compare public keys (PEM format comparison)
        if (certPubKeyPem === pubKeyPemFromPrivate) {
          return { isValid: true, message: 'Private key matches the certificate!' }
        }
      } else if (privateKey.curve && privateKey.x && privateKey.y) {
        // EC key - construct public key object
        pubKeyFromPrivate = new KJUR.crypto.ECDSA({ curve: privateKey.curve, pub: { x: privateKey.x, y: privateKey.y } })
        const pubKeyPemFromPrivate = KEYUTIL.getPEM(pubKeyFromPrivate)
        
        // Compare public keys (PEM format comparison)
        if (certPubKeyPem === pubKeyPemFromPrivate) {
          return { isValid: true, message: 'Private key matches the certificate!' }
        }
      }
    } catch (constructError) {
      // If constructing public key fails, fall through to signature verification
      console.debug('Could not construct public key from private key:', constructError)
    }

    // Primary method: Signature verification (works for both RSA and EC)
    try {
      const testData = 'test-data-for-validation'
      
      // Determine signature algorithm based on key type
      let sigAlg = 'SHA256withRSA'
      if (privateKey.curve) {
        // EC key - use ECDSA
        sigAlg = 'SHA256withECDSA'
      }
      
      const sig = new KJUR.crypto.Signature({ alg: sigAlg })
      sig.init(privateKey)
      sig.updateString(testData)
      const signature = sig.sign()

      const verifier = new KJUR.crypto.Signature({ alg: sigAlg })
      verifier.init(certPubKey)
      verifier.updateString(testData)
      const isValid = verifier.verify(signature)

      if (isValid) {
        return { isValid: true, message: 'Private key matches the certificate!' }
      } else {
        return { isValid: false, message: 'Private key does not match the certificate' }
      }
    } catch (signError) {
      // If signature verification fails, try fingerprint comparison
      const certKeyFingerprint = getPublicKeyFingerprint(certPubKey)
      const privateKeyFingerprint = getPrivateKeyFingerprint(privateKey)

      if (certKeyFingerprint === privateKeyFingerprint) {
        return { isValid: true, message: 'Private key matches the certificate!' }
      } else {
        return { isValid: false, message: 'Private key does not match the certificate' }
      }
    }

  } catch (error) {
    return { isValid: false, message: `Error validating private key: ${error.message}` }
  }
}

/**
 * Get certificate status (valid, expired, not yet valid)
 * @param {Object} cert - Certificate object (X509 from jsrsasign)
 * @returns {string} Status message
 */
export function getCertStatus(cert) {
  const now = new Date()
  const notBefore = convertX509TimeToDate(cert.getNotBefore())
  const notAfter = convertX509TimeToDate(cert.getNotAfter())
  
  if (now < notBefore) {
    return '⏳ Not yet valid'
  } else if (now > notAfter) {
    return '⚠️ Expired'
  } else {
    return '✅ Valid'
  }
}

/**
 * Get certificate fingerprint
 * @param {Object} cert - Certificate object (X509 from jsrsasign)
 * @param {string} algorithm - Hash algorithm ('sha1' or 'sha256')
 * @returns {string} Formatted fingerprint
 */
export function getFingerprint(cert, algorithm = 'sha1') {
  const derHex = cert.hex  // DER-encoded certificate as hex string
  const fingerprint = KJUR.crypto.Util.hashHex(derHex, algorithm)
  return fingerprint.toUpperCase().replace(/(.{2})/g, '$1:').slice(0, -1)
}

/**
 * Get Subject Alternative Names from certificate
 * @param {Object} cert - Certificate object (X509 from jsrsasign)
 * @returns {Array} Array of SAN strings
 */
export function getSANs(cert) {
  try { 
    const sans = cert.getExtSubjectAltName()
  if (!sans || !Array.isArray(sans)) {
    return []
  }
  
  // jsrsasign returns array of arrays: [[type, value], ...]
  // type: 2=DNS, 7=IP, 1=Email
  return sans.map((sanEntry) => {
    const [type, value] = Array.isArray(sanEntry) ? sanEntry : [sanEntry.type, sanEntry.value]
    switch (type) {
      case 2: return 'DNS: ' + value
      case 7: return 'IP: ' + value
      case 1: return 'Email: ' + value
      default: return 'Other: ' + value
    }
  })
  } catch (error) {
    return []
  }
}

/**
 * Get key size from certificate
 * @param {Object} cert - Certificate object (X509 from jsrsasign)
 * @returns {number|string} Key size in bits or 'Unknown'
 */
export function getKeySize(cert) {
  try {
    const pubKeyPem = cert.getPublicKey()
    const pubKeyObj = KEYUTIL.getKey(pubKeyPem)
    
    if (pubKeyObj) {
      // For RSA
      if (pubKeyObj.n) {
        return pubKeyObj.n.bitLength()
      }
      // For EC
      if (pubKeyObj.curve) {
        // Map curve names to bit sizes
        const curveMap = {
          'secp256r1': 256,
          'secp384r1': 384,
          'secp521r1': 521,
          'secp256k1': 256,
          'prime256v1': 256,
          'P-256': 256,
          'P-384': 384,
          'P-521': 521,
        }
        return curveMap[pubKeyObj.curve] || 'Unknown'
      }
    }
  } catch (error) {
    // Error getting key size - return unknown
  }
  return 'Unknown'
}

/**
 * Get Distinguished Name as string
 * @param {string} dnString - Distinguished Name string (from X509.getSubjectString() or getIssuerString())
 * @returns {string} Formatted DN string
 */
function getDistinguishedName(dnString) {
  // Already a string from jsrsasign, just return it
  return dnString || 'Unknown'
}

/**
 * Get public key fingerprint
 * @param {Object} publicKey - Public key object (from KEYUTIL)
 * @returns {string} SHA-256 fingerprint
 */
function getPublicKeyFingerprint(publicKey) {
  try {
    // Convert public key to PEM and then to hex for hashing
    const pubKeyPem = KEYUTIL.getPEM(publicKey)
    // Remove PEM headers and whitespace, then convert base64 to hex
    const base64Content = pubKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s/g, '')
    
    // Convert base64 to hex
    const hexContent = KJUR.crypto.Util.b64toHex(base64Content)
    const fingerprint = KJUR.crypto.Util.hashHex(hexContent, 'sha256')
    return fingerprint
  } catch (error) {
    // Fallback: use key object properties
    try {
      let keyHex = ''
      if (publicKey.n && publicKey.e) {
        // RSA key
        keyHex = publicKey.n.toString(16) + publicKey.e.toString(16)
      } else if (publicKey.x && publicKey.y) {
        // EC key
        keyHex = publicKey.x.toString(16) + publicKey.y.toString(16)
      }
      return KJUR.crypto.Util.hashHex(keyHex, 'sha256')
    } catch (e) {
      return ''
    }
  }
}

/**
 * Get private key fingerprint (by extracting public key components)
 * @param {Object} privateKey - Private key object (from KEYUTIL)
 * @returns {string} SHA-256 fingerprint
 */
function getPrivateKeyFingerprint(privateKey) {
  try {
    // Extract public key components from private key
    let publicKeyComponents = null
    
    if (privateKey.n && privateKey.e) {
      // RSA key - extract public components
      publicKeyComponents = new RSAKey()
      publicKeyComponents.setPublic(privateKey.n, privateKey.e)
    } else if (privateKey.curve && privateKey.x && privateKey.y) {
      // EC key - extract public point
      publicKeyComponents = new KJUR.crypto.ECDSA({ curve: privateKey.curve, pub: { x: privateKey.x, y: privateKey.y } })
    }
    
    if (publicKeyComponents) {
      return getPublicKeyFingerprint(publicKeyComponents)
    }
    
    // Fallback: use private key PEM directly
    const privateKeyPem = KEYUTIL.getPEM(privateKey, 'PKCS8PRV')
    const base64Content = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '')
    const hexContent = KJUR.crypto.Util.b64toHex(base64Content)
    return KJUR.crypto.Util.hashHex(hexContent, 'sha256')
  } catch (error) {
    return ''
  }
}

/**
 * Get subject field value from certificate
 * @param {Object} cert - Certificate object (X509 from jsrsasign)
 * @param {string} field - Field name (CN, O, C, etc.)
 * @param {string} type - 'subject' or 'issuer'
 * @returns {string} Field value or 'Not specified'
 */
export function getSubjectField(cert, field, type = 'subject') {
  const dnString = type === 'subject' ? cert.getSubjectString() : cert.getIssuerString()
  const attrs = parseDNString(dnString)
  return attrs[field] || 'Not specified'
}

/**
 * Comprehensive certificate verification
 * @param {string} certText - PEM certificate text
 * @param {string} keyText - Optional PEM private key text
 * @returns {Object} Complete verification results
 */
export function verifyCertificate(certText, keyText = null) {
  try {
    // First, validate certificate format
    if (!certText || !certText.trim()) {
      return {
        success: false,
        error: 'Invalid certificate. Make sure the file is a .pem.'
      }
    }

    if (!isValidPemCertificate(certText)) {
      return {
        success: false,
        error: 'Invalid certificate. Make sure the file is a .pem.'
      }
    }

    // If private key is provided, validate its format first
    if (keyText && keyText.trim()) {
      if (!isValidPemPrivateKey(keyText)) {
        return {
          success: false,
          error: 'Invalid private key. Make sure the file is a .key.'
        }
      }
    }

    // Parse certificates
    const certificates = parseCertificateChain(certText)

    if (certificates.length === 0) {
      return {
        success: false,
        error: 'Invalid certificate. Make sure the file is a .pem.'
      }
    }

    // Get certificate details
    const primaryCert = certificates[0].cert
    const notBefore = convertX509TimeToDate(primaryCert.getNotBefore())
    const notAfter = convertX509TimeToDate(primaryCert.getNotAfter())
    
    // Get signature algorithm
    const sigAlg = primaryCert.getSignatureAlgorithmName() || 'Unknown'
    
    // Get public key algorithm
    const pubKeyPem = primaryCert.getPublicKey()
    const pubKeyObj = KEYUTIL.getKey(pubKeyPem)
    let pubKeyAlg = 'RSA'
    if (pubKeyObj) {
      if (pubKeyObj.curve) {
        pubKeyAlg = 'ECDSA'
      } else if (pubKeyObj.alg && pubKeyObj.alg.includes('ECDSA')) {
        pubKeyAlg = 'ECDSA'
      }
    }
    
    const certDetails = {
      subject: getSubjectField(primaryCert, 'CN'),
      issuer: getSubjectField(primaryCert, 'CN', 'issuer'),
      serialNumber: primaryCert.getSerialNumberHex() || primaryCert.getSerialNumber(),
      validFrom: notBefore ? notBefore.toISOString() : 'Unknown',
      validTo: notAfter ? notAfter.toISOString() : 'Unknown',
      status: getCertStatus(primaryCert),
      signatureAlgorithm: sigAlg,
      publicKeyAlgorithm: pubKeyAlg,
      keySize: getKeySize(primaryCert),
      fingerprintSha1: getFingerprint(primaryCert, 'sha1'),
      fingerprintSha256: getFingerprint(primaryCert, 'sha256'),
      sans: getSANs(primaryCert)
    }

    // Validate certificate chain
    const chainValidation = validateCertificateChain(certificates)

    // Validate private key if provided
    let keyValidation = null
    if (keyText && keyText.trim()) {
      keyValidation = validatePrivateKey(certificates[0], keyText)
      
      // Check if private key matches certificate
      if (!keyValidation || !keyValidation.isValid) {
        // Private key format is already validated above, so if validation fails here, it's a mismatch
        return {
          success: false,
          certificates,
          certDetails,
          chainValidation,
          keyValidation,
          error: 'Certificate does not match private key.'
        }
      }
    }

    // Determine overall success based on validation results
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
        const certNotBefore = convertX509TimeToDate(certObj.cert.getNotBefore())
        const certNotAfter = convertX509TimeToDate(certObj.cert.getNotAfter())
        return {
          index: index + 1,
          type: index === 0 ? 'End Entity' : index === certificates.length - 1 ? 'Root CA' : 'Intermediate CA',
          subject: getSubjectField(certObj.cert, 'CN'),
          issuer: getSubjectField(certObj.cert, 'CN', 'issuer'),
          validFrom: certNotBefore ? certNotBefore.toDateString() : 'Unknown',
          validTo: certNotAfter ? certNotAfter.toDateString() : 'Unknown'
        }
      }) : null,
      error: !overallSuccess ? 
        (!chainValid ? 'Certificate chain validation failed' : 'Private key validation failed') : 
        null
    }

  } catch (error) {
    return {
      success: false,
      error: `Error parsing certificate: ${error.message}`
    }
  }
}
