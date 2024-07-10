import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { z } from 'zod'
import { getStringFromBuffer } from './lib/utils'
import { getUser } from './app/login/actions'
import azureAd from 'next-auth/providers/azure-ad'


export const { 
  handlers: {GET, POST},
    auth,
    signIn,
    signOut
  } = NextAuth({
  // ...authConfig,
  providers: [
    // Credentials({
    //   async authorize(credentials) {
    //     const parsedCredentials = z
    //       .object({
    //         email: z.string().email(),
    //         password: z.string().min(6)
    //       })
    //       .safeParse(credentials)

    //     if (parsedCredentials.success) {
    //       const { email, password } = parsedCredentials.data
    //       const user = await getUser(email)

    //       if (!user) return null

    //       const encoder = new TextEncoder()
    //       const saltedPassword = encoder.encode(password + user.salt)
    //       const hashedPasswordBuffer = await crypto.subtle.digest(
    //         'SHA-256',
    //         saltedPassword
    //       )
    //       const hashedPassword = getStringFromBuffer(hashedPasswordBuffer)

    //       if (hashedPassword === user.password) {
    //         return user
    //       } else {
    //         return null
    //       }
    //     }

    //     return null
    //   }
    // }),
    azureAd({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      authorization: { params: { scope: "openid profile user.read email" } }
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt'},
  cookies: {
    // csrfToken: {
    //   name: `next-auth.csrf-token`,
    //   options: {
    //     httpOnly: true,
    //     sameSite: 'lax',
    //     path: '/',
    //     secure: false, // Set to true in production
    //     domain: 'localhost',
    //   },
    // },
    // callbackUrl: {
    //   name: `next-auth.callback-url`,
    //   options: {
    //     httpOnly: true,
    //     sameSite: 'lax',
    //     path: '/',
    //     secure: false, // Set to true in production
    //     domain: 'localhost',
    //   },
    // },
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        domain: process.env.COOKIE_DOMAIN,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if(user){
        token.user = user;
      }
      return token;
    },
    async session({session, token}){
      if(token) session.user = token.user;
      return session;
    }
  },
})
