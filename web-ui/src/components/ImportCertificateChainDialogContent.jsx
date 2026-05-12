import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Stack,
  Button,
  TextField,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material'
import { parseCertificateChainFromPem } from '../utils/certificateUtils.js'
import TrustedCertificateImportForm from './TrustedCertificateImportForm'
import CertificateChainSelector from './CertificateChainSelector'
import ConfirmReplaceCertificateDialog from './ConfirmReplaceCertificateDialog'
import { updateCertificates } from '../services/tlsService.js'
import { verifyCertificate } from '../utils/verificationUtils.js'

export default function ImportCertificateChainDialogContent({
  targetStore = 'trusted',
  currentCertificates = null,
  onCancel,
  onSuccess,
}) {
  const [pemText, setPemText] = useState('')
  const [file, setFile] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [certificates, setCertificates] = useState([])
  const [selectedCertificateIndex, setSelectedCertificateIndex] = useState(null)
  const [selectedCertificatePem, setSelectedCertificatePem] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const [existingCertificateInfo, setExistingCertificateInfo] = useState(null)
  const [confirmAlias, setConfirmAlias] = useState('')
  const formRef = useRef(null)
  const fileInputRef = useRef(null)

  // Parse certificate chain when PEM text changes
  useEffect(() => {
    let cancelled = false
    if (pemText.trim()) {
      parseCertificateChainFromPem(pemText)
        .then(parsed => {
          if (cancelled) return
          if (parsed.length === 0) {
            setParseError('No valid certificates found in the provided text')
            setCertificates([])
            setSelectedCertificateIndex(null)
            setSelectedCertificatePem(null)
          } else {
            setParseError(null)
            setCertificates(parsed)
            if (parsed.length > 0) {
              setSelectedCertificateIndex(0)
              setSelectedCertificatePem(parsed[0].certificate)
            }
          }
        })
        .catch(err => {
          if (cancelled) return
          setParseError(`Failed to parse certificates: ${err.message}`)
          setCertificates([])
          setSelectedCertificateIndex(null)
          setSelectedCertificatePem(null)
        })
      return () => { cancelled = true }
    } else {
      setParseError(null)
      setCertificates([])
      setSelectedCertificateIndex(null)
      setSelectedCertificatePem(null)
    }
  }, [pemText])

  // Update selected certificate PEM when index changes
  useEffect(() => {
    if (selectedCertificateIndex !== null && certificates[selectedCertificateIndex]) {
      setSelectedCertificatePem(certificates[selectedCertificateIndex].certificate)
      setImportLoading(false) // Reset loading when certificate selection changes
    }
  }, [selectedCertificateIndex, certificates])

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) {
      return
    }

    // Validate file extension
    const name = (uploadedFile.name || '').toLowerCase()
    if (!(name.endsWith('.pem') || name.endsWith('.crt'))) {
      setParseError('Please select a .pem or .crt file.')
      setFile(null)
      return
    }

    setFile(uploadedFile)
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const fileContent = event.target?.result
      if (fileContent) {
        setPemText(fileContent)
      }
    }
    reader.onerror = () => {
      setParseError('Failed to read file')
      setFile(null)
    }
    reader.readAsText(uploadedFile)
  }

  const handleCertificateSelect = (index) => {
    setSelectedCertificateIndex(index)
    const selectedCert = certificates[index]
    setSelectedCertificatePem(selectedCert.certificate)
  }

  const fileAccept = '.pem,.crt'

  const performFinalVerification = async (pemText) => {
    try {
      const verificationResult = await verifyCertificate(pemText, null)
      
      if (!verificationResult.success) {
        setValidationError(verificationResult.error || 'Certificate validation failed')
        setShowValidationDialog(true)
        return false
      }
      return true
    } catch (error) {
      setValidationError('Certificate validation failed: ' + error.message)
      setShowValidationDialog(true)
      return false
    }
  }

  const performImport = async (alias, pemText) => {
    setImportLoading(true)
    try {
      const result = await updateCertificates('trusted', {
        alias,
        pemText,
      }, currentCertificates)
      if (result.success) {
        setImportLoading(false)
        onSuccess?.(result.data)
      } else {
        setImportLoading(false)
        if (formRef.current) {
          formRef.current.setApiError(result.error || 'Failed to import certificate')
        }
      }
    } catch (error) {
      setImportLoading(false)
      if (formRef.current) {
        formRef.current.setApiError(error.message || 'Failed to import certificate')
      }
    }
  }

  const handleSubmit = async () => {
    if (!formRef.current) return

    if (!formRef.current.validate()) return

    // Check if alias already exists
    const aliasExists = formRef.current.checkAliasExists()
    if (aliasExists) {
      // Find the existing certificate info for the confirmation dialog
      const alias = formRef.current.alias
      setConfirmAlias(alias)
      const existingCert = currentCertificates?.find(c => 
        c.alias.toLowerCase() === alias.toLowerCase() && 
        c.store === targetStore
      )
      setExistingCertificateInfo(existingCert || null)
      setShowConfirmDialog(true)
      return
    }

    // Final verification before import
    const verificationPassed = await performFinalVerification(formRef.current.pemText)
    if (!verificationPassed) return

    // Proceed with import if verification passes
    await performImport(formRef.current.alias, formRef.current.pemText)
  }

  const handleConfirmReplace = async () => {
    setShowConfirmDialog(false)
    
    if (!formRef.current) return

    // Final verification before import
    const verificationPassed = await performFinalVerification(formRef.current.pemText)
    if (!verificationPassed) return

    // Proceed with import if verification passes
    await performImport(formRef.current.alias, formRef.current.pemText)
  }

  return (
    <Box sx={{ 
      pt: 0.5,
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* PEM Input Section */}
      <Box sx={{ mb: 3 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={fileAccept}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
            {file ? 'Change Certificate File' : 'Choose Certificate File'}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {file ? file.name : 'No file selected'}
          </Typography>
        </Stack>

        <TextField
          label="PEM Certificate Chain"
          placeholder="-----BEGIN CERTIFICATE-----\n...base64...\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\n...base64...\n-----END CERTIFICATE-----"
          value={pemText}
          onChange={(e) => setPemText(e.target.value)}
          error={!!parseError}
          helperText={parseError || 'Paste certificate or upload a file'}
          multiline
          minRows={4}
          maxRows={7}
          fullWidth
          autoFocus
        />

        {certificates.length > 0 && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Found {certificates.length} certificate{certificates.length > 1 ? 's' : ''} in the chain
          </Alert>
        )}
      </Box>

      {/* Certificate List and Import Details - Vertical Layout */}
      {certificates.length > 0 && (
        <Box sx={{ 
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          {/* Top Section - Certificate List */}
          <CertificateChainSelector
            certificates={certificates}
            selectedIndex={selectedCertificateIndex}
            onSelect={handleCertificateSelect}
            loading={importLoading}
          />

          {/* Bottom Section - Import Certificate Details */}
          <Box sx={{ 
            flex: 1,
            minHeight: 0,
          }}>
            {selectedCertificatePem ? (
              <TrustedCertificateImportForm
                ref={formRef}
                key={selectedCertificateIndex}
                currentCertificates={currentCertificates}
                initialPemText={selectedCertificatePem}
                readOnlyPem={true}
              />
            ) : (
              <Alert severity="info">
                Select a certificate from the list to view details and import
              </Alert>
            )}
          </Box>
        </Box>
      )}

      {/* Fixed buttons at bottom - only show when certificate is selected */}
      {certificates.length > 0 && selectedCertificatePem && (
        <Stack 
          direction="row" 
          spacing={1} 
          justifyContent="flex-end" 
          position="absolute"
          bottom={0}
          
          right={2}
          width="100%"
          backgroundColor="background.paper"
          sx={{ 
            pt: 2, 
            pb: 2,
            borderTop: '1px solid', 
            borderColor: 'divider',
            mt: 'auto',
            flexShrink: 0
          }}
        >
          <Button onClick={onCancel} disabled={importLoading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={importLoading}
          >
            {importLoading ? 'Importing...' : 'Import Certificate'}
          </Button>
        </Stack>
      )}

      {/* Confirmation Dialog for Replacing Existing Certificate */}
      <ConfirmReplaceCertificateDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmReplace}
        alias={confirmAlias}
        store={targetStore}
        loading={importLoading}
        existingCertificateInfo={existingCertificateInfo}
      />

      {/* Validation Error Dialog */}
      <Dialog
        open={showValidationDialog}
        onClose={() => setShowValidationDialog(false)}
        aria-labelledby="validation-dialog-title"
        aria-describedby="validation-dialog-description"
      >
        <DialogTitle id="validation-dialog-title">
          Certificate Validation Failed
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="validation-dialog-description">
            {validationError}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowValidationDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}

