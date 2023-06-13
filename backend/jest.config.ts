module.exports = {
   preset: 'ts-jest',
   testEnvironment: 'node',
   roots: ['__tests__'],
   testMatch: ['**/*.test.(ts|js)'],
   moduleFileExtensions: ['ts', 'js', 'json', 'node'],
   setupFiles: ['./jest.setup.ts'],
};