import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Chip,
  Stack,
  Paper,
  Grid,
  IconButton,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { Visibility, VisibilityOff, ExpandMore, ExpandLess, CheckCircle, Error, Warning } from '@mui/icons-material'
import { formatDate } from '../utils/dateUtils.js'
import { verifyCertificate } from '../utils/verificationUtils.js'
import { base64ToPem, base64ToPrivateKeyPem } from '../utils/certificateUtils.js'

// Threshold for showing expand/collapse buttons
const ITEMS_THRESHOLD = 6

export default function CertificateDetailsDialog({ open, onClose, certificate }) {
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [verificationResult, setVerificationResult] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [sanExpanded, setSanExpanded] = useState(false)
  const [channelsExpanded, setChannelsExpanded] = useState(false)

  // Early return after all hooks
  if (!certificate) return null

  // Extract parsed data
  const { parsedCertificate, rawCertificate, channelsInUse } = certificate

  // Calculate total SAN count for determining if expand button should show
  const sanCount = (parsedCertificate?.subjectAltNames?.dns?.length || 0) +
    (parsedCertificate?.subjectAltNames?.ip?.length || 0) +
    (parsedCertificate?.subjectAltNames?.uri?.length || 0) +
    (parsedCertificate?.subjectAltNames?.email?.length || 0) +
    (parsedCertificate?.subjectAltNames?.dn?.length || 0)

  // Show expand buttons based on item count (simple and reliable)
  const showSanExpandButton = sanCount > ITEMS_THRESHOLD
  const showChannelsExpandButton = (channelsInUse?.length || 0) > ITEMS_THRESHOLD

  const getStatusColor = (validFrom, validTo) => {
    const now = new Date()
    const validFromDate = new Date(validFrom)
    const validToDate = new Date(validTo)
    
    if (now < validFromDate) return 'warning'
    if (now > validToDate) return 'error'
    
    // Check if expiring within 30 days
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (validToDate < thirtyDaysFromNow) return 'warning'
    
    return 'success'
  }

  const getStatusText = (validFrom, validTo) => {
    const now = new Date()
    const validFromDate = new Date(validFrom)
    const validToDate = new Date(validTo)
    
    if (now < validFromDate) return 'Not Yet Valid'
    if (now > validToDate) return 'Expired'
    
    // Check if expiring within 30 days
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (validToDate < thirtyDaysFromNow) return 'Expiring Soon'
    
    return 'Valid'
  }


  const formatExtensions = (extensions) => {
    if (!extensions || extensions.length === 0) return []
    
    return extensions.map(ext => ({
      name: ext.name,
      value: ext.names?.join(', '),
      critical: ext.critical || false
    }))
  }

  const handleVerifyCertificate = async () => {
    setIsVerifying(true)
    try {
      // Convert Base64 certificate to PEM format
      const pemCertificate = base64ToPem(rawCertificate)
      
      // If private key is available, include it in verification
      const privateKeyPem = certificate.hasPrivateKey && certificate.rawPrivateKey 
        ? base64ToPrivateKeyPem(certificate.rawPrivateKey) 
        : null
      
      const result = await verifyCertificate(pemCertificate, privateKeyPem)
      setVerificationResult(result)
    } catch (error) {
      setVerificationResult({
        success: false,
        error: `Verification failed: ${error.message}`
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6">Certificate Details</Typography>
          <Chip
            label={getStatusText(certificate.validFrom, certificate.validTo)}
            color={getStatusColor(certificate.validFrom, certificate.validTo)}
            size="small"
          />
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          {/* Basic Information */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Basic Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Alias</Typography>
                <Typography variant="body1">{certificate.alias}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Type</Typography>
                <Typography variant="body1">{certificate.type}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Store</Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {certificate.store}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Has Private Key</Typography>
                <Typography variant="body1">
                  {certificate.hasPrivateKey ? 'Yes' : 'No'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Subject Information */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Subject</Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {parsedCertificate?.subjectStr || 'Unknown'}
            </Typography>
          </Paper>

          {/* Subject Alternative Names */}
          {parsedCertificate?.subjectAltNames && 
           (parsedCertificate.subjectAltNames.dns?.length > 0 ||
            parsedCertificate.subjectAltNames.ip?.length > 0 ||
            parsedCertificate.subjectAltNames.uri?.length > 0 ||
            parsedCertificate.subjectAltNames.email?.length > 0 ||
            parsedCertificate.subjectAltNames.dn?.length > 0) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Subject Alternative Names</Typography>
                {showSanExpandButton && (
                  <Button
                    size="small"
                    onClick={() => setSanExpanded(!sanExpanded)}
                    endIcon={sanExpanded ? <ExpandLess /> : <ExpandMore />}
                    sx={{ minWidth: 'auto', textTransform: 'none' }}
                  >
                    {sanExpanded ? 'Show Less' : 'Show More'}
                  </Button>
                )}
              </Box>
              <Box
                sx={{
                  maxHeight: sanExpanded ? 'none' : '200px',
                  overflow: sanExpanded ? 'visible' : 'hidden',
                  transition: 'max-height 0.3s ease-in-out'
                }}
              >
                <Stack spacing={2}>
                {parsedCertificate.subjectAltNames.dns?.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      DNS Names:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      {parsedCertificate.subjectAltNames.dns.map((dns, index) => (
                        <Chip key={index} label={dns} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
                {parsedCertificate.subjectAltNames.ip?.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      IP Addresses:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      {parsedCertificate.subjectAltNames.ip.map((ip, index) => (
                        <Chip key={index} label={ip} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
                {parsedCertificate.subjectAltNames.uri?.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      URIs:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      {parsedCertificate.subjectAltNames.uri.map((uri, index) => (
                        <Chip key={index} label={uri} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
                {parsedCertificate.subjectAltNames.email?.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Email Addresses:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      {parsedCertificate.subjectAltNames.email.map((email, index) => (
                        <Chip key={index} label={email} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
                {parsedCertificate.subjectAltNames.dn?.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Distinguished Names:
                    </Typography>
                    <Stack spacing={1}>
                      {parsedCertificate.subjectAltNames.dn.map((dn, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: 'grey.50',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {dn}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
                </Stack>
              </Box>
            </Paper>
          )}

          {/* Issuer Information */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Issuer</Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {parsedCertificate?.issuerStr || 'Unknown'}
            </Typography>
          </Paper>

          {/* Validity Period */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Validity Period</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Valid From</Typography>
                <Typography variant="body1">{certificate.validFrom}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Valid To</Typography>
                <Typography variant="body1">{certificate.validTo}</Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Fingerprint */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Fingerprint</Typography>
            <Typography variant="body2" color="text.secondary">SHA-1</Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {certificate.fingerprintSha1}
            </Typography>
          </Paper>

          {/* Extensions */}
          {parsedCertificate?.extensions && parsedCertificate.extensions.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Extensions</Typography>
              <Stack spacing={1}>
                {formatExtensions(parsedCertificate.extensions).map((ext, index) => (
                  <Box key={index}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {ext.name}
                      </Typography>
                      {ext.critical && (
                        <Chip label="Critical" size="small" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {ext.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Channels in Use */}
          {channelsInUse && channelsInUse.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Channels in Use ({channelsInUse.length})</Typography>
                {showChannelsExpandButton && (
                  <Button
                    size="small"
                    onClick={() => setChannelsExpanded(!channelsExpanded)}
                    endIcon={channelsExpanded ? <ExpandLess /> : <ExpandMore />}
                    sx={{ minWidth: 'auto', textTransform: 'none' }}
                  >
                    {channelsExpanded ? 'Show Less' : 'Show All'}
                  </Button>
                )}
              </Box>
              <Box
                sx={{
                  maxHeight: channelsExpanded ? 'none' : '100px',
                  overflow: channelsExpanded ? 'visible' : 'hidden',
                  transition: 'max-height 0.3s ease-in-out'
                }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  {channelsInUse.map((channel, index) => (
                    <Chip key={index} label={channel} size="small" />
                  ))}
                </Stack>
              </Box>
            </Paper>
          )}

          {/* Raw Certificate (Collapsible) */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Raw Certificate (Base64)</Typography>
            <Box
              sx={{
                backgroundColor: 'grey.100',
                p: 1,
                borderRadius: 1,
                maxHeight: 200,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                wordBreak: 'break-all',
              }}
            >
              {rawCertificate}
            </Box>
          </Paper>

          {/* Private Key (if available) */}
          {certificate.hasPrivateKey && certificate.rawPrivateKey && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="h6">Private Key (Base64)</Typography>
                <IconButton
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  size="small"
                  color="primary"
                  title={showPrivateKey ? 'Hide private key' : 'Show private key'}
                >
                  {showPrivateKey ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </Stack>
              {showPrivateKey && (
                <Box
                  sx={{
                    backgroundColor: 'grey.100',
                    p: 1,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    mt: 1,
                  }}
                >
                  {certificate.rawPrivateKey}
                </Box>
              )}
            </Paper>
          )}

          {/* Certificate Verification */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography variant="h6">Certificate Verification</Typography>
              <Button
                variant="contained"
                onClick={handleVerifyCertificate}
                disabled={isVerifying}
                startIcon={isVerifying ? <CircularProgress size={16} /> : <CheckCircle />}
              >
                {isVerifying ? 'Verifying...' : 'Verify Certificate'}
              </Button>
            </Stack>

            {verificationResult && (
              <Box sx={{ mt: 2 }}>
                {verificationResult.success ? (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Certificate verification completed successfully!
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {verificationResult.error}
                  </Alert>
                )}

                {verificationResult.success && (
                  <Stack spacing={2}>
                    {/* Chain Validation Results */}
                    {verificationResult.chainValidation && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {verificationResult.chainValidation.isValid ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Error color="error" />
                            )}
                            <Typography variant="h6">
                              Chain Validation {verificationResult.chainValidation.isValid ? 'Passed' : 'Failed'}
                            </Typography>
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                          {verificationResult.chainValidation.errors.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="error" gutterBottom>
                                Errors:
                              </Typography>
                              <List dense>
                                {verificationResult.chainValidation.errors.map((error, index) => (
                                  <ListItem key={index}>
                                    <ListItemText primary={error} />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}
                          {verificationResult.chainValidation.warnings.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                Warnings:
                              </Typography>
                              <List dense>
                                {verificationResult.chainValidation.warnings.map((warning, index) => (
                                  <ListItem key={index}>
                                    <ListItemText primary={warning} />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}
                          {verificationResult.chainValidation.details.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" gutterBottom>
                                Details:
                              </Typography>
                              <List dense>
                                {verificationResult.chainValidation.details.map((detail, index) => (
                                  <ListItem key={index}>
                                    <ListItemText primary={detail} />
                                  </ListItem>
                                ))}
                              </List>
                            </Box>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Private Key Validation */}
                    {verificationResult.keyValidation && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {verificationResult.keyValidation.isValid ? (
                              <CheckCircle color="success" />
                            ) : (
                              <Error color="error" />
                            )}
                            <Typography variant="h6">
                              Private Key Validation {verificationResult.keyValidation.isValid ? 'Passed' : 'Failed'}
                            </Typography>
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Alert 
                            severity={verificationResult.keyValidation.isValid ? 'success' : 'error'}
                          >
                            {verificationResult.keyValidation.message}
                          </Alert>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Certificate Chain Details */}
                    {verificationResult.chainDetails && verificationResult.chainDetails.length > 1 && (
                      <Accordion>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography variant="h6">
                            Certificate Chain ({verificationResult.chainDetails.length} certificates)
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <List>
                            {verificationResult.chainDetails.map((cert, index) => (
                              <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  {cert.type} (Certificate #{cert.index})
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Subject: {cert.subject}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Issuer: {cert.issuer}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Valid: {cert.validFrom} - {cert.validTo}
                                </Typography>
                              </ListItem>
                            ))}
                          </List>
                        </AccordionDetails>
                      </Accordion>
                    )}
                  </Stack>
                )}
              </Box>
            )}
          </Paper>
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
