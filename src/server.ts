import { ApolloServer } from 'apollo-server'
import { schema } from './schema'
import { PrismaClient } from '@prisma/client'
import { ExpressContext } from 'apollo-server-express'
import Hapi from '@hapi/hapi'
import hapiAuthJWT from 'hapi-auth-jwt2'
import authPlugin from './plugins/auth'
import coursesPlugin from './plugins/courses'
import emailPlugin from './plugins/email'
import statusPlugin from './plugins/status'
import testResultsPlugin from './plugins/test-results'
import testsPlugin from './plugins/tests'
import users from './plugins/users'
import usersEnrollmentPlugin from './plugins/users-enrollment'

const prisma = new PrismaClient()

export interface ContextFunction {
  prisma: PrismaClient
  express: ExpressContext
}

new ApolloServer({
  schema,
  context: (express): ContextFunction => ({
    prisma: prisma,
    express: express,
  }),
}).listen({ port: 4000 }, () =>
  console.log(`
🚀 Server ready at: http://localhost:4000
⭐️ See sample queries: http://pris.ly/e/ts/graphql-sdl-first#using-the-graphql-api`),
)

// async function startApolloServer() {
//   const app = express()
//   const server = new ApolloServer({
//     schema,
//     context: {context, },
//   })
//   await server.start()

//   server.applyMiddleware({ app })

//   app.use((req, res) => {
//     res.status(200)
//     res.send('Hello!')
//     res.end()
//   })
//   console.log('=======')

//   await new Promise((resolve: any) => app.listen({ port: 4000 }, resolve));
//   console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
//   return { server, app }
// }

// startApolloServer()

// const server: Hapi.Server = Hapi.server({
//   port: process.env.PORT || 3000,
//   host: process.env.HOST || 'localhost',
// })

// export async function createServer(): Promise<Hapi.Server> {
//   await server.register([
//     hapiAuthJWT,
//     authPlugin,
//     emailPlugin,
//     testResultsPlugin,
//     usersEnrollmentPlugin,
//     coursesPlugin,
//     testsPlugin,
//     statusPlugin,
//     prisma,
//     users,
//   ])
//   await server.initialize()
//   return server
// }

// export async function startServer(server: Hapi.Server): Promise<Hapi.Server> {
//   await server.start()
//   console.log(`Server running on ${server.info.uri}`)
//   return server
// }

// process.on('unhandledRejection', (err) => {
//   console.log(err)
//   process.exit(1)
// })
