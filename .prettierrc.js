module.exports = {
  // Relaxed Prettier config - focus on consistency, not style wars
  semi: true,
  trailingComma: "es5",
  singleQuote: false, // Use double quotes (more readable in JSX)
  printWidth: 100, // Slightly wider than default for modern screens
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "avoid",
  endOfLine: "lf",

  // React/JSX specific
  jsxSingleQuote: false,

  // File-specific overrides
  overrides: [
    {
      files: "*.json",
      options: {
        printWidth: 80,
      },
    },
  ],
};
