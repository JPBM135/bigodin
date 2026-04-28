import BrowserOnly from '@docusaurus/BrowserOnly';
import { Bigodin } from '@jpbm135/bigodin';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  | { durationMs: number; output: string; status: 'ok' }
  | { message: string; status: 'error' }
  | { status: 'idle' }
  | { status: 'running' };

function PlaygroundClient(): ReactNode {
  const [template, setTemplate] = useState<string>(() => loadDraft('template') ?? DEFAULT_TEMPLATE);
  const [contextSource, setContextSource] = useState<string>(
    () => loadDraft('context') ?? DEFAULT_CONTEXT,
  );
  const [autoRun, setAutoRun] = useState<boolean>(true);
  const [result, setResult] = useState<RunResult>({ status: 'idle' });

  const bigodin = useMemo(() => {
    const instance = new Bigodin();
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    instance.addHelper('shout', (str: unknown) => String(str ?? '').toUpperCase());
    instance.addHelper('json', (val: unknown) => JSON.stringify(val, null, 2));
    instance.addHelper('len', (val: unknown) => {
      if (Array.isArray(val) || typeof val === 'string') return val.length;
      if (val && typeof val === 'object') return Object.keys(val).length;
      return 0;
    });
    instance.addHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
    return instance;
  }, []);

  const runIdRef = useRef(0);

  async function run() {
    const id = ++runIdRef.current;
    setResult({ status: 'running' });

    let context: unknown;
    try {
      context = contextSource.trim() === '' ? {} : JSON.parse(contextSource);
    } catch (error) {
      setResult({
        status: 'error',
        message: `Invalid JSON context: ${(error as Error).message}`,
      });
      return;
    }

    try {
      const start = performance.now();
      const ast = bigodin.parse(template);
      const output = await bigodin.run(ast, context as object);
      const durationMs = performance.now() - start;
      if (runIdRef.current !== id) return;
      setResult({ status: 'ok', output, durationMs });
    } catch (error) {
      if (runIdRef.current !== id) return;
      setResult({
        status: 'error',
        message: (error as Error).message ?? String(error),
      });
    }
  }

  useEffect(() => {
    saveDraft('template', template);
    saveDraft('context', contextSource);
    if (!autoRun) return;
    const timeout = setTimeout(run, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, contextSource, autoRun]);

  function reset() {
    setTemplate(DEFAULT_TEMPLATE);
    setContextSource(DEFAULT_CONTEXT);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.controls}>
        <button className="button button--primary" onClick={async () => run()} type="button">
          Run
        </button>
        <label className={styles.autoRun}>
          <input
            checked={autoRun}
            onChange={(evt) => setAutoRun(evt.target.checked)}
            type="checkbox"
          />
          Auto-run
        </label>
        <button
          className="button button--secondary button--outline"
          onClick={() => reset()}
          type="button"
        >
          Reset to example
        </button>
        <span className={styles.status}>
          {result.status === 'running' && 'Running…'}
          {result.status === 'ok' && `Rendered in ${result.durationMs.toFixed(1)}ms`}
          {result.status === 'error' && 'Error'}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.pane}>
          <label className={styles.paneLabel} htmlFor="bigodin-template">
            Template
          </label>
          <textarea
            className={styles.editor}
            id="bigodin-template"
            onChange={(evt) => setTemplate(evt.target.value)}
            spellCheck={false}
            value={template}
          />
        </div>

        <div className={styles.pane}>
          <label className={styles.paneLabel} htmlFor="bigodin-context">
            Context (JSON)
          </label>
          <textarea
            className={styles.editor}
            id="bigodin-context"
            onChange={(evt) => setContextSource(evt.target.value)}
            spellCheck={false}
            value={contextSource}
          />
        </div>

        <div className={styles.pane}>
          <span className={styles.paneLabel}>Output</span>
          <pre
            className={
              result.status === 'error' ? `${styles.output} ${styles.outputError}` : styles.output
            }
          >
            {result.status === 'ok' && (result.output || '(empty output)')}
            {result.status === 'error' && result.message}
            {result.status === 'running' && '…'}
            {result.status === 'idle' && 'Press Run.'}
          </pre>
        </div>
      </div>

      <p className={styles.footnote}>
        Pre-registered helpers: <code>{'{{shout x}}'}</code> uppercases, <code>{'{{len x}}'}</code>{' '}
        returns the length of an array / string / object, <code>{'{{add a b}}'}</code> sums two
        numbers, and <code>{'{{json x}}'}</code> serializes any value. Templates run with a 100ms
        execution budget by default.
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
    <Layout description="Try Bigodin templates in the browser." title="Playground">
      <main className="container margin-vert--lg">
        <Heading as="h1">Playground</Heading>
        <p>
          Edit the template and context, then hit <strong>Run</strong> (or enable auto-run).
          Everything executes locally in your browser, no server involved.
        </p>
        <BrowserOnly fallback={<p>Loading playground…</p>}>
          {() => <PlaygroundClient />}
        </BrowserOnly>
      </main>
    </Layout>
  );
}
