import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controls, Narration, Variables } from '../engine/panels';
import type { Trace } from '../engine/types';
import { usePlayer } from '../engine/usePlayer';
import { AspLegend, SourcePanel, VizShell } from './common/ui';
import { b64urlEncode, b64urlFromString } from './jwt/b64';
import { DEMO_HEADER, demoPayload, traceDecoder, type DecoderState, type TokenSource } from './jwt/decoder';
import { parseJwt, randomSecret, signHs256 } from './jwt/jwt';
import { JWT_HEADER_JSON, JWT_NOTE_TOKEN, JWT_SIGNATURE_TEXT } from './sources';

export interface JwtDecoderProps {
  /** let the learner edit the payload (and see the signature break) */
  editablePayload?: boolean;
  predictMode?: boolean;
  placement?: string;
}

const pretty = (j: unknown) => JSON.stringify(j, null, 2);

export default function JwtDecoderVisualizer(props: JwtDecoderProps) {
  const editable = props.editablePayload !== false;
  const id = useId();
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const [secret, setSecret] = useState<Uint8Array | null>(null);
  const [otherSecret, setOtherSecret] = useState<Uint8Array | null>(null);
  const [useWrongSecret, setUseWrongSecret] = useState(false);
  const [token, setToken] = useState('');
  const [source, setSource] = useState<TokenSource>('demo');
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [trace, setTrace] = useState<Trace<DecoderState>>([]);
  const [cryptoError, setCryptoError] = useState<string | null>(null);

  // demo secret + demo token, made in the page (never a real key, never sent anywhere)
  useEffect(() => {
    if (!globalThis.crypto?.subtle) {
      setCryptoError('This browser does not expose Web Crypto here (it needs HTTPS or localhost), so the demo token cannot be signed.');
      return;
    }
    const s = randomSecret();
    setSecret(s);
    setOtherSecret(randomSecret());
    const payload = demoPayload(now);
    void signHs256(DEMO_HEADER, payload, s).then((t) => {
      setToken(t);
      setDraft(pretty(payload));
    });
  }, [now]);

  const verifyWith = useWrongSecret ? otherSecret : secret;
  useEffect(() => {
    if (!token || !verifyWith) return;
    let live = true;
    traceDecoder(token, verifyWith, now, source).then(
      (t) => live && setTrace(t),
      (e: Error) => live && setCryptoError(e.message),
    );
    return () => {
      live = false;
    };
  }, [token, verifyWith, now, source]);

  const p = usePlayer(trace.length, (i) => Boolean(trace[i]?.predict), trace.length ? `${token}:${useWrongSecret}` : 'empty', { predict: props.predictMode });
  const step = trace[Math.min(p.index, trace.length - 1)];
  const final = trace.at(-1)?.state;
  const parsed = useMemo(() => parseJwt(token), [token]);

  // keep the editor in step with tokens loaded from elsewhere
  const lastLoaded = useRef('');
  useEffect(() => {
    if (source === 'edited' || token === lastLoaded.current) return;
    lastLoaded.current = token;
    if (parsed.payload.json) setDraft(pretty(parsed.payload.json));
  }, [token, source, parsed]);

  const onDraft = (text: string) => {
    setDraft(text);
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch {
      setDraftError('Not valid JSON yet. The token updates when it is.');
      return;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      setDraftError('The payload must be a JSON object.');
      return;
    }
    setDraftError(null);
    // keep the header and the old signature: only the payload changes
    const t = `${parsed.header.raw}.${b64urlFromString(JSON.stringify(obj))}.${parsed.signature.raw}`;
    if (t !== token) {
      setSource('edited');
      setToken(t);
    }
  };
  const resign = async () => {
    if (!secret || !parsed.payload.json) return;
    setUseWrongSecret(false);
    setSource('resigned');
    setToken(await signHs256(parsed.header.text ?? DEMO_HEADER, parsed.payload.json, secret));
  };
  const reset = async () => {
    if (!secret) return;
    const payload = demoPayload(now);
    setUseWrongSecret(false);
    setSource('demo');
    setDraftError(null);
    setToken(await signHs256(DEMO_HEADER, payload, secret));
    setDraft(pretty(payload));
  };
  const loadNote = () => {
    setSource('note');
    setToken(JWT_NOTE_TOKEN.replace(/\s+/g, ''));
  };
  const loadPasted = () => {
    if (!paste.trim()) return;
    setSource('pasted');
    setToken(paste.trim());
  };

  const focus = step?.state.focus ?? 'all';
  const st = step?.state;
  // in predict mode, don't give the answer away before the compare step
  const compareAt = trace.findIndex((t) => t.state.focus === 'compare');
  const verdict = p.predict && compareAt >= 0 && p.index < compareAt ? undefined : final?.valid;

  return (
    <VizShell title="JWT decoder" label="JWT decoder visualizer" claimKeyboard={p.claimKeyboard} badge="demo token">
      {cryptoError && <p className="viz-err" role="alert">{cryptoError}</p>}
      <div className="viz-input asp-input-stack">
        <div className="asp-field">
          <button type="button" className="chipbtn" onClick={() => void reset()} aria-pressed={source === 'demo'}>
            Fresh demo token
          </button>
          <button type="button" className="chipbtn" onClick={loadNote} aria-pressed={source === 'note'}>
            The note&apos;s example token
          </button>
          {editable && (
            <button type="button" className="chipbtn" onClick={() => void resign()} disabled={!parsed.payload.json || parsed.header.json?.alg !== 'HS256'}>
              Re-sign with the demo secret
            </button>
          )}
          <label className="toggle">
            <input type="checkbox" checked={useWrongSecret} onChange={(e) => setUseWrongSecret(e.target.checked)} /> Verify with a different secret
          </label>
          <label className="toggle">
            <input type="checkbox" checked={p.predict} onChange={(e) => p.setPredict(e.target.checked)} /> Predict mode
          </label>
        </div>
        <div className="asp-field">
          <label htmlFor={`${id}-paste`}>Decode a token</label>
          <input
            id={`${id}-paste`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a JWT and press Enter (it stays in this page)"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPasted()}
          />
          <button type="button" className="chipbtn" onClick={loadPasted}>
            Decode
          </button>
        </div>
      </div>

      <div className="viz-stage jwt-stage">
        <div className="jwt-token-wrap">
          <p className="jwt-token mono" aria-label="The token, colour-coded by part">
            {token ? (
              <>
                <span className={`jwt-h${focus === 'header' || focus === 'b64' || focus === 'all' || focus === 'recompute' ? ' is-focus' : ''}`}>{parsed.header.raw}</span>
                <span className="jwt-dot">.</span>
                <span className={`jwt-p${focus === 'payload' || focus === 'all' || focus === 'recompute' || focus === 'claims' ? ' is-focus' : ''}`}>{parsed.payload.raw}</span>
                <span className="jwt-dot">.</span>
                <span className={`jwt-s${focus === 'signature' || focus === 'all' || focus === 'compare' ? ' is-focus' : ''}`}>{parsed.signature.raw}</span>
              </>
            ) : (
              'Making a demo token…'
            )}
          </p>
          <p className="jwt-verdict" role="status">
            {verdict === true && <span className="asp-good">✓ Signature valid with the {useWrongSecret ? 'other' : 'demo'} secret</span>}
            {verdict === false && <span className="asp-bad">✗ Signature does not match: the API would reject this token (401)</span>}
            {verdict === null && token && <span className="asp-muted">Signature not checked here</span>}
            {secret && <span className="asp-muted jwt-secret"> · demo secret {b64urlEncode((useWrongSecret ? otherSecret : secret) ?? secret).slice(0, 10)}… (random, made in this page)</span>}
          </p>
        </div>

        {st && focus === 'b64' && st.b64.length > 0 && (
          <table className="jwt-b64" aria-label="Base64url decoding of the first four characters">
            <thead>
              <tr>
                <th scope="row">Character</th>
                {st.b64.map((x, i) => (
                  <td key={i} className="mono">{x.char}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Value</th>
                {st.b64.map((x, i) => (
                  <td key={i} className="mono">{x.value}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">6 bits</th>
                {st.b64.map((x, i) => (
                  <td key={i} className="mono">{x.bits}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Bytes</th>
                <td colSpan={4} className="mono">
                  {st.b64Bytes.map((b) => `${b.toString(2).padStart(8, '0')} = 0x${b.toString(16).toUpperCase().padStart(2, '0')} '${String.fromCharCode(b)}'`).join('  ·  ')}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <div className="jwt-parts">
          <section className={`jwt-part jwt-part-h${focus === 'header' ? ' is-focus' : ''}`} aria-label="Decoded header">
            <h4>Header</h4>
            <pre className="mono">{parsed.header.json ? pretty(parsed.header.json) : (parsed.header.error ?? '')}</pre>
          </section>
          <section className={`jwt-part jwt-part-p${focus === 'payload' || focus === 'claims' ? ' is-focus' : ''}`} aria-label="Decoded payload">
            <h4>
              Payload{' '}
              {editable && source !== 'note' && <span className="asp-muted">(edit it)</span>}
            </h4>
            {editable && source !== 'note' ? (
              <>
                <label className="asp-vh" htmlFor={`${id}-payload`}>
                  Payload JSON
                </label>
                <textarea id={`${id}-payload`} className="mono jwt-edit" spellCheck={false} value={draft} onChange={(e) => onDraft(e.target.value)} rows={11} aria-invalid={Boolean(draftError)} />
                {draftError && <p className="viz-err">{draftError}</p>}
              </>
            ) : (
              <pre className="mono">{parsed.payload.json ? pretty(parsed.payload.json) : (parsed.payload.error ?? '')}</pre>
            )}
          </section>
          <section className={`jwt-part jwt-part-s${focus === 'signature' || focus === 'compare' || focus === 'recompute' ? ' is-focus' : ''}`} aria-label="Signature">
            <h4>Signature</h4>
            <dl className="jwt-sig">
              <dt>In the token</dt>
              <dd className="mono">{parsed.signature.raw || '—'}</dd>
              <dt>Recomputed</dt>
              <dd className="mono">{st?.expected ?? '— (step on to recompute it)'}</dd>
            </dl>
          </section>
        </div>

        {final && final.claims.length > 0 && (
          <div className="table-wrap jwt-claims-wrap">
            <table className="jwt-claims">
              <caption>Claims, explained with the note&apos;s table</caption>
              <thead>
                <tr>
                  <th scope="col">Claim</th>
                  <th scope="col">Meaning</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {final.claims.map((c) => (
                  <tr key={c.name}>
                    <td className="mono">{c.name}</td>
                    <td>{c.meaning}</td>
                    <td className="mono">
                      {c.value}
                      {c.time && <span className={`jwt-time${c.time.bad ? ' asp-bad' : ''}`}> = {c.time.iso}, {c.time.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {step && (
        <>
          <Controls p={p} label="JWT decoding" />
          <div className="viz-panels">
            {st?.panel === 'header' ? (
              <SourcePanel code={JWT_HEADER_JSON} lines={st.panelLines} title="1. Header, from the note" lang="text" />
            ) : (
              <SourcePanel code={JWT_SIGNATURE_TEXT} lines={st?.panelLines ?? []} title="3. Signature, from the note" lang="text" />
            )}
            <div className="viz-side">
              <Narration text={step.narration} prediction={step.predict} p={p} />
              <Variables vars={step.variables} />
              <AspLegend items={[['jwt-h', 'Header'], ['jwt-p', 'Payload'], ['jwt-s', 'Signature']]} />
            </div>
          </div>
        </>
      )}
    </VizShell>
  );
}
