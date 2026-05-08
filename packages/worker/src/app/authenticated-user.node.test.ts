import { expect, test } from 'vitest'
import { createAuthCookie, setAuthSessionSecret } from '#app/auth-session.ts'
import { readAuthenticatedAppUser } from './authenticated-user.ts'

const cookieSecret = 'LOCAL_AND_PREVIEW_COOKIE_SECRET_32_CHARS_MINIMUM'

test('authenticated user reader accepts an already-parsed app environment', async () => {
	const env = {
		COOKIE_SECRET: cookieSecret,
		REMOTE_CONNECTOR_SECRETS: {
			'lights:default': 'shared-secret',
		},
	} as unknown as Env

	const unauthenticated = await readAuthenticatedAppUser(
		new Request('https://example.com/account/secrets.json'),
		env,
	)
	expect(unauthenticated).toBeNull()

	setAuthSessionSecret(cookieSecret)
	const cookie = await createAuthCookie(
		{
			id: '42',
			email: 'me@kentcdodds.com',
			rememberMe: false,
		},
		true,
	)
	const authenticated = await readAuthenticatedAppUser(
		new Request('https://example.com/account/secrets.json', {
			headers: {
				Cookie: cookie,
			},
		}),
		env,
	)

	expect(authenticated).toMatchObject({
		sessionUserId: '42',
		userId: 42,
		email: 'me@kentcdodds.com',
		mcpUser: {
			email: 'me@kentcdodds.com',
		},
	})
})
