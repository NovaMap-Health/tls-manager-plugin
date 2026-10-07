import React from 'react'
import { Paper, Box, Typography, Stack, Button, Divider, Tooltip } from '@mui/material'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import StatusPill from './StatusPill'

export default function CertificateCard({ certificate, onViewDetails, onEditAlias, onRemove, showPrivateKeys = false }) {
  const {
    alias,
    type,
    subject,
    issuer,
    validFrom,
    validTo,
    fingerprintSha1,
    hasPrivateKey,
    rawPrivateKey,
    channelsInUse,
  } = certificate

  return (
    <Paper variant="outlined" sx={{
      p: 2,
      borderRadius: 2,
      height: '100%',
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Main Content Area - grows to fill available space */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, backgroundColor: 'action.selected', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldOutlinedIcon fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <Tooltip title={alias} arrow placement="top">
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600, 
                      lineHeight: 1,
                      wordBreak: 'break-all',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      cursor: 'help'
                    }}
                  >
                    {alias}
                  </Typography>
                </Tooltip>
                <Typography variant="body2" color="text.secondary">{type}</Typography>
              </Box>
            </Stack>
            <Box sx={{ flexShrink: 0 }}>
              <StatusPill validFrom={validFrom} validTo={validTo} />
            </Box>
          </Stack>

        <Box sx={{ flex: '0 0 auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Subject:</Typography>
          <Typography
            variant="body2"
            color="text.primary"
            sx={{
              wordBreak: 'break-all',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {subject}
          </Typography>
        </Box>

        <Box sx={{ flex: '0 0 auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Issuer:</Typography>
          <Typography
            variant="body2"
            color="text.primary"
            sx={{
              wordBreak: 'break-all',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {issuer}
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ flex: '0 0 auto' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Valid From:</Typography>
            <Typography variant="body2">{validFrom}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Valid To:</Typography>
            <Typography variant="body2">{validTo}</Typography>
          </Box>
        </Stack>

        <Box sx={{ flex: '0 0 auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Fingerprint (SHA-1):</Typography>
          <Typography
            variant="body2"
            sx={{
              wordBreak: 'break-all',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {fingerprintSha1}
          </Typography>
        </Box>

        {/* Channels in Use Section */}
        {channelsInUse && channelsInUse.length > 0 && (
          <Box sx={{ flex: '0 0 auto' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Channels in Use: <b>{channelsInUse.length}</b> </Typography>
          </Box>
        )}

        {/* Private Key Section */}
        {showPrivateKeys && hasPrivateKey && rawPrivateKey && (
          <>
            <Divider />
            <Box sx={{ flex: '0 0 auto', width: '100%', overflow: 'hidden' }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Private Key (Base64):</Typography>
              <Box
                sx={{
                  backgroundColor: 'grey.100',
                  p: 1,
                  borderRadius: 1,
                  height: 120,
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  border: '1px solid',
                  borderColor: 'grey.300',
                  boxSizing: 'border-box',
                }}
              >
                {rawPrivateKey}
              </Box>
            </Box>
          </>
        )}

        </Stack>
      </Box>

      {/* Button Area - fixed at bottom */}
      <Box sx={{ flex: '0 0 auto', mt: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
          <Button
            variant="outlined"
            color="success"
            size="small"
            startIcon={<ShieldOutlinedIcon fontSize="small" />}
            onClick={() => onViewDetails?.(certificate)}
            fullWidth
            sx={{
              fontSize: '0.75rem',
              py: 0.5,
              textTransform: 'none',
              fontWeight: 500,
            }}
          >
            View Details
          </Button>
          {/* <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<ImportExportOutlinedIcon fontSize="small" />}
            onClick={() => onExport?.(certificate)}
            fullWidth
            sx={{
              fontSize: '0.75rem',
              py: 0.5,
              textTransform: 'none',
              fontWeight: 500,
            }}
          >
            Export
          </Button> */}
          {/* Edit Alias button - only show for trusted and private stores */}
          {(certificate.store === 'trusted' || certificate.store === 'private') && (
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={() => onEditAlias?.(certificate)}
              fullWidth
              sx={{
                fontSize: '0.75rem',
                py: 0.5,
                textTransform: 'none',
                fontWeight: 500,
              }}
            >
              Edit Alias
            </Button>
          )}
          {/* Remove button - only show for trusted and private stores */}
          {(certificate.store === 'trusted' || certificate.store === 'private') && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteOutlinedIcon fontSize="small" />}
              onClick={() => onRemove?.(certificate)}
              fullWidth
              sx={{
                fontSize: '0.75rem',
                py: 0.5,
                textTransform: 'none',
                fontWeight: 500,
              }}
            >
              Remove
            </Button>
          )}
        </Stack>
      </Box>
    </Paper>
  )
}


