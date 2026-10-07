# Settings Dashboard - Technical Specifications

## Project Overview

A React-based certificate management dashboard built with Vite, Material-UI, and Tailwind CSS v4. The application provides comprehensive SSL/TLS certificate management with import, verification, and display capabilities.

## Technology Stack

- **Frontend**: React 18+ with functional components and hooks
- **Build Tool**: Vite with base path `/dashboard/`
- **UI Framework**: Material-UI (MUI) for components
- **Styling**: Tailwind CSS v4 for utilities
- **Routing**: React Router DOM v6
- **Date Handling**: dayjs for robust date operations
- **Cryptography**: jsrsasign for certificate parsing and validation (supports RSA, ECDSA, DSA, Ed25519)
- **State Management**: React Context and custom hooks

## Architecture

### Core Components

**Layout Components:**
- `DashboardLayout.jsx` - Main layout with top bar (no sidebar)
- `ProtectedRoute.jsx` - Route protection for authenticated users
- `AuthContext.jsx` - Authentication state management

**Certificate Management:**
- `TlsManagement.jsx` - Main certificate management page with tabbed interface
- `CertificateList.jsx` - Responsive grid layout for certificate display
- `CertificateCard.jsx` - Individual certificate card component
- `StatusPill.jsx` - Certificate validity status indicator

**Import System:**
- `ImportCertificateDialogContent.jsx` - Main import dialog orchestrator
- `UserInputsSection.jsx` - Form inputs and file uploads
- `CertificateDetailsSection.jsx` - Live certificate details display
- `CertificateVerificationSection.jsx` - Certificate verification results
- `MobileCertificateSection.jsx` - Mobile-responsive certificate display

**Details & Verification:**
- `CertificateDetailsDialog.jsx` - Comprehensive certificate information viewer
- `useCertificateImport.js` - Custom hook for import logic and state management

### Data Flow

**Certificate Storage:**
- Internal memory store with localStorage persistence
- Three certificate stores: `native`, `trusted`, `private`
- Base64-encoded PEM format for certificates and private keys

**API Integration:**
- GET `/tlsmanager/certificates` - Fetch all certificates
- PUT `/tlsmanager/certificates` - Update certificate stores
- Simulated API delays (300ms) for realistic behavior

## Key Features

### Certificate Import System

**Multi-Format Support:**
- PEM certificate import (paste or file upload)
- Private key import for private store
- Automatic certificate parsing and validation
- Real-time certificate details display

**Import Workflow:**
1. User selects target store (trusted/private)
2. Provides certificate (paste/upload) and optional private key
3. Live certificate details appear immediately
4. Auto-verification runs automatically
5. Alias conflict detection with warnings
6. Final verification before import
7. Confirmation dialog for existing aliases

**Validation Features:**
- Certificate chain validation
- Private key matching verification
- Certificate status checking (valid/expired/expiring)
- Fingerprint generation (SHA-1/SHA-256)
- Subject Alternative Names extraction

### User Interface

**Responsive Design:**
- Two-column layout for import dialog (desktop)
- Mobile-responsive stacked layout
- Responsive certificate grid (1-4 columns based on screen size)
- Consistent Material-UI theming

**Certificate Display:**
- Card-based layout with status indicators
- Real-time validity status with dayjs
- Comprehensive certificate information
- Export and view details functionality

**Status Management:**
- Color-coded status pills (Valid/Expiring/Expired)
- Automatic status calculation with configurable thresholds
- Date validation and error handling
- Timezone-aware date operations

### Security & Validation

**Certificate Verification:**
- Chain validation with signature verification
- Private key matching for certificate pairs
- Comprehensive error reporting
- Security-focused validation logic

**Data Integrity:**
- Base64 encoding for secure storage
- PEM format validation
- Certificate fingerprint verification
- Private key format validation

## Technical Implementation

### Custom Hooks

**`useCertificateImport`:**
- Centralized import logic and state management
- Auto-completion for certificate aliases
- Real-time conflict detection
- Verification orchestration

**`useCertificates`:**
- Certificate data fetching and filtering
- Store-specific data management
- Search and filtering capabilities

### Utility Functions

**Certificate Processing:**
- `certificateUtils.js` - PEM conversion and parsing
- `verificationUtils.js` - Comprehensive certificate verification
- `dateUtils.js` - Date formatting and manipulation

**Service Layer:**
- `tlsService.js` - API integration and data persistence
- `authService.js` - Authentication management
- `api.js` - HTTP client configuration

### State Management

**Authentication:**
- Context-based authentication state
- Protected route implementation
- Login/logout functionality

**Certificate Management:**
- Local state for UI interactions
- Persistent storage with localStorage
- Real-time updates and synchronization

## Development Guidelines

### Code Organization

