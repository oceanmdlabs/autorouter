# Dependency security review — 2026-10-09

## Remediation

- Pin AI SDK `6.0.302`, Bedrock adapter `4.0.193`, Cohere adapter `3.0.68`,
  Google adapter `3.0.131`, and OpenAI adapter `3.0.124`. They resolve to patched
  provider utilities `4.0.57` and remove the old AI SDK 4 client-side helpers.
  These updates address [GHSA-866g-f22w-33x8](https://github.com/advisories/GHSA-866g-f22w-33x8)
  and [GHSA-rwvc-j5jr-mgvh](https://github.com/advisories/GHSA-rwvc-j5jr-mgvh).
- Update development-only Nuxt DevTools to `4.0.0-beta.4`, including the copy
  requested by Nuxt. This release removes `simple-git`, eliminating its
  critical command-execution advisories. The stable DevTools 3 release is
  incompatible with the patched simple-git 4 API. Development startup and the
  login page pass a smoke test; the beta DevTools authorization handshake
  was not validated (the dock reported Unauthorized and an RPC trust timeout).
  DevTools is excluded from the Lambda bundle.
- Declare `h3` `1.15.11` directly, matching Nuxt's production Nitro runtime.
  Development tooling uses H3 2 internally; explicitly declaring the app's
  existing H3 version prevents that development dependency from changing the
  server API imports or event types.
- Update CDK to `2.273.0`, whose published package includes patched
  `brace-expansion` `5.0.12`. Both the installed dependency and a clean install
  must pass the infrastructure audit; checking only a top-level dependency
  would miss this bundled library.

## Compatibility and privacy

The SDK migration preserves the current OpenAI Chat Completions API, model
selection, tool scheduling, collected inputs from all steps, and the ten-step
limit. File parts use the SDK's current `mediaType` field. Synthetic tests
exercise real Bedrock request serialization, Canadian endpoint pinning,
SigV4 role authentication, pinned guardrails, schema validation, and the
existing fail-closed PHI approval gate. No live model calls are made.

The Bedrock adapter stays on the tested SDK 6-compatible release because it
retains the guardrail option. Any future adapter update must pass these tests.
The deployment's PHI-processing flag remains unset; this work does not grant
PHI approval. See the dated engineering evidence in the
[Bedrock provider review](../privacy/providers/aws-bedrock-phipa-review.md).

## Remaining upstream findings

The root development/build dependency tree still includes two vulnerable
packages without a published patched release as of this review:

- `braces` `3.0.3`: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
  stack exhaustion from deeply nested glob patterns.
- `node-forge` `1.4.0`: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
  RSA signature-verification weakness. Nuxt's development-server tooling
  brings this library in through `listhen`.

Audit entries on their parent packages are propagated findings, not distinct
additional flaws. Neither package is present in the traced Lambda bundle.
The production package inventory is checked against the npm advisory bulk
endpoint, independently of the root audit. A clean production result does
not clear the development/build dependency findings or constitute an audit
of application logic, AWS configuration, historical Lambda versions, or
unattached deployment assets. Recheck when an upstream fix is published.

## Validation

- Clean root install, all 119 tests across 25 files, Nuxt type checking, and
  the AWS Lambda build pass.
- The final traced Lambda bundle contains 154 named packages and returns no
  findings from the npm advisory bulk endpoint. Axios is `1.20.0`.
- A clean CDK install, TypeScript build, and npm audit pass with zero findings.
- The root audit retains 14 high entries propagated from the two unpatched
  packages above; it reports no critical findings.
