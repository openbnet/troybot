module.exports = {
    roots: [
      "<rootDir>/src",
    ],
    testMatch: [
      "**/__tests__/**/*.+(ts|tsx|js)",
      "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    transform: {
      "^.+\\.(ts|tsx)$": "ts-jest"
    },
    collectCoverageFrom: [
      "**/*.{js,jsx,ts,tsx}",
      "!**/*.d.ts",
      "!**/node_modules/**",
    ],
    testTimeout: 5000,
    "transform": {
      "^.+\\.tsx?$": [
        "ts-jest",
        {
          "tsconfig": "tsconfig.json"
        }
      ]
  },
  }