**Component Structure:**
- Single responsibility principle
- Reusable component design
- Custom hooks for business logic
- Clear prop interfaces

**Styling Approach:**
- Material-UI components with sx props
- Tailwind utilities for layout and spacing
- Consistent color scheme and theming
- Responsive design patterns

### Best Practices

**React Patterns:**
- Functional components with hooks
- Custom hooks for logic reuse
- Proper state management
- Performance optimization

**Code Quality:**
- ESLint configuration
- TypeScript-ready structure
- Comprehensive error handling
- User-friendly error messages

## Deployment Configuration

**Build Settings:**
- Vite base path: `/dashboard/`
- Asset optimization
- Production-ready build
- Environment variable support

**Browser Support:**
- Modern browser compatibility
- ES6+ feature support
- Responsive design
- Accessibility considerations

## Future Enhancements

**Planned Features:**
- Real API integration (currently using internal store)
- Advanced certificate filtering
- Bulk operations
- Certificate renewal notifications
- Advanced security features

**Technical Improvements:**
- Performance optimization
- Enhanced error handling
- Advanced validation rules
- Improved mobile experience

---

*This specification document provides a comprehensive overview of the Settings Dashboard project, covering architecture, features, implementation details, and development guidelines.*

---

## 2026-05-12 - Replace jsrsasign with pkijs

**Decision:** Replaced the now-EOL `jsrsasign` library with `pkijs` + `asn1js` + the browser's Web Crypto API (`crypto.subtle`).

**Why:**
- `jsrsasign` reached end-of-support on 2026-Apr-10 with unfixed open vulnerabilities; staying on it is no longer viable.
- `pkijs` (by PeculiarVentures) covers everything we use today (X.509 parsing, chain verification, private-key matching) AND the upcoming **OCSP / CRL** feature work, so we avoid bringing in a second PKI dependency later.
- Web Crypto handles all hashing and signing/verification natively, with no JS-implemented crypto primitives.

**Affected files:**
- New: `web-ui/src/utils/pkiHelpers.js` - PEM<->DER, OID-to-name maps, KeyUsage bit decoding, SAN flattening, RSA modulus bit-length, EC curve detection, private key import for PKCS#8 / PKCS#1 / SEC1.
- Rewritten: `web-ui/src/utils/certificateUtils.js`, `web-ui/src/utils/verificationUtils.js`.
- Patched: `web-ui/src/components/CertificateDetailsDialog.jsx`, `web-ui/src/components/ImportCertificateChainDialogContent.jsx`, `web-ui/src/hooks/useCertificateImport.js` - now `await` the previously-sync `verifyCertificate`, `parseCertificate`, `parseCertificateChainFromPem`.
- `web-ui/package.json` - removed `jsrsasign`, added `pkijs`, `asn1js`, `pvutils`.

**Behavioral changes:**
- `parseCertificate`, `parseCertificateChainFromPem`, `verifyCertificate`, `validateCertificateChain`, `validatePrivateKey`, `getFingerprint` are now `async`. `isValidPemCertificate` and `isValidPemPrivateKey` remain sync (structural validation only).
- **DSA private keys are no longer supported.** Web Crypto cannot import or sign with DSA. The PEM header is rejected by `isValidPemPrivateKey`, and any path that reaches `importPrivateKeyFromPem` throws a clear `"DSA private keys are not supported in this environment"` error. DSA was never a product requirement (no fixtures, tests, or product flows used it), only a side-effect of `jsrsasign`'s capabilities.
- Supported private key formats: PKCS#8 (`-----BEGIN PRIVATE KEY-----`), PKCS#1 RSA (`-----BEGIN RSA PRIVATE KEY-----`), SEC1 EC (`-----BEGIN EC PRIVATE KEY-----`, with or without a preceding `EC PARAMETERS` block as emitted by OpenSSL).
- Supported public key algorithms in certificates: RSA (`RSASSA-PKCS1-v1_5` with SHA-256) and ECDSA on P-256 / P-384 / P-521.

**Future work covered by the same dependency:**
- OCSP responder check via `pkijs.OCSPRequest` / `OCSPResponse`, AIA URL discovery from extension OID `1.3.6.1.5.5.7.1.1`.
- CRL distribution-point check via `pkijs.CertificateRevocationList`, URLs from extension OID `2.5.29.31`.
- Both will live in a new `web-ui/src/utils/revocationUtils.js` and reuse the `pkijs.Certificate` instances already produced by `parseCertificateChain`.

**Cryptography (replaces the original entry on line 15):**
- `pkijs` + `asn1js` for X.509 / PKI structure handling
- `crypto.subtle` (Web Crypto) for all hashing, signing, verification, and key import
- Supports RSA and ECDSA. DSA and Ed25519 are not supported in this environment.
