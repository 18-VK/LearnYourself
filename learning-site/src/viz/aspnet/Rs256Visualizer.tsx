import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { lineOf } from '../engine/code';
import { Controls, Narration, Variables } from '../engine/panels';
import type { Trace } from '../engine/types';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, ChipGroup, Simplified, SourcePanel, VizShell } from './common/ui';
import { parseJwt } from './jwt/jwt';
import { generateDemoKeyPair, RS256_SCENARIOS, traceRs256, type DemoKeyPair, type Rs256Scenario, type RsState } from './jwt/rs256';
import { RSA_SIGN_TEXT, RSA_SIGNING_CREDENTIALS_CODE, RSA_VERIFY_TEXT } from './sources';

export interface Rs256Props {
  scenario?: 'sign-with-private-verify-with-public' | Rs256Scenario | string;
  predictMode?: boolean;
  placement?: string;
}

const toScenario = (s: string | undefined): Rs256Scenario => (s === 'tampered' || s === 'forged' ? s : 'valid');

export default function Rs256Visualizer(props: Rs256Props) {
  const [scenario, setScenario] = useState<Rs256Scenario>(() => toScenario(props.scenario));
  const [keys, setKeys] = useState<{ server: DemoKeyPair; other: DemoKeyPair } | null>(null);
  const [trace, setTrace] = useState<Trace<RsState>>([]);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [generation, setGeneration] = useState(0);
  const [tab, setTab] = useState<'math' | 'dotnet'>('math');

  const makeKeys = useCallback(() => {
    if (!globalThis.crypto?.subtle) {
      setError('This browser does not expose Web Crypto here (it needs HTTPS or localhost), so no demo keys can be made.');
      return;
    }
    setKeys(null);
    Promise.all([generateDemoKeyPair('auth server'), generateDemoKeyPair('attacker')]).then(
      ([server, other]) => {
        setKeys({ server, other });
        setGeneration((g) => g + 1);
      },
      (e: Error) => setError(e.message),
    );
  }, []);
  useEffect(makeKeys, [makeKeys]);

  useEffect(() => {
    if (!keys) return;
    let live = true;
    traceRs256(scenario, keys.server, keys.other, now).then(
      (t) => live && setTrace(t),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [keys, scenario, now]);

  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), `${scenario}:${generation}:${trace.length}`, { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)];
  const s = step?.state;

  return (
    <VizShell title="RS256: sign with the private key, verify with the public key" label="RS256 signing visualizer" claimKeyboard={p.claimKeyboard} badge="demo keys">
      {error && <p className="viz-err" role="alert">{error}</p>}
      <div className="viz-input">
        <ChipGroup label="Scenario" value={scenario} options={RS256_SCENARIOS} onChange={setScenario} />
        <button type="button" className="chipbtn" onClick={makeKeys} disabled={!keys}>
          New key pairs
        </button>
        <label className="toggle">
          <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
        </label>
      </div>
      {!keys || !s || !step ? (
        <p className="viz-hint" role="status">
          Generating two 2048-bit RSA key pairs in your browser (one for the auth server, one for an attacker)…
        </p>
      ) : (
        <>
          <div className="viz-stage rs-stage">
            <div className={`rs-side${s.phase === 'sign' ? ' is-active' : ''}`}>
              <p className="asp-card-head">{scenario === 'forged' ? 'Attacker (own private key)' : 'Auth server (private key)'}</p>
              <KeyInfo k={scenario === 'forged' ? keys.other : keys.server} withPrivate />
              <Row label="signing_input" on={s.focus === 'input'}>
                <TokenText token={`${s.signingInput}.`} />
              </Row>
              <Row label="hash = SHA256(…)" on={s.focus === 'hash'}>
                <span className="mono rs-hex">{s.hash ?? '—'}</span>
              </Row>
              <Row label="padded hash (EM)" on={s.focus === 'em'}>
                {s.em ? (
                  <span className="rs-em" aria-label="EM layout">
                    <span className="rs-em-pad mono">{s.em.padding}</span>
                    <span className="rs-em-di mono">{s.em.digestInfo}</span>
                    <span className="rs-em-hash mono">{s.em.hash}</span>
                  </span>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="signature = EM ^ d mod n" on={s.focus === 'sign'}>
                <span className="mono rs-hex">{s.signature ?? '—'}</span>
              </Row>
              <Row label="token" on={s.focus === 'token'}>
                {s.token ? <TokenText token={s.token} /> : '—'}
              </Row>
            </div>
            <div className={`rs-side${s.phase === 'verify' ? ' is-active' : ''}`}>
              <p className="asp-card-head">API (public key only)</p>
              <KeyInfo k={keys.server} />
              <Row label="token received" on={s.focus === 'recompute' && scenario === 'tampered'}>
                {s.received ? <TokenText token={s.received} changed={scenario === 'tampered'} /> : '—'}
              </Row>
              <Row label="recomputed_hash" on={s.focus === 'recompute' || s.focus === 'compare'}>
                <span className="mono rs-hex">{s.recomputed ?? '—'}</span>
              </Row>
              <Row label="signature ^ e mod n" on={s.focus === 'recover'}>
                {s.recovered ? (
                  <span className="mono rs-hex">
                    {s.recovered.head} <span className={s.recovered.padding ? 'asp-good' : 'asp-bad'}>{s.recovered.padding ? '(00 01 FF … padding found)' : '(no padding: wrong key)'}</span>
                  </span>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="recovered_hash" on={s.focus === 'recover' || s.focus === 'compare'}>
                <span className="mono rs-hex">{s.recovered ? (s.recovered.hash ?? 'none') : '—'}</span>
              </Row>
              {s.valid !== null && (
                <p className={`rs-verdict ${s.valid ? 'is-ok' : 'is-bad'}`} role="status">
                  {s.valid ? '✓ Valid: recomputed_hash == recovered_hash' : '✗ Rejected (401)'}
                </p>
              )}
            </div>
          </div>
          <Controls p={p} label="RS256" />
          <div className="viz-panels">
            <div className="asp-code-col">
              <ChipGroup label="Code shown" value={tab} options={[{ id: 'math', label: 'The math (note 10)' }, { id: 'dotnet', label: '.NET signing key (note 11)' }]} onChange={setTab} />
              {tab === 'math' ? (
                <SourcePanel
                  code={s.panel === 'sign' ? RSA_SIGN_TEXT : RSA_VERIFY_TEXT}
                  lines={s.panelLines}
                  title={s.panel === 'sign' ? '1. Signing (Auth Server — private key), from the note' : '2. Verifying (Your API — public key), from the note'}
                  lang="text"
                />
              ) : (
                <SourcePanel
                  code={RSA_SIGNING_CREDENTIALS_CODE}
                  lines={s.phase === 'sign' && s.focus !== 'input' ? [lineOf(RSA_SIGNING_CREDENTIALS_CODE, 'SecurityAlgorithms.RsaSha256')] : s.phase === 'sign' ? [lineOf(RSA_SIGNING_CREDENTIALS_CODE, 'rsa.ImportFromPem')] : []}
                  title="For Asymmetric (RS256), from the note"
                  note={s.phase === 'verify' ? 'This is the auth server side; the API only needs the public key.' : undefined}
                />
              )}
            </div>
            <div className="viz-side">
              <Narration text={step.narration} prediction={step.predict} p={p} />
              <Variables vars={step.variables} />
              <AspLegend items={[['jwt-h', 'Header'], ['jwt-p', 'Payload'], ['jwt-s', 'Signature'], ['outline', 'Outline: the step running now']]} />
              <Simplified>
                The note writes signature = hash ^ d mod n. Real RS256 pads the hash first (EMSA-PKCS1-v1_5,{' '}
                <a href="https://www.rfc-editor.org/rfc/rfc8017#section-9.2" target="_blank" rel="noopener noreferrer">RFC 8017 §9.2</a>), as{' '}
                <a href="https://www.rfc-editor.org/rfc/rfc7518#section-3.3" target="_blank" rel="noopener noreferrer">RFC 7518 §3.3</a> requires. Keys are made in this page and never leave it.
              </Simplified>
            </div>
          </div>
        </>
      )}
    </VizShell>
  );
}

function Row({ label, on, children }: { label: string; on: boolean; children: ReactNode }) {
  return (
    <div className={`rs-row${on ? ' is-on' : ''}`}>
      <span className="rs-label mono">{label}</span>
      <div className="rs-val">{children}</div>
    </div>
  );
}

function KeyInfo({ k, withPrivate }: { k: DemoKeyPair; withPrivate?: boolean }) {
  return (
    <p className="rs-key">
      <span className="mono">n</span> = {k.k * 8}-bit modulus <span className="mono asp-muted">{k.n.toString(16).slice(0, 10)}…</span>, <span className="mono">e</span> = {k.e.toString()}
      {withPrivate && (
        <>
          , <span className="mono">d</span> = private (not shown)
        </>
      )}
    </p>
  );
}

function TokenText({ token, changed }: { token: string; changed?: boolean }) {
  const t = parseJwt(token);
  const [h, p, sig] = token.split('.');
  return (
    <span className="mono rs-token">
      <span className="jwt-h">{h}</span>
      <span className="jwt-dot">.</span>
      <span className={`jwt-p${changed ? ' rs-changed' : ''}`} title={t.payload.text ?? undefined}>
        {p}
      </span>
      {sig !== undefined && (
        <>
          <span className="jwt-dot">.</span>
          <span className="jwt-s">{sig}</span>
        </>
      )}
    </span>
  );
}
