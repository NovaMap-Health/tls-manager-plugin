import { useState, useRef, useEffect } from 'react'
import { parseCertificate, getSuggestedAlias, isValidPemCertificate, isValidPemPrivateKey } from '../utils/certificateUtils'
import { verifyCertificate } from '../utils/verificationUtils'
import { fetchCertificates } from '../services/tlsService'
import { useNotification } from '../context/NotificationContext'

export const useCertificateImport = (targetStore, currentCertificates = null) => {
  const { showError } = useNotification()
  
  // State management
  const [alias, setAlias] = useState('')
  const [pemText, setPemText] = useState('')
  const [privateKeyText, setPrivateKeyText] = useState('')
  const [file, setFile] = useState(null)
  const [privateKeyFile, setPrivateKeyFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [errors, setErrors] = useState({})
  const [certificateDetails, setCertificateDetails] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [existingCertificates, setExistingCertificates] = useState(currentCertificates || [])
  const [aliasWarning, setAliasWarning] = useState(null)
  const [existingCertificateInfo, setExistingCertificateInfo] = useState(null)

  // Refs
  const fileInputRef = useRef(null)
  const privateKeyFileInputRef = useRef(null)

  const certFileAccept = '.pem,.crt'
  const keyFileAccept = '.pem,.key'

  // Load existing certificates to check for alias conflicts
  const loadExistingCertificates = async () => {
    // If currentCertificates were provided, use them instead of fetching
    if (currentCertificates && currentCertificates.length > 0) {
      setExistingCertificates(currentCertificates)
      return
    }
    
    try {
      const certificates = await fetchCertificates()
      setExistingCertificates(certificates)
    } catch (error) {
      // Service already shows notification, no need to show again
    }
  }
  
  // Update existingCertificates when currentCertificates prop changes
  useEffect(() => {
    if (currentCertificates && currentCertificates.length > 0) {
      setExistingCertificates(currentCertificates)
    }
  }, [currentCertificates])

  // Check if alias already exists within the target store
  const checkAliasExists = (aliasToCheck) => {
    if (!aliasToCheck.trim()) {
      setAliasWarning(null)
      setExistingCertificateInfo(null)
      return false
    }

    const existingCert = existingCertificates.find(cert => 
      cert.store === targetStore &&
      cert.alias.toLowerCase() === aliasToCheck.toLowerCase()
    )
    
    if (existingCert) {
      setAliasWarning('This alias is already in use in this store')
      setExistingCertificateInfo(existingCert)
      return true
    } else {
      setAliasWarning(null)
      setExistingCertificateInfo(null)
      return false
    }
  }



  // Parse certificate details when PEM text changes
  const parseCertificateDetails = async (pemText) => {
    if (!pemText.trim()) {
      setCertificateDetails(null)
      setVerificationResult(null)
      setErrors((prev) => ({ ...prev, pemText: undefined }))
      return
    }

    // Validate certificate format
    if (!isValidPemCertificate(pemText)) {
      setCertificateDetails(null)
      setVerificationResult(null)
      setErrors((prev) => ({ ...prev, pemText: 'Invalid certificate format. Content must contain a valid certificate (BEGIN CERTIFICATE).' }))
      return
    }

    try {
      const details = await parseCertificate(pemText)
      setCertificateDetails(details)
      
      // Clear any previous errors
      setErrors((prev) => ({ ...prev, pemText: undefined }))
      
      // Auto-complete alias if it's empty
      if (!alias.trim()) {
        const suggestedAlias = getSuggestedAlias(details)
        if (suggestedAlias) {
          setAlias(suggestedAlias)
          // Check for conflicts immediately after setting the suggested alias
          checkAliasExists(suggestedAlias)
        }
      } else {
        // If alias is already set, check for conflicts
        checkAliasExists(alias)
      }

      // Auto-verify certificate
      await performAutoVerification(pemText)
    } catch (error) {
      showError('Failed to parse certificate details. Please check the certificate format.')
      setCertificateDetails(null)
      setVerificationResult(null)
      setErrors((prev) => ({ ...prev, pemText: 'Invalid certificate format. Content must contain a valid certificate (BEGIN CERTIFICATE).' }))
    }
  }

  // Perform auto-verification
  const performAutoVerification = async (pemText, privateKeyPem = null) => {
    if (!pemText.trim()) return

    setIsVerifying(true)
    try {
      // Use provided private key or current state
      const keyToUse = privateKeyPem !== null ? privateKeyPem : 
        (targetStore === 'private' && privateKeyText.trim() ? privateKeyText : null)
      
      const result = await verifyCertificate(pemText, keyToUse)
      setVerificationResult(result)
    } catch (error) {
      setVerificationResult({
        success: false,
        error: `Auto-verification failed: ${error.message}`
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Handle certificate verification
  const handleVerifyCertificate = async () => {
    if (!pemText.trim()) return

    setIsVerifying(true)
    try {
      const result = await verifyCertificate(pemText, privateKeyText || null)
      setVerificationResult(result)
    } catch (error) {
      setVerificationResult({
        success: false,
        error: error.message || 'Verification failed'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  // Validation logic
  const validate = () => {
    const nextErrors = {}
    if (!pemText.trim()) {
      nextErrors.pemText = 'PEM content is required.'
    }
    if (!alias.trim()) {
      nextErrors.alias = 'Alias is required.'
    }
    if (targetStore === 'private' && !privateKeyText.trim()) {
      nextErrors.privateKeyText = 'Private key is required for private store.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  // Handle file upload
  const handleFileUpload = async (e) => {
    try {
      const f = e.target.files && e.target.files[0]
      setFile(f || null)
      if (!f) return
      const name = (f.name || '').toLowerCase()
      if (!(name.endsWith('.pem') || name.endsWith('.crt'))) {
        setErrors((prev) => ({ ...prev, file: 'Please select a .pem or .crt file.' }))
        return
      }
      const text = await f.text()
      
      // Validate certificate format
      if (!isValidPemCertificate(text)) {
        setErrors((prev) => ({ ...prev, file: 'Invalid certificate format. File must contain a valid certificate (BEGIN CERTIFICATE).', pemText: 'Invalid certificate format. File must contain a valid certificate (BEGIN CERTIFICATE).' }))
        setPemText(text) // Still set the text so user can see what was uploaded
        setCertificateDetails(null)
        setVerificationResult(null)
        return
      }
      
      setPemText(text)
      await parseCertificateDetails(text) // This will now auto-verify and check for alias conflicts
      setErrors((prev) => ({ ...prev, file: undefined, pemText: undefined }))
    } catch (err) {
      setErrors((prev) => ({ ...prev, file: 'Failed to read file.' }))
    }
  }

  // Handle private key file upload
  const handlePrivateKeyFileUpload = async (e) => {
    try {
      const f = e.target.files && e.target.files[0]
      setPrivateKeyFile(f || null)
      if (!f) return
      const name = (f.name || '').toLowerCase()
      if (!(name.endsWith('.pem') || name.endsWith('.key'))) {
        setErrors((prev) => ({ ...prev, privateKeyFile: 'Please select a .pem or .key file.' }))
        return
      }
      const text = await f.text()
      
      // Validate private key format
      if (!isValidPemPrivateKey(text)) {
        setErrors((prev) => ({ ...prev, privateKeyFile: 'Invalid private key format. File must contain a valid private key (BEGIN PRIVATE KEY or BEGIN RSA PRIVATE KEY).', privateKeyText: 'Invalid private key format. File must contain a valid private key (BEGIN PRIVATE KEY or BEGIN RSA PRIVATE KEY).' }))
        setPrivateKeyText(text) // Still set the text so user can see what was uploaded
        setVerificationResult(null)
        return
      }
      
      setPrivateKeyText(text)
      
      // Auto-verify if certificate is already present
      if (pemText.trim()) {
        await performAutoVerification(pemText, text)
      }
      
      setErrors((prev) => ({ ...prev, privateKeyFile: undefined, privateKeyText: undefined }))
    } catch (err) {
      setErrors((prev) => ({ ...prev, privateKeyFile: 'Failed to read file.' }))
    }
  }

  // Handle PEM text change
  const handlePemTextChange = async (e) => {
    setPemText(e.target.value)
    await parseCertificateDetails(e.target.value) // This will now auto-verify and check for alias conflicts
  }

  // Handle private key text change
  const handlePrivateKeyTextChange = async (e) => {
    const newPrivateKeyText = e.target.value
    setPrivateKeyText(newPrivateKeyText)
    
    // Validate private key format if text is provided
    if (newPrivateKeyText.trim()) {
      if (!isValidPemPrivateKey(newPrivateKeyText)) {
        setErrors((prev) => ({ ...prev, privateKeyText: 'Invalid private key format. Content must contain a valid private key (BEGIN PRIVATE KEY or BEGIN RSA PRIVATE KEY).' }))
        setVerificationResult(null)
        return
      } else {
        setErrors((prev) => ({ ...prev, privateKeyText: undefined }))
      }
    } else {
      setErrors((prev) => ({ ...prev, privateKeyText: undefined }))
    }
    
    // Auto-verify if certificate is already present
    if (pemText.trim()) {
      await performAutoVerification(pemText, newPrivateKeyText)
    }
  }

  // Handle alias change
  const handleAliasChange = (e) => {
    const newAlias = e.target.value
    setAlias(newAlias)
    checkAliasExists(newAlias)
  }

  return {
    // State
    alias,
    pemText,
    privateKeyText,
    file,
    privateKeyFile,
    loading,
    apiError,
    errors,
    certificateDetails,
    verificationResult,
    isVerifying,
    existingCertificates,
    aliasWarning,
    existingCertificateInfo,
    
    // Refs
    fileInputRef,
    privateKeyFileInputRef,
    certFileAccept,
    keyFileAccept,
    
    // Actions
    setAlias,
    setPemText,
    setPrivateKeyText,
    setFile,
    setPrivateKeyFile,
    setLoading,
    setApiError,
    setErrors,
    setCertificateDetails,
    setVerificationResult,
    setIsVerifying,
    
    // Handlers
    handleVerifyCertificate,
    handleFileUpload,
    handlePrivateKeyFileUpload,
    handlePemTextChange,
    handlePrivateKeyTextChange,
    handleAliasChange,
    parseCertificateDetails,
    validate,
    loadExistingCertificates,
    checkAliasExists,
    performAutoVerification
  }
}
