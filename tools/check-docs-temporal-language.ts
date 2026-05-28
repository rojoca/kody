import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { isExecutedDirectly } from './node-runtime.ts'

export type TemporalLanguageMatch = {
	file: string
	line: number
	column: number
	pattern: string
	excerpt: string
}

/** Paths that define or exercise migration-style wording by design. */
export const exemptRelativePaths = new Set([
	'docs/contributing/documentation.md',
	'docs/contributing/secret-rotation.md',
])

/**
 * Changelog-style phrases to flag in docs and docs-like product copy.
 * Keep aligned with docs/contributing/documentation.md.
 */
export const temporalLanguagePatterns: ReadonlyArray<{
	label: string
	regex: RegExp
}> = [
	{ label: 'now we', regex: /\bnow we\b/i },
	{ label: 'we now', regex: /\bwe now\b/i },
	{ label: 'we no longer', regex: /\bwe no longer\b/i },
	{ label: 'Kody now', regex: /\bKody now\b/i },
	{ label: 'previously we', regex: /\bpreviously we\b/i },
	{ label: 'formerly we', regex: /\bformerly we\b/i },
	{
		label: 'no longer support/accept/require/use',
		regex: /\bno longer (?:support|accept|require|use)s?\b/i,
	},
	{
		label: 'now support/accept/require/use/store/return',
		regex: /\bnow (?:support|accept|require|use|store|return)s?\b/i,
	},
	{
		label: 'used to support/require',
		regex: /\bused to (?:support|require)\b/i,
	},
]

export function stripMarkdownCode(content: string) {
	return content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '')
}

export function findTemporalLanguageMatches(input: {
	relativePath: string
	content: string
}): TemporalLanguageMatch[] {
	if (exemptRelativePaths.has(input.relativePath.replaceAll('\\', '/'))) {
		return []
	}

	const prose =
		input.relativePath.endsWith('.md') || input.relativePath.endsWith('.mdx')
			? stripMarkdownCode(input.content)
			: input.content

	const matches: TemporalLanguageMatch[] = []
	const lines = prose.split('\n')

	for (const [lineIndex, line] of lines.entries()) {
		for (const pattern of temporalLanguagePatterns) {
			const match = pattern.regex.exec(line)
			if (!match) continue
			matches.push({
				file: input.relativePath,
				line: lineIndex + 1,
				column: match.index + 1,
				pattern: pattern.label,
				excerpt: line.trim(),
			})
		}
	}

	return matches
}

async function collectMarkdownFiles(
	directory: string,
	relativePrefix = '',
): Promise<Array<string>> {
	const entries = await readdir(directory, { withFileTypes: true })
	const files: Array<string> = []

	for (const entry of entries) {
		const relativePath = relativePrefix
			? `${relativePrefix}/${entry.name}`
			: entry.name
		const absolutePath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			files.push(...(await collectMarkdownFiles(absolutePath, relativePath)))
			continue
		}
		if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
			files.push(relativePath.replaceAll('\\', '/'))
		}
	}

	return files
}

export async function listDocumentationPaths(cwd = process.cwd()) {
	const markdownRoots = [
		{ directory: path.join(cwd, 'docs'), prefix: 'docs' },
		{ directory: path.join(cwd, '.agents'), prefix: '.agents' },
	]
	const relativePaths = [
		'README.md',
		'AGENTS.md',
		'packages/worker/src/mcp/server-instructions.ts',
	]

	for (const root of markdownRoots) {
		const files = await collectMarkdownFiles(root.directory, root.prefix)
		relativePaths.push(...files)
	}

	return [...new Set(relativePaths)].sort()
}

export async function checkDocumentationTemporalLanguage(cwd = process.cwd()) {
	const relativePaths = await listDocumentationPaths(cwd)
	const allMatches: TemporalLanguageMatch[] = []

	for (const relativePath of relativePaths) {
		const absolutePath = path.join(cwd, relativePath)
		const content = await readFile(absolutePath, 'utf8')
		allMatches.push(
			...findTemporalLanguageMatches({
				relativePath,
				content,
			}),
		)
	}

	return allMatches
}

function formatMatches(matches: ReadonlyArray<TemporalLanguageMatch>) {
	return matches
		.map(
			(match) =>
				`${match.file}:${match.line}:${match.column} (${match.pattern}): ${match.excerpt}`,
		)
		.join('\n')
}

export async function main(cwd = process.cwd()) {
	const matches = await checkDocumentationTemporalLanguage(cwd)
	if (matches.length === 0) {
		console.log('docs temporal-language check: ok')
		return 0
	}

	console.error(
		[
			'docs temporal-language check: failed',
			'',
			'Documentation should describe current behavior, not rollouts.',
			'See docs/contributing/documentation.md.',
			'',
			formatMatches(matches),
		].join('\n'),
	)
	return 1
}

if (isExecutedDirectly(import.meta.url)) {
	const exitCode = await main()
	process.exit(exitCode)
}
