import eslintJs from "@eslint/js";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.parcel-cache/**"
    ]
  },
  eslintJs.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        console: "readonly",
        URL: "readonly",
        Intl: "readonly",
        requestAnimationFrame: "readonly",
        CustomEvent: "readonly"
      }
    },
    rules: {
      quotes: ["error", "double", { allowTemplateLiterals: true }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "warn",
        {
          args: "after-used",
          ignoreRestSiblings: true
        }
      ],
      "no-param-reassign": "off"
    }
  }
];
