import type * as Preset from "@docusaurus/preset-classic";
import npm2yarn from "@docusaurus/remark-plugin-npm2yarn";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const ORG = "JPBM135";
const REPO = "bigodin";
const REPO_URL = `https://github.com/${ORG}/${REPO}`;
const OLD_REPO_URL = "https://github.com/gabriel-pinheiro/bigodon";

const config: Config = {
  title: "Bigodin",
  tagline:
    "Secure Handlebars/Mustache templating for user-provided templates, with async helpers and human-friendly parsing errors.",
  favicon: "img/logo.svg",

  future: {
    v4: true,
  },

  url: `https://${ORG.toLowerCase()}.github.io`,
  baseUrl: `/${REPO}/`,

  organizationName: ORG,
  projectName: REPO,
  trailingSlash: false,

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: ({ docPath }) =>
            `${REPO_URL}/edit/main/website/docs/${docPath}`,
          remarkPlugins: [[npm2yarn, { sync: true }]],
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  themeConfig: {
    image: "img/logo.svg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Bigodin",
      logo: {
        alt: "Bigodin logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          to: "/docs/tutorial/first-template",
          label: "Tutorial",
          position: "left",
        },
        {
          to: "/docs/lib",
          label: "API",
          position: "left",
        },
        {
          to: "/docs/language",
          label: "Template language",
          position: "left",
        },
        {
          to: "/docs/helpers",
          label: "Helpers",
          position: "left",
        },
        {
          to: "/playground",
          label: "Playground",
          position: "left",
        },
        {
          href: "https://www.npmjs.com/package/bigodin",
          label: "npm",
          position: "right",
        },
        {
          href: REPO_URL,
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/docs/" },
            { label: "Tutorial", to: "/docs/tutorial/first-template" },
            { label: "How-to guides", to: "/docs/how-to/render-html-safely" },
            { label: "Library API", to: "/docs/lib" },
            { label: "Template language", to: "/docs/language" },
            { label: "Block helpers", to: "/docs/helpers" },
            {
              label: "Mustache spec compatibility",
              to: "/docs/mustache-compat",
            },
          ],
        },
        {
          title: "Project",
          items: [
            { label: "Contributing", to: "/docs/contributing" },
            { label: "Issues", href: `${REPO_URL}/issues` },
            { label: "Changelog", href: `${REPO_URL}/releases` },
          ],
        },
        {
          title: "More",
          items: [
            { label: "GitHub", href: REPO_URL },
            { label: "npm", href: "https://www.npmjs.com/package/bigodin" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} JPBM135.<br/> This project is a fork of the original <a href="${OLD_REPO_URL}">Bigodon project</a>.<br/> Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
