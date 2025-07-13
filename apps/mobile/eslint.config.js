const js = require("@eslint/js");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const typescriptParser = require("@typescript-eslint/parser");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const reactNative = require("eslint-plugin-react-native");
const prettier = require("eslint-config-prettier");

module.exports = [
  // Base JavaScript config
  js.configs.recommended,

  // Ignore patterns
  {
    ignores: ["node_modules/**", "android/**", "ios/**", ".expo/**", "dist/**", "web-build/**"],
  },

  // Config files (Node.js environment)
  {
    files: [
      "*.config.js",
      "commitlint.config.js",
      ".prettierrc.js",
      "babel.config.js",
      "metro.config.js",
    ],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        exports: "readonly",
        process: "readonly",
      },
    },
  },

  // Source files (React Native environment)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        __DEV__: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        XMLHttpRequest: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        crypto: "readonly",
        React: "readonly",
        RequestInit: "readonly",
        URLSearchParams: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      react: react,
      "react-hooks": reactHooks,
      "react-native": reactNative,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // TypeScript rules (relaxed)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/ban-ts-comment": "warn",

      // React rules
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/display-name": "warn",
      "react/jsx-uses-react": "off", // Not needed in React 17+
      "react/jsx-uses-vars": "error",

      // React Hooks (relaxed)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React Native (relaxed)
      "react-native/no-unused-styles": "warn",
      "react-native/split-platform-components": "off",
      "react-native/no-inline-styles": "off",
      "react-native/no-color-literals": "off",

      // General rules (relaxed)
      "no-console": "warn",
      "prefer-const": "warn",
      "no-var": "error",
      "no-unused-vars": "off", // Using TypeScript version instead
      "no-undef": "error",
    },
  },

  // Root level files
  {
    files: ["App.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        require: "readonly",
        module: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      react: react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Prettier config (must be last)
  prettier,
];
