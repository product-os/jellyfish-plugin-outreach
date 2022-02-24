const base = require('@balena/jellyfish-config/config/jest.config')

module.exports = {
	...base,
	testTimeout: 30000,
	transformIgnorePatterns: [
		"/node_modules/(?!serialize-error)",
	],
	transform: {
		"/node_modules/serialize-error/(.*)": 'jest-esm-transformer'
	}
};
