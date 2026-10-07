/**
 * TLS Service - Certificate Management
 * 
 * Currently using internal store for development.
 * 
 * TO SWITCH TO REAL API:
 * 1. Uncomment the api import line below
 * 2. In fetchCertificates(): comment out the "INTERNAL STORE" section and uncomment the "REAL API" section
 * 3. In updateCertificates(): comment out the "INTERNAL STORE" section and uncomment the "REAL API" section
 * 4. Remove or comment out the internal store variables and helper functions at the bottom
 */

import { parseCertificate, getSuggestedAlias } from '../utils/certificateUtils.js'
import { getApiErrorMessage } from '../utils/apiErrorUtils.js'
import { api } from './api.js'
import { notificationService } from './notificationService.js'

// === INTERNAL STORE (remove when switching to real API) ===
// Internal store to simulate API - starts empty
let internalStore = {
  systemCertificates: [],
  certificates: [],
  pairs: []
}

// Load from localStorage if available
const STORAGE_KEY = 'tls-manager-store'
const CHANNEL_ASSIGNMENTS_KEY = 'tls-manager-channel-assignments'

try {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    internalStore = JSON.parse(stored)
  }
} catch (e) {
  console.warn('Failed to load from localStorage:', e)
}

// Save to localStorage
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(internalStore))
  } catch (e) {
    console.warn('Failed to save to localStorage:', e)
  }
}

/**
 * Fetch system certificates (native store)
 * @returns {Promise<Array>} Array of parsed certificate objects
 */
