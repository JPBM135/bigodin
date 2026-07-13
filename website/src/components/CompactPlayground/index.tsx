import BrowserOnly from '@docusaurus/BrowserOnly';
import { Bigodin } from '@jpbm135/bigodin';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import styles from './styles.module.css';

type HelperFn = (...args: any[]) => unknown;

interface PlaygroundCase {
  readonly context: object | string;
  readonly label: string;
}

interface CompactPlaygroundProps {
  /**
   * Named context presets shown as tabs. Overrides `context` when present.
   */
  readonly cases?: readonly PlaygroundCase[];
  /**
   * Single context, as a JSON string or a plain object. Ignored when `cases` is set.
   */
  readonly context?: object | string;
  /**
   * Extra helpers registered on the instance, keyed by name.
   */
  readonly helpers?: Readonly<Record<string, HelperFn>>;
  /**
   * Initial template. Editable by the reader; the output recomputes live.
   */
  readonly template: string;
}

type RunResult = { message: string; status: 'error' } | { output: string; status: 'ok' };

function toJsonString(value: object | string | undefined): string {
  if (value === undefined) return '{}';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function CompactPlaygroundClient({
  template: initialTemplate,
  context,
  cases,
  helpers,
}: CompactPlaygroundProps): ReactNode {
  const hasCases = Array.isArray(cases) && cases.length > 0;
  const [template, setTemplate] = useState(initialTemplate);
  const [activeCase, setActiveCase] = useState(0);
  const [contextStr, setContextStr] = useState(() =>
    toJsonString(hasCases ? cases![0].context : context),
  );
  const [result, setResult] = useState<RunResult>({ status: 'ok', output: '' });

  // A ref keeps the latest helpers without re-triggering the debounce effect,
  // since MDX passes a fresh helpers object on every render.
  const helpersRef = useRef(helpers);
  helpersRef.current = helpers;

  const templateRows = useMemo(
    () => clamp(initialTemplate.split('\n').length + 1, 4, 18),
    [initialTemplate],
  );

  // Switching tabs reloads that case's context into the editor.
  function selectCase(index: number): void {
    setActiveCase(index);
    setContextStr(toJsonString(cases![index].context));
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      let ctx: unknown;
      try {
        ctx = contextStr.trim() === '' ? {} : JSON.parse(contextStr);
      } catch (error) {
        setResult({
          status: 'error',
          message: `Invalid JSON context: ${(error as Error).message}`,
        });
        return;
      }

      // Fresh instance per run keeps helper registration trivial and cheap
      // for these small templates.
      const bigodin = new Bigodin();
      for (const [name, fn] of Object.entries(helpersRef.current ?? {})) {
        bigodin.addHelper(name, fn);
      }

      try {
        const output = await bigodin.run(bigodin.parse(template), ctx as object);
        setResult({ status: 'ok', output });
      } catch (error) {
        setResult({ status: 'error', message: (error as Error).message ?? String(error) });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [template, contextStr]);

  const isError = result.status === 'error';

  return (
    <div className={styles.container}>
      {hasCases && (
        <div className={styles.tabs} role="tablist">
          {cases!.map((playgroundCase, index) => (
            <button
              aria-selected={index === activeCase}
              className={`${styles.tab} ${index === activeCase ? styles.tabActive : ''}`}
              key={playgroundCase.label}
              onClick={() => selectCase(index)}
              role="tab"
              type="button"
            >
              {playgroundCase.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.mainRow}>
        <div className={styles.column}>
          <span className={styles.label}>Template</span>
          <textarea
            className={styles.templateInput}
            onChange={(evt) => setTemplate(evt.target.value)}
            rows={templateRows}
            spellCheck={false}
            value={template}
          />
        </div>

        <div aria-hidden="true" className={styles.arrow}>
          →
        </div>

        <div className={styles.column}>
          <span className={styles.label}>
            Output {isError && <span className={styles.errorBadge}>!</span>}
          </span>
          <pre className={`${styles.output} ${isError ? styles.outputError : ''}`}>
            {isError ? result.message : result.output || '(empty output)'}
          </pre>
        </div>
      </div>

      <details className={styles.details}>
        <summary className={styles.summary}>Edit context (JSON)</summary>
        <textarea
          className={styles.contextInput}
          onChange={(evt) => setContextStr(evt.target.value)}
          rows={clamp(contextStr.split('\n').length + 1, 3, 16)}
          spellCheck={false}
          value={contextStr}
        />
      </details>
    </div>
  );
}

export default function CompactPlayground(props: CompactPlaygroundProps): ReactNode {
  return (
    <BrowserOnly fallback={<div className={styles.container}>Loading playground…</div>}>
      {() => <CompactPlaygroundClient {...props} />}
    </BrowserOnly>
  );
}
