import { expect, test } from 'vitest'

import {
	exemptRelativePaths,
	findTemporalLanguageMatches,
	stripMarkdownCode,
} from './check-docs-temporal-language.ts'

test('stripMarkdownCode removes fenced and inline code', () => {
	const input = `
Before \`Date.now()\` after.

\`\`\`ts
const now = Date.now()
\`\`\`

Still prose.
`
	expect(stripMarkdownCode(input).replace(/\n{3,}/g, '\n\n')).toBe(`
Before  after.

Still prose.
`)
})

test('findTemporalLanguageMatches flags rollout phrasing in prose', () => {
	const matches = findTemporalLanguageMatches({
		relativePath: 'docs/use/example.md',
		content: 'We no longer accept legacy manifest shapes.',
	})
	expect(matches.length).toBeGreaterThan(0)
	expect(matches).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				file: 'docs/use/example.md',
				line: 1,
				pattern: 'we no longer',
			}),
		]),
	)
})

test('findTemporalLanguageMatches ignores code blocks in markdown', () => {
	const matches = findTemporalLanguageMatches({
		relativePath: 'docs/use/example.md',
		content: '```md\nWe no longer document this in samples.\n```',
	})
	expect(matches).toEqual([])
})

test('documentation principle examples are exempt', () => {
	expect(exemptRelativePaths.has('docs/contributing/documentation.md')).toBe(
		true,
	)
	const matches = findTemporalLanguageMatches({
		relativePath: 'docs/contributing/documentation.md',
		content: 'We no longer accept legacy manifest shapes.',
	})
	expect(matches).toEqual([])
})

test('migration guides stay exempt', () => {
	const matches = findTemporalLanguageMatches({
		relativePath: 'docs/contributing/secret-rotation.md',
		content: 'Keep the old key available during rotation.',
	})
	expect(matches).toEqual([])
})