export async function fetchSystemCertificates() {
  try {
    const response = await api.get('/api/tlsmanager/systemCertificates')
    const data = response.data
    
    // Handle response structure: { list: { trustedCertificate: [{ alias, certificate }] } } or { list: { trustedCertificate: {} } }
    const certificates = []
    const certList = data?.list?.trustedCertificate
    
    // Handle both array and object formats
    let certArray = []
    if (Array.isArray(certList)) {
      certArray = certList
    } else if (certList && typeof certList === 'object') {
      // If it's a single object, wrap it in an array
      certArray = [certList]
    }
    
    for (const cert of certArray) {
      // Skip certificates with missing or empty certificate data
      if (!cert.certificate || !cert.certificate.trim()) {
        console.warn(`Skipping certificate with empty certificate data for alias: ${cert.alias || 'unknown'}`)
        continue
      }
      
      const parsed = await parseCertificate(cert.certificate)
      
      // Skip certificates that failed to parse (they have an error field)
      if (parsed.error) {
        console.warn(`Failed to parse certificate for alias "${cert.alias}": ${parsed.error}`)
        // Still include it in the list but mark it as invalid
        certificates.push({
          alias: cert.alias,
          name: cert.alias,
          type: 'Invalid',
          subject: `Parse Error: ${parsed.error}`,
          issuer: 'Unknown',
          validFrom: 'Unknown',
          validTo: 'Unknown',
          fingerprintSha1: 'Unknown',
          hasPrivateKey: false,
          store: 'native',
          rawCertificate: cert.certificate,
          parsedCertificate: parsed,
        })
        continue
      }
      
      certificates.push({
        alias: cert.alias.toString(),
        name: parsed.subject?.CN || cert.alias,
        type: parsed.type || 'Unknown',
        subject: parsed.subjectStr || 'Unknown',
        issuer: parsed.issuerStr || 'Unknown',
        validFrom: parsed.validFrom,
        validTo: parsed.validTo,
        fingerprintSha1: parsed.fingerprintSha1,
        hasPrivateKey: false,
        store: 'native',
        rawCertificate: cert.certificate,
        parsedCertificate: parsed,
      })
    }
    
    return certificates
  } catch (error) {
    const errorMessage = 'Failed to fetch system certificates from server'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Fetch remote certificates from a URL
 * @param {string} url - The URL to fetch certificates from (must be https://)
 * @returns {Promise<Array>} Array of certificate objects with PEM text and parsed details
 */
export async function fetchRemoteCertificates(url) {
  try {
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error('URL must be a valid HTTPS URL')
    }
    
    const response = await api.get('/api/tlsmanager/remoteCertificates', {
      params: { url }
    })
    const data = response.data
    
    // Handle response structure: { list: { trustedCertificate: [{ certificate: "..." }] } }
    const certificates = []
    const certList = data?.list?.trustedCertificate
    
    // Handle both array and object formats
    let certArray = []
    if (Array.isArray(certList)) {
      certArray = certList
    } else if (certList && typeof certList === 'object') {
      // If it's a single object, wrap it in an array
      certArray = [certList]
    }
    
    for (const cert of certArray) {
      // Skip certificates with missing or empty certificate data
      if (!cert.certificate || !cert.certificate.trim()) {
        console.warn('Skipping remote certificate with empty certificate data')
        continue
      }
      
      try {
        const parsed = await parseCertificate(cert.certificate)
        
        // Handle parse errors gracefully
        if (parsed.error) {
          certificates.push({
            certificate: cert.certificate,
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
          continue
        }
        
        certificates.push({
          alias: getSuggestedAlias(parsed),
          certificate: cert.certificate,
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
        console.warn('Failed to parse remote certificate:', parseError)
        certificates.push({
          certificate: cert.certificate,
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
    }
    
    return certificates
  } catch (error) {
    const errorMessage = getApiErrorMessage(error, 'Failed to fetch remote certificates from server')
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Fetch trusted certificates
 * @returns {Promise<Array>} Array of parsed certificate objects
 */
export async function fetchTrustedCertificates() {
  try {
    const response = await api.get('/api/tlsmanager/trustedCertificates')
    const data = response.data
    
    // Handle response structure: { list: { trustedCertificate: [{ alias, certificate }] } }
    const certificates = []
    const certList = data?.list?.trustedCertificate || []

    // Handle both array and object formats
    let certArray = []
    if (Array.isArray(certList)) {
      certArray = certList
    } else if (certList && typeof certList === 'object') {
      // If it's a single object, wrap it in an array
      certArray = [certList]
    }
    
    for (const cert of certArray) {
      // Skip certificates with missing or empty certificate data
      if (!cert.certificate || !cert.certificate.trim()) {
        console.warn(`Skipping trusted certificate with empty certificate data for alias: ${cert.alias || 'unknown'}`)
        continue
      }
      
      const parsed = await parseCertificate(cert.certificate)
      // Use channelsInUse from API response (channelsInUse.string is an array)
      const channelsInUse = getChannelsInUse(cert)
      
      // Handle parse errors gracefully
      if (parsed.error) {
        console.warn(`Failed to parse trusted certificate for alias "${cert.alias}": ${parsed.error}`)
        certificates.push({
          alias: cert.alias,
          name: cert.alias,
          type: 'Invalid',
          subject: `Parse Error: ${parsed.error}`,
          issuer: 'Unknown',
          validFrom: 'Unknown',
          validTo: 'Unknown',
          fingerprintSha1: 'Unknown',
          hasPrivateKey: false,
          store: 'trusted',
          channelsInUse: channelsInUse,
          rawCertificate: cert.certificate,
          parsedCertificate: parsed,
        })
        continue
      }
      
      certificates.push({
        alias: cert.alias.toString(),
        name: parsed.subject?.CN || cert.alias,
        type: parsed.type || 'Unknown',
        subject: parsed.subjectStr || 'Unknown',
        issuer: parsed.issuerStr || 'Unknown',
        validFrom: parsed.validFrom,
        validTo: parsed.validTo,
        fingerprintSha1: parsed.fingerprintSha1,
        hasPrivateKey: false,
        store: 'trusted',
        channelsInUse: channelsInUse,
        rawCertificate: cert.certificate,
        parsedCertificate: parsed,
      })
    }
    
    return certificates
  } catch (error) {
    const errorMessage = 'Failed to fetch trusted certificates from server'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

/**
 * Fetch local certificates (private store)
 * @returns {Promise<Array>} Array of parsed certificate objects with private keys
 */
export async function fetchLocalCertificates() {
  try {
    const response = await api.get('/api/tlsmanager/localCertificates')
    const data = response.data
    
    // Handle response structure: { list: { localCertificate: [{ alias, certificate, key }] } }
    const certificates = []
    const certList = data?.list?.localCertificate || []

    // Handle both array and object formats
    let certArray = []
    if (Array.isArray(certList)) {
      certArray = certList
    } else if (certList && typeof certList === 'object') {
      // If it's a single object, wrap it in an array
      certArray = [certList]
    }
    
    for (const cert of certArray) {
      // Skip certificates with missing or empty certificate data
      if (!cert.certificate || !cert.certificate.trim()) {
        console.warn(`Skipping local certificate with empty certificate data for alias: ${cert.alias || 'unknown'}`)
        continue
      }
      
      const parsed = await parseCertificate(cert.certificate)
      // Use channelsInUse from API response (channelsInUse.string is an array)
      const channelsInUse = getChannelsInUse(cert)
      
      // Handle parse errors gracefully
      if (parsed.error) {
        console.warn(`Failed to parse local certificate for alias "${cert.alias}": ${parsed.error}`)
        certificates.push({
          alias: cert.alias,
          name: cert.alias,
          type: 'Invalid',
          subject: `Parse Error: ${parsed.error}`,
          issuer: 'Unknown',
          validFrom: 'Unknown',
          validTo: 'Unknown',
          fingerprintSha1: 'Unknown',
          hasPrivateKey: true,
          store: 'private',
          channelsInUse: channelsInUse,
          rawCertificate: cert.certificate,
          rawPrivateKey: cert.key, // Include private key in response
          parsedCertificate: parsed,
        })
        continue
      }
      
      certificates.push({
        alias: cert.alias.toString(),
        name: parsed.subject?.CN || cert.alias,
        type: parsed.type || 'Unknown',
        subject: parsed.subjectStr || 'Unknown',
        issuer: parsed.issuerStr || 'Unknown',
        validFrom: parsed.validFrom,
        validTo: parsed.validTo,
        fingerprintSha1: parsed.fingerprintSha1,
        hasPrivateKey: true,
        store: 'private',
        channelsInUse: channelsInUse,
        rawCertificate: cert.certificate,
        rawPrivateKey: cert.key, // Include private key in response
        parsedCertificate: parsed,
      })
    }
    
    return certificates
  } catch (error) {
    const errorMessage = 'Failed to fetch local certificates from server'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

function getChannelsInUse(cert) {
  if (typeof cert.channelsInUse?.string === 'string') {
    return [cert.channelsInUse.string]
  }
  return cert.channelsInUse?.string || []
}

// Legacy function - kept for backward compatibility, but should use tab-specific functions instead
export async function fetchCertificates() {
  try {
    // === INTERNAL STORE (for development) ===
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const data = internalStore
    
    // === REAL API (uncomment when API is ready) ===
    // const response = await api.get('/api/tlsmanager/certificates')
    // const data = response.data
    
    const certificates = []
    
    // Map systemCertificates to native store
    if (data.systemCertificates) {
      for (const cert of data.systemCertificates) {
        const parsed = await parseCertificate(cert.certificate)
        certificates.push({
          alias: cert.alias,
          name: parsed.subject?.CN || cert.alias,
          type: parsed.type || 'Unknown',
          subject: parsed.subjectStr || 'Unknown',
          issuer: parsed.issuerStr || 'Unknown',
          validFrom: parsed.validFrom,
          validTo: parsed.validTo,
          fingerprintSha1: parsed.fingerprintSha1,
          hasPrivateKey: false,
          store: 'native',
          rawCertificate: cert.certificate,
          parsedCertificate: parsed,
        })
      }
    }
    
    // Map certificates to trusted store
    if (data.certificates) {
      for (const cert of data.certificates) {
        const parsed = await parseCertificate(cert.certificate)
        // Use channelsInUse from API response (channelsInUse.string is an array)
        const channelsInUse = cert.channelsInUse?.string || []
        certificates.push({
          alias: cert.alias,
          name: parsed.subject?.CN || cert.alias,
          type: parsed.type || 'Unknown',
          subject: parsed.subjectStr || 'Unknown',
          issuer: parsed.issuerStr || 'Unknown',
          validFrom: parsed.validFrom,
          validTo: parsed.validTo,
          fingerprintSha1: parsed.fingerprintSha1,
          hasPrivateKey: false,
          store: 'trusted',
          channelsInUse: channelsInUse,
          rawCertificate: cert.certificate,
          parsedCertificate: parsed,
        })
      }
    }
    
    // Map pairs to private store
    if (data.pairs) {
      for (const pair of data.pairs) {
        const parsed = await parseCertificate(pair.certificate)
        // Use channelsInUse from API response (channelsInUse.string is an array)
        const channelsInUse = pair.channelsInUse?.string || []
        certificates.push({
          alias: pair.alias,
          name: parsed.subject?.CN || pair.alias,
          type: parsed.type || 'Unknown',
          subject: parsed.subjectStr || 'Unknown',
          issuer: parsed.issuerStr || 'Unknown',
          validFrom: parsed.validFrom,
          validTo: parsed.validTo,
          fingerprintSha1: parsed.fingerprintSha1,
          hasPrivateKey: true,
          store: 'private',
          channelsInUse: channelsInUse,
          rawCertificate: pair.certificate,
          rawPrivateKey: pair.privateKey, // Include private key in response
          parsedCertificate: parsed,
        })
      }
    }
    
    return certificates
  } catch (error) {
    const errorMessage = 'Failed to fetch certificates from server'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function updateCertificates(targetStore, certificateData, currentCertificates = null) {
  try {
    const { alias, pemText, privateKeyText } = certificateData
    
    let certificates = currentCertificates
    
    // If currentCertificates not provided, fetch from API
    if (!certificates) {
      if (targetStore === 'trusted') {
        certificates = await fetchTrustedCertificates()
      } else if (targetStore === 'private') {
        certificates = await fetchLocalCertificates()
      } else {
        throw new Error('Invalid store type')
      }
    }
    
    // Check if certificate with same alias exists
    const existingIndex = certificates.findIndex(c => c.alias === alias)
    
    // Update or add certificate in the array
    if (existingIndex >= 0) {
      // Update existing certificate - preserve other fields, update certificate data
      certificates[existingIndex] = {
        ...certificates[existingIndex],
        alias,
        rawCertificate: pemText, // Update with new PEM
        ...(targetStore === 'private' && privateKeyText ? { rawPrivateKey: privateKeyText } : {})
      }
    } else {
      // Add new certificate
      const newCert = {
        alias,
        rawCertificate: pemText,
        ...(targetStore === 'private' && privateKeyText ? { rawPrivateKey: privateKeyText } : {})
      }
      certificates.push(newCert)
    }
    
    // Reconstruct API payload format
    let payload
    if (targetStore === 'trusted') {
      payload = {
        list: {
          trustedCertificate: certificates.map(cert => ({
            alias: cert.alias,
            certificate: cert.rawCertificate // Use rawCertificate (PEM format)
          }))
        }
      }
      const response = await api.put('/api/tlsmanager/trustedCertificates', payload)
      return { success: true, data: response.data || { alias, targetStore } }
    } else if (targetStore === 'private') {
      payload = {
        list: {
          localCertificate: certificates.map(cert => ({
            alias: cert.alias,
            certificate: cert.rawCertificate, // Use rawCertificate (PEM format)
            key: cert.rawPrivateKey // Use rawPrivateKey (PEM format)
          }))
        }
      }
      const response = await api.put('/api/tlsmanager/localCertificates', payload)
      return { success: true, data: response.data || { alias, targetStore } }
    } else {
      throw new Error('Invalid store type')
    }
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Failed to update certificates'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function updateCertificateAlias(store, oldAlias, newAlias, currentCertificates = null) {
  try {
    let certificates = currentCertificates
    
    // If currentCertificates not provided, fetch from API
    if (!certificates) {
      if (store === 'trusted') {
        certificates = await fetchTrustedCertificates()
      } else if (store === 'private') {
        certificates = await fetchLocalCertificates()
      } else {
        throw new Error('Invalid store type')
      }
    }
    
    // Find certificate by old alias
    const certIndex = certificates.findIndex(c => c.alias === oldAlias)
    if (certIndex < 0) {
      throw new Error('Certificate not found')
    }
    
    // Update only the alias field
    certificates[certIndex] = {
      ...certificates[certIndex],
      alias: newAlias
    }
    
    // Reconstruct API payload format
    let payload
    if (store === 'trusted') {
      payload = {
        list: {
          trustedCertificate: certificates.map(cert => ({
            alias: cert.alias,
            certificate: cert.rawCertificate // Use rawCertificate (PEM format)
          }))
        }
      }
      const response = await api.put('/api/tlsmanager/trustedCertificates', payload)
      return { success: true, data: response.data || { store, oldAlias, newAlias } }
    } else if (store === 'private') {
      payload = {
        list: {
          localCertificate: certificates.map(cert => ({
            alias: cert.alias,
            certificate: cert.rawCertificate, // Use rawCertificate (PEM format)
            key: cert.rawPrivateKey // Use rawPrivateKey (PEM format)
          }))
        }
      }
      const response = await api.put('/api/tlsmanager/localCertificates', payload)
      return { success: true, data: response.data || { store, oldAlias, newAlias } }
    } else {
      throw new Error('Invalid store type')
    }
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Failed to update certificate alias'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function removeCertificate(store, alias, currentCertificates = null) {
  try {
    let certificates = currentCertificates
    
    // If currentCertificates not provided, fetch from API
    if (!certificates) {
      if (store === 'trusted') {
        certificates = await fetchTrustedCertificates()
      } else if (store === 'private') {
        certificates = await fetchLocalCertificates()
      } else {
        throw new Error('Invalid store type')
      }
    }
    
    // Remove certificate from array by alias
    const certIndex = certificates.findIndex(c => c.alias === alias)
    if (certIndex < 0) {
      throw new Error('Certificate not found')
    }
    
    // Remove the certificate
    certificates.splice(certIndex, 1)
    
    // Reconstruct API payload format
    let payload
    if (store === 'trusted') {
      payload = {
        list: {
          trustedCertificate: certificates.map(cert => ({
            alias: cert.alias,
            certificate: cert.rawCertificate // Use rawCertificate (PEM format)
          }))
        }
      }
      const response = await api.put('/api/tlsmanager/trustedCertificates', payload)
      return { success: true, data: response.data || { store, alias } }
    } else if (store === 'private') {
      payload = {
        list: {
          localCertificate: certificates.map(cert => ({
            alias: cert.alias,
            certificate: cert.rawCertificate, // Use rawCertificate (PEM format)
            key: cert.rawPrivateKey // Use rawPrivateKey (PEM format)
          }))
        }
      }
      const response = await api.put('/api/tlsmanager/localCertificates', payload)
      return { success: true, data: response.data || { store, alias } }
    } else {
      throw new Error('Invalid store type')
    }
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Failed to remove certificate'
    notificationService.showError(errorMessage)
    throw new Error(errorMessage)
  }
}

// === INTERNAL STORE HELPER FUNCTIONS (remove when switching to real API) ===
// Helper function to clear the internal store (useful for testing)
export function clearInternalStore() {
  internalStore = {
    systemCertificates: [],
    certificates: [],
    pairs: []
  }
  saveToStorage()
  console.log('[Internal Store] Cleared')
}

// Helper function to get current store state (for debugging)
export function getInternalStore() {
  return { ...internalStore }
}
