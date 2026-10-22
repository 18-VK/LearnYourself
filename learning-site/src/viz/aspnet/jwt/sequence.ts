import { lineOf } from '../../engine/code';
import type { Step, Trace } from '../../engine/types';
import { ZERO } from '../common/zero';
import { JWT_VALIDATION_CODE } from '../sources';

/**
 * The JWT authentication flow from 10.ASP_AuthenticationNAuthorisation.md › "JWT authentication flow":
 * 1. acquiring the token, 2. using it, 3. API validation (signature, then iss / aud / exp, then the user, then
 * authorization), with the failure branches the note lists (401 when authentication fails, 403 when the user
 * lacks the role). Settings are the note's appsettings.json and TokenValidationParameters.
 */

export type Lane = 'client' | 'auth' | 'api' | 'ctrl';
export const LANES: { id: Lane; label: string }[] = [
  { id: 'client', label: 'Client' },
  { id: 'auth', label: 'Authorization Server' },
  { id: 'api', label: '.NET API (middleware)' },
  { id: 'ctrl', label: 'Controller' },
];

export type Phase = 'login' | 'token' | 'api-call' | 'validation';
export const PHASES: Phase[] = ['login', 'token', 'api-call', 'validation'];
export const PHASE_LABEL: Record<Phase, string> = {
  login: '1. Acquiring the token',
  token: '1. Acquiring the token',
  'api-call': '2. Using the token',
  validation: '3. API validation',
};

export type SeqScenario = 'ok' | 'expired' | 'bad-signature' | 'wrong-audience' | 'no-token' | 'missing-role';
export const SEQ_SCENARIOS: { id: SeqScenario; label: string }[] = [
  { id: 'ok', label: 'Valid token' },
  { id: 'expired', label: 'Expired token' },
  { id: 'bad-signature', label: 'Tampered token (bad signature)' },
  { id: 'wrong-audience', label: 'Token for another API' },
  { id: 'no-token', label: 'No token' },
  { id: 'missing-role', label: 'Valid token, wrong role' },
];

/** The note's appsettings.json values. */
export const CONFIG = { issuer: 'https://your-auth-server', audience: 'your-api', clockSkewMinutes: 1 } as const;

export interface SeqEvent {
  kind: 'msg' | 'self';
  from: Lane;
  to: Lane;
  label: string;
  phase: Phase;
  /** pass / fail marker for checks */
  result?: 'pass' | 'fail';
  status?: number;
}

export interface SeqState {
  events: SeqEvent[];
  /** index of the current event */
  current: number;
  token: { iss: string; aud: string; role: string; exp: string; signature: 'valid' | 'tampered' } | null;
  user: string;
  checks: { name: string; result: 'pending' | 'pass' | 'fail' | 'skipped' }[];
  outcome: { status: number; text: string } | null;
  codeLines: number[];
}

export type SeqStep = Step<SeqState>;

const C = (m: string) => lineOf(JWT_VALIDATION_CODE, m);
export const SEQ_LINES = {
  handler: [C('.AddJwtBearer(options =>')],
  signature: [C('ValidateIssuerSigningKey = true'), C('IssuerSigningKey = new SymmetricSecurityKey(')],
  issuer: [C('ValidateIssuer = true'), C('ValidIssuer = builder.Configuration')],
  audience: [C('ValidateAudience = true'), C('ValidAudience = builder.Configuration')],
  lifetime: [C('ValidateLifetime = true'), C('ClockSkew = TimeSpan.FromMinutes(1)')],
};

const CHECKS = ['Signature', 'Issuer (iss)', 'Audience (aud)', 'Expiry (exp)', '[Authorize(Roles = "Admin")]'];

