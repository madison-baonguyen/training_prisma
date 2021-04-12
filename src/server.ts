import { PrismaClient } from '@prisma/client'
import { ApolloServer } from 'apollo-server'
import { ExpressContext } from 'apollo-server-express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from './email'
import { JWT_ALGORITHM } from './plugins/auth'
import { schema } from './schema'
import { validateAPIToken } from './utils'

interface APITokenPayload {
  tokenId: number
}

const prisma = new PrismaClient()

export interface ContextFunction {
  prisma: PrismaClient
  express: ExpressContext
}

new ApolloServer({
  schema,
  context: async (express): Promise<ContextFunction> => {
    if (express.req.url !== '/login' && express.req.url !== '/authenticate') {
      const token = express.req.headers.authorization as string
      const decoded = (await jwt.verify(token, JWT_SECRET, {
        algorithms: [JWT_ALGORITHM],
      })) as APITokenPayload
      express.req['payload'] = await validateAPIToken(decoded.tokenId)
    }

    return {
      prisma: prisma,
      express: express,
    }
  },
}).listen({ port: 4000 }, () =>
  console.log(`
🚀 Server ready at: http://localhost:4000
⭐️ See sample queries: http://pris.ly/e/ts/graphql-sdl-first#using-the-graphql-api`),
)
