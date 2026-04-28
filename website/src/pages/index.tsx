import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const QUICK_START = `import {Bigodin} from 'bigodin';

const bigodin = new Bigodin();
bigodin.addHelper('shout', (s) => String(s).toUpperCase());

const ast = bigodin.parse('Hello, {{shout name}}!');
const out = await bigodin.run(ast, {name: 'world'});
// "Hello, WORLD!"`;

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/">
            Get started
          </Link>
          <Link
            className={clsx(
              'button button--outline button--secondary button--lg',
              styles.secondaryButton,
            )}
            to="/docs/lib">
            API reference
          </Link>
          <Link
            className={clsx(
              'button button--outline button--secondary button--lg',
              styles.secondaryButton,
            )}
            href="https://github.com/JPBM135/bigodin">
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function HomepageQuickStart() {
  return (
    <section className={styles.quickStart}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">Install</Heading>
            <CodeBlock language="bash">{`yarn add bigodin\n# or\nnpm install bigodin`}</CodeBlock>
            <p>
              Use the singleton with built-in helpers, or{' '}
              <code>new Bigodin()</code> when you want to register your own.
            </p>
          </div>
          <div className="col col--6">
            <Heading as="h2">Render a template</Heading>
            <CodeBlock language="typescript">{QUICK_START}</CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageQuickStart />
      </main>
    </Layout>
  );
}
