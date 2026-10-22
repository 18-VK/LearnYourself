import type { VerbatimCheck } from '../engine/loader';
import * as S from './sources';

const fix = (what: string) => `src/viz/aspnet/sources.ts (${what}) and the visualizer that uses it`;
const check = (label: string, file: string, heading: string, code: string, name: string): VerbatimCheck => ({ label, file, heading, code, fix: fix(name) });

/** Code panels in this area that copy code from a note; the build checks each one still matches. */
export const VERBATIM: VerbatimCheck[] = [
  check('middleware in-and-out visualizer', S.NOTES.middleware, 'How middleware works internally', S.MIDDLEWARE_FLOW_TEXT, 'MIDDLEWARE_FLOW_TEXT'),
  check('middleware production-order visualizer', S.NOTES.middleware, 'Final Production Order (VERY IMPORTANT)', S.PRODUCTION_ORDER_CODE, 'PRODUCTION_ORDER_CODE'),
  check('middleware production-order visualizer (CORS policy)', S.NOTES.middleware, 'UseCors()', S.CORS_POLICY_CODE, 'CORS_POLICY_CODE'),
  check('middleware production-order visualizer (rate limiter)', S.NOTES.middleware, 'UseRateLimiter()', S.MIDDLEWARE_RATE_LIMIT_CODE, 'MIDDLEWARE_RATE_LIMIT_CODE'),
  check('rate limiter visualizer', S.NOTES.rateLimiting, '2. All Four Limiter Types', S.ALL_FOUR_LIMITERS_CODE, 'ALL_FOUR_LIMITERS_CODE'),
  check('rate limiter visualizer (rejection)', S.NOTES.rateLimiting, '1. Basic Setup', S.REJECTION_CODE, 'REJECTION_CODE'),
  check('JWT decoder visualizer (header)', S.NOTES.auth, '1. Header', S.JWT_HEADER_JSON, 'JWT_HEADER_JSON'),
  check('JWT decoder visualizer (signature)', S.NOTES.auth, '3. Signature', S.JWT_SIGNATURE_TEXT, 'JWT_SIGNATURE_TEXT'),
  check("JWT decoder visualizer (the note's token)", S.NOTES.auth, '4. Final JWT token', S.JWT_NOTE_TOKEN, 'JWT_NOTE_TOKEN'),
  check('JWT sequence visualizer', S.NOTES.auth, 'Configuration (App Setup)', S.JWT_VALIDATION_CODE, 'JWT_VALIDATION_CODE'),
  check('RS256 visualizer (signing)', S.NOTES.auth, 'How Validation Happens (RUNTIME FLOW)', S.RSA_SIGN_TEXT, 'RSA_SIGN_TEXT'),
  check('RS256 visualizer (verifying)', S.NOTES.auth, 'How Validation Happens (RUNTIME FLOW)', S.RSA_VERIFY_TEXT, 'RSA_VERIFY_TEXT'),
  check('RS256 visualizer (.NET signing key)', S.NOTES.moreAuth, 'How to Use These Keys in .NET', S.RSA_SIGNING_CREDENTIALS_CODE, 'RSA_SIGNING_CREDENTIALS_CODE'),
];
