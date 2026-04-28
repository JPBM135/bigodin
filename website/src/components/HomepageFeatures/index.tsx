import Heading from '@theme/Heading';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './styles.module.css';

type FeatureItem = {
  readonly description: ReactNode;
  readonly emoji: string;
  readonly title: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Safe by design',
    emoji: '🔒',
    description: (
      <>
        Templates are parsed into a JSON AST and interpreted at runtime, never compiled to
        JavaScript. Prototype-pollution guards and execution-time limits keep user-provided
        templates contained.
      </>
    ),
  },
  {
    title: 'Async helpers',
    emoji: '⚡',
    description: (
      <>
        Helpers can be async and run in parallel. Register your own with <code>addHelper</code> on a{' '}
        <code>Bigodin</code> instance, or use the bundled array, string, math, date, and comparison
        helpers.
      </>
    ),
  },
  {
    title: 'Mustache & Handlebars feel',
    emoji: '🎯',
    description: (
      <>
        Familiar <code>{'{{...}}'}</code> syntax with blocks, <code>else if</code>, path
        expressions, variables, and helpful parsing errors that point at the offending line and
        column.
      </>
    ),
  },
];

function Feature({ title, emoji, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <div aria-label={title} className={styles.featureEmoji} role="img">
          {emoji}
        </div>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