export function traceJwtSequence(scenario: SeqScenario, phases: readonly Phase[] = PHASES): Trace<SeqState> {
  const include = new Set(phases.length ? phases : PHASES);
  const token: SeqState['token'] =
    scenario === 'no-token'
      ? null
      : {
          iss: CONFIG.issuer,
          aud: scenario === 'wrong-audience' ? 'another-api' : CONFIG.audience,
          role: scenario === 'missing-role' ? 'User' : 'Admin',
          exp: scenario === 'expired' ? '5 min ago' : 'in 15 min',
          signature: scenario === 'bad-signature' ? 'tampered' : 'valid',
        };
  const events: SeqEvent[] = [];
  const steps: SeqStep[] = [];
  const checks: SeqState['checks'] = CHECKS.map((name) => ({ name, result: 'pending' }));
  let user = 'anonymous';
  let outcome: SeqState['outcome'] = null;
  const add = (e: SeqEvent, narration: string, codeLines: number[] = [], extra: { predict?: SeqStep['predict']; action?: SeqStep['action'] } = {}) => {
    if (!include.has(e.phase)) return;
    events.push(e);
    steps.push({
      state: { events: [...events], current: events.length - 1, token, user, checks: checks.map((c) => ({ ...c })), outcome, codeLines },
      highlights: {},
      action: extra.action ?? (e.kind === 'msg' ? 'call' : 'compare'),
      codeLine: 0,
      narration,
      variables: { user, ...(token ? { 'token role': token.role, 'token aud': token.aud } : { token: 'none' }) },
      counters: ZERO,
      predict: extra.predict,
    });
  };
  const yesNo = (q: string, pass: boolean) => ({ question: q, options: ['Passes', 'Fails: 401 Unauthorized'], answer: pass ? 0 : 1 });
  const fail = (status: 401 | 403, why: string) => {
    outcome = { status, text: status === 401 ? 'Unauthorized' : 'Forbidden' };
    for (const c of checks) if (c.result === 'pending') c.result = 'skipped';
    add(
      { kind: 'msg', from: 'api', to: 'client', label: `${status} ${outcome.text}`, phase: 'validation', status },
      `${why} The request never reaches the controller. ${status === 401 ? '401 Unauthorized: authentication failed or no valid token was provided.' : '403 Forbidden: authentication succeeded, but the user lacks the required permissions.'}`,
      [],
      { action: 'done' },
    );
    return steps;
  };

  if (token) {
    add({ kind: 'msg', from: 'client', to: 'auth', label: 'POST token endpoint (credentials)', phase: 'login' }, 'The client proves its identity: a POST request to the Authorization Server\'s token endpoint with the user\'s credentials (or a client secret/code).', [], {
      action: 'start',
    });
    add({ kind: 'self', from: 'auth', to: 'auth', label: 'Verify credentials against the user store', phase: 'login' }, 'The Authorization Server verifies the credentials against its user store.');
    add(
      { kind: 'msg', from: 'auth', to: 'client', label: 'Signed JWT (sub, role, exp, …)', phase: 'token' },
      `The credentials are valid, so the server returns a signed JWT. Its claims include sub, role (${token.role}) and exp for expiration.${scenario === 'bad-signature' ? " (Later, someone edits this token's payload before it is sent.)" : scenario === 'wrong-audience' ? ` (This token was issued for "${token.aud}".)` : ''}`,
    );
    add({ kind: 'self', from: 'client', to: 'client', label: 'Store the token', phase: 'token' }, 'The client stores the token, typically in memory or in a secure browser cookie.');
  }
  add(
    { kind: 'msg', from: 'client', to: 'api', label: token ? 'GET /api/… + Authorization: Bearer <JWT>' : 'GET /api/… (no Authorization header)', phase: 'api-call' },
    token
      ? `For every API call the client adds the token to the HTTP header: Authorization: Bearer <your-jwt-here>.${scenario === 'expired' ? ' This call happens after the token has expired.' : ''}`
      : 'The client calls the API without logging in first, so there is no Authorization header.',
    [],
    { action: token ? 'call' : 'start' },
  );
  add(
    { kind: 'self', from: 'api', to: 'api', label: token ? 'JwtBearer: take the token after "Bearer "' : 'JwtBearer: no token found', phase: 'validation' },
    token
      ? 'The JwtBearer authentication middleware processes the token before it ever reaches your controller. It extracts the token by removing the "Bearer" prefix.'
      : 'The JwtBearer middleware finds no token. It doesn\'t reject the request itself; HttpContext.User stays anonymous.',
    SEQ_LINES.handler,
  );

  if (token) {
    const sigOk = token.signature === 'valid';
    checks[0]!.result = sigOk ? 'pass' : 'fail';
    add(
      { kind: 'self', from: 'api', to: 'api', label: 'Check signature', phase: 'validation', result: sigOk ? 'pass' : 'fail' },
      sigOk
        ? 'Signature validation: the handler re-calculates the signature with IssuerSigningKey (the shared secret in this config; with RS256 it verifies with the public key) and it matches. The token was issued by a trusted provider and hasn\'t been modified.'
        : 'Signature validation: someone changed the payload after it was signed (for example their user ID or role), so the re-calculated signature doesn\'t match the one on the token.',
      SEQ_LINES.signature,
      { predict: yesNo('Does the signature check pass?', sigOk) },
    );
    if (!sigOk) return fail(401, 'The signature is invalid, so authentication fails.');

    checks[1]!.result = 'pass';
    add(
      { kind: 'self', from: 'api', to: 'api', label: `iss == "${CONFIG.issuer}"`, phase: 'validation', result: 'pass' },
      `Issuer: the token's iss is "${token.iss}", the ValidIssuer from appsettings, so it was created by an authority this API trusts.`,
      SEQ_LINES.issuer,
    );
    const audOk = token.aud === CONFIG.audience;
    checks[2]!.result = audOk ? 'pass' : 'fail';
    add(
      { kind: 'self', from: 'api', to: 'api', label: `aud == "${CONFIG.audience}"`, phase: 'validation', result: audOk ? 'pass' : 'fail' },
      audOk
        ? `Audience: aud is "${token.aud}", so the token was intended for this API.`
        : `Audience: aud is "${token.aud}", not "${CONFIG.audience}". The token was made for another API; this check prevents reusing it here.`,
      SEQ_LINES.audience,
      { predict: yesNo('Does the audience check pass?', audOk) },
    );
    if (!audOk) return fail(401, 'The audience doesn\'t match, so authentication fails.');
    const expOk = scenario !== 'expired';
    checks[3]!.result = expOk ? 'pass' : 'fail';
    add(
      { kind: 'self', from: 'api', to: 'api', label: `exp + ClockSkew (${CONFIG.clockSkewMinutes} min) > now`, phase: 'validation', result: expOk ? 'pass' : 'fail' },
      expOk
        ? 'Expiry: exp is 15 minutes away, so the token is still valid.'
        : `Expiry: exp was 5 minutes ago. ClockSkew gives only a ${CONFIG.clockSkewMinutes}-minute grace period for clock differences, so the token is expired.`,
      SEQ_LINES.lifetime,
      { predict: yesNo('Does the expiry check pass?', expOk) },
    );
    if (!expOk) return fail(401, 'The token has expired, so authentication fails. (For a client this is the routine signal to get a new token.)');
    user = `authenticated (role ${token.role})`;
    add(
      { kind: 'self', from: 'api', to: 'api', label: 'ClaimsPrincipal → HttpContext.User', phase: 'validation', result: 'pass' },
      'All validations succeed: ASP.NET Core creates a ClaimsPrincipal and stores the token\'s claims in HttpContext.User (User in controllers).',
    );
  }

  const roleOk = token?.role === 'Admin';
  checks[4]!.result = roleOk ? 'pass' : 'fail';
  add(
    { kind: 'self', from: 'api', to: 'api', label: 'Authorization: [Authorize(Roles = "Admin")]', phase: 'validation', result: roleOk ? 'pass' : 'fail' },
    !token
      ? 'The authorization middleware evaluates [Authorize(Roles = "Admin")]. The user is anonymous, so it fails.'
      : roleOk
        ? 'The authorization middleware evaluates [Authorize(Roles = "Admin")]: the user has role Admin, so the request proceeds to the controller.'
        : 'The authorization middleware evaluates [Authorize(Roles = "Admin")]: the user is authenticated but has role User.',
    [],
    { predict: { question: 'What does authorization decide?', options: ['Proceed to the controller', '401 Unauthorized', '403 Forbidden'], answer: !token ? 1 : roleOk ? 0 : 2 } },
  );
  if (!token) return fail(401, 'No valid token was provided.');
  if (!roleOk) return fail(403, 'The user is logged in but doesn\'t have the Admin role.');

  add({ kind: 'msg', from: 'api', to: 'ctrl', label: 'Run the action', phase: 'validation' }, 'The request reaches the controller, which reads the user from User and runs the action.');
  outcome = { status: 200, text: 'OK' };
  add({ kind: 'msg', from: 'ctrl', to: 'client', label: '200 OK', phase: 'validation', status: 200 }, 'The response goes back to the client: 200 OK.', [], { action: 'done' });
  return steps;
}
