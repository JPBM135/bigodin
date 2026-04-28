import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {Bigodin} from '@jpbm135/bigodin';

import styles from './playground.module.css';

const DEFAULT_TEMPLATE = `Hello, {{shout name}}!

{{#if items}}
You have {{len items}} item(s):
{{#each items}}
  - {{$this.label}} ({{$this.qty}})
{{/each}}

{{= $total 0}}
{{#each items}}{{= $total (add $total $this.qty)}}{{/each}}
Total quantity: {{$total}}.
{{else}}
Your cart is empty.
{{/if}}`;

const DEFAULT_CONTEXT = `{
  "name": "world",
  "items": [
    {"label": "Apple", "qty": 3},
    {"label": "Pear",  "qty": 2}
  ]
}`;

type RunResult =
  | {status: 'idle'}
  | {status: 'running'}
  | {status: 'ok'; output: string; durationMs: number}
  | {status: 'error'; message: string};

function PlaygroundClient(): ReactNode {
  const [template, setTemplate] = useState<string>(() => {
    return loadDraft('template') ?? DEFAULT_TEMPLATE;
  });
  const [contextSource, setContextSource] = useState<string>(() => {
    return loadDraft('context') ?? DEFAULT_CONTEXT;
  });
  const [autoRun, setAutoRun] = useState<boolean>(true);
  const [result, setResult] = useState<RunResult>({status: 'idle'});

  const bigodin = useMemo(() => {
    const instance = new Bigodin();
    instance.addHelper('shout', (s: unknown) => String(s ?? '').toUpperCase());
    instance.addHelper('json', (v: unknown) => JSON.stringify(v, null, 2));
    instance.addHelper('len', (v: unknown) => {
      if (Array.isArray(v) || typeof v === 'string') return v.length;
      if (v && typeof v === 'object') return Object.keys(v).length;
      return 0;
    });
    instance.addHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
    return instance;
  }, []);

  const runIdRef = useRef(0);

  async function run() {
    const id = ++runIdRef.current;
    setResult({status: 'running'});

    let context: unknown;
    try {
      context = contextSource.trim() === '' ? {} : JSON.parse(contextSource);
    } catch (err) {
      setResult({
        status: 'error',
        message: `Invalid JSON context: ${(err as Error).message}`,
      });
      return;
    }

    try {
      const start = performance.now();
      const ast = bigodin.parse(template);
      const output = await bigodin.run(ast, context as object);
      const durationMs = performance.now() - start;
      if (runIdRef.current !== id) return;
      setResult({status: 'ok', output, durationMs});
    } catch (err) {
      if (runIdRef.current !== id) return;
      setResult({
        status: 'error',
        message: (err as Error).message ?? String(err),
      });
    }
  }

  useEffect(() => {
    saveDraft('template', template);
    saveDraft('context', contextSource);
    if (!autoRun) return;
    const t = setTimeout(run, 200);
    return () => clearTimeout(t);
  }, [template, contextSource, autoRun]);

  function reset() {
    setTemplate(DEFAULT_TEMPLATE);
    setContextSource(DEFAULT_CONTEXT);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.controls}>
        <button className="button button--primary" onClick={run}>
          Run
        </button>
        <label className={styles.autoRun}>
          <input
            type="checkbox"
            checked={autoRun}
            onChange={(e) => setAutoRun(e.target.checked)}
          />
          Auto-run
        </label>
        <button
          className="button button--secondary button--outline"
          onClick={reset}>
          Reset to example
        </button>
        <span className={styles.status}>
          {result.status === 'running' && 'Running…'}
          {result.status === 'ok' &&
            `Rendered in ${result.durationMs.toFixed(1)}ms`}
          {result.status === 'error' && 'Error'}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.pane}>
          <label className={styles.paneLabel} htmlFor="bigodin-template">
            Template
          </label>
          <textarea
            id="bigodin-template"
            className={styles.editor}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className={styles.pane}>
          <label className={styles.paneLabel} htmlFor="bigodin-context">
            Context (JSON)
          </label>
          <textarea
            id="bigodin-context"
            className={styles.editor}
            value={contextSource}
            onChange={(e) => setContextSource(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className={styles.pane}>
          <span className={styles.paneLabel}>Output</span>
          <pre
            className={
              result.status === 'error'
                ? `${styles.output} ${styles.outputError}`
                : styles.output
            }>
            {result.status === 'ok' && (result.output || '(empty output)')}
            {result.status === 'error' && result.message}
            {result.status === 'running' && '…'}
            {result.status === 'idle' && 'Press Run.'}
          </pre>
        </div>
      </div>

      <p className={styles.footnote}>
        Pre-registered helpers: <code>{'{{shout x}}'}</code> uppercases,{' '}
        <code>{'{{len x}}'}</code> returns the length of an array / string /
        object, <code>{'{{add a b}}'}</code> sums two numbers, and{' '}
        <code>{'{{json x}}'}</code> serializes any value. Templates run with a
        100ms execution budget by default.
      </p>
    </div>
  );
}

function loadDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(`bigodin-playground:${key}`);
  } catch {
    return null;
  }
}

function saveDraft(key: string, value: string): void {
  try {
    window.localStorage.setItem(`bigodin-playground:${key}`, value);
  } catch {
    // ignore quota / privacy mode
  }
}

export default function PlaygroundPage(): ReactNode {
  return (
    <Layout
      title="Playground"
      description="Try Bigodin templates in the browser.">
      <main className="container margin-vert--lg">
        <Heading as="h1">Playground</Heading>
        <p>
          Edit the template and context, then hit <strong>Run</strong> (or
          enable auto-run). Everything executes locally in your browser, no
          server involved.
        </p>
        <BrowserOnly fallback={<p>Loading playground…</p>}>
          {() => <PlaygroundClient />}
        </BrowserOnly>
      </main>
    </Layout>
  );
}
