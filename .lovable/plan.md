

## Problem: SNS Signature Verification Fails

The `sns-webhook` logs show the exact error:

```
ASN.1 error: unexpected ASN.1 DER tag: expected OBJECT IDENTIFIER, got CONTEXT-SPECIFIC [0] (constructed)
```

The code tries to import a full **X.509 certificate** as an **SPKI key** — these are different formats. The PEM from AWS is a certificate (`-----BEGIN CERTIFICATE-----`), not a bare public key (`-----BEGIN PUBLIC KEY-----`). Deno's `crypto.subtle.importKey('spki', ...)` only accepts SPKI-encoded public keys, not full X.509 certificates.

The test notification works because it calls `dispatchNotification` directly (bypasses SNS entirely). Real alerts go through CloudWatch → SNS → `sns-webhook`, which hits this broken signature check and returns 403.

## Fix: Extract SPKI Public Key from X.509 Certificate

The X.509 DER certificate contains the SubjectPublicKeyInfo (SPKI) at a known ASN.1 offset. We need to parse the certificate to extract just the public key portion before importing it.

**In `supabase/functions/sns-webhook/index.ts`**, replace the `verifySnsSignature` function's key import logic:

1. Parse the PEM certificate body to DER bytes (existing code, works fine)
2. Instead of passing the full certificate DER to `importKey('spki', ...)`, walk the ASN.1 structure to find the SubjectPublicKeyInfo sequence (the 7th element of the TBSCertificate SEQUENCE)
3. Import only that extracted SPKI portion

The ASN.1 extraction approach:
- A SEQUENCE tag (0x30) wraps the certificate
- Inside is TBSCertificate (another SEQUENCE)
- TBSCertificate fields: version, serialNumber, signature, issuer, validity, subject, **subjectPublicKeyInfo** (index 6)
- Extract that subfield's raw bytes and pass to `importKey('spki', ...)`

This is a well-known pattern for Deno/Web Crypto which lacks native X.509 parsing.

## Changes

**`supabase/functions/sns-webhook/index.ts`**:
- Add an `extractSPKIFromCert(certDer)` helper that parses ASN.1 to find SubjectPublicKeyInfo
- Update `verifySnsSignature` to call this helper before `importKey`
- Redeploy the function

No other files need changes. The rest of the pipeline (subscription confirmation handler, dispatch logic) is correct.

## Technical Detail: ASN.1 Parser

```text
X.509 Certificate structure:
  SEQUENCE {
    TBSCertificate SEQUENCE {
      [0] version (CONTEXT-SPECIFIC, optional)
      INTEGER serialNumber
      SEQUENCE signatureAlgorithm
      SEQUENCE issuer
      SEQUENCE validity
      SEQUENCE subject
      SEQUENCE subjectPublicKeyInfo  ← extract this
      ...
    }
    SEQUENCE signatureAlgorithm
    BIT STRING signature
  }
```

We parse just enough ASN.1 to skip to field index 6 (accounting for the optional version tag [0]), extract those bytes, and pass them to `crypto.subtle.importKey('spki', ...)`.

