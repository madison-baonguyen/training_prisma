// import { ApolloServer } from 'apollo-server'
// import { schema } from './schema'
// import { context } from './context'
import Hapi from '@hapi/hapi'
import hapiAuthJWT from 'hapi-auth-jwt2'
import authPlugin from './plugins/auth'
import coursesPlugin from './plugins/courses'
import emailPlugin from './plugins/email'
import prisma from './plugins/prisma'
import statusPlugin from './plugins/status'
import testResultsPlugin from './plugins/test-results'
import testsPlugin from './plugins/tests'
import users from './plugins/users'
import usersEnrollmentPlugin from './plugins/users-enrollment'

// new ApolloServer({ schema, context: context }).listen({ port: 4000 }, () =>
//   console.log(`
// 🚀 Server ready at: http://localhost:4000
// ⭐️ See sample queries: http://pris.ly/e/ts/graphql-sdl-first#using-the-graphql-api`),
// )

const server: Hapi.Server = Hapi.server({
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
})

export async function createServer(): Promise<Hapi.Server> {
  await server.register([
    hapiAuthJWT,
    authPlugin,
    emailPlugin,
    testResultsPlugin,
    usersEnrollmentPlugin,
    coursesPlugin,
    testsPlugin,
    statusPlugin,
    prisma,
    users,
  ])
  await server.initialize()
  return server
}

export async function startServer(server: Hapi.Server): Promise<Hapi.Server> {
  await server.start()
  console.log(`Server running on ${server.info.uri}`)
  return server
}

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})
