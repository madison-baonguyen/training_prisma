import {
  gql,
  makeExecutableSchema,
  UserInputError,
  AuthenticationError,
} from 'apollo-server'
import { add } from 'date-fns'
import { GraphQLDateTime } from 'graphql-iso-date'
import GraphQLJSON from 'graphql-type-json'
import {
  AUTHENTICATION_TOKEN_EXPIRATION_HOURS,
  emailHandler,
  EMAIL_TOKEN_EXPIRATION_MINUTES,
  generateAuthToken,
  generateEmailToken,
} from './email'
import { ICreateOrUpdateUser, ICreateUser } from './resolvers.i'
import { ContextFunction } from './server'
import { TokenType } from '@prisma/client'

const typeDefs = gql`
  "Query"
  type Query {
    "query for user"
    users: [User]
    user(userId: Int!): User

    "query for courses"
    courses: [Course]
    course(courseId: Int!): Course
  }

  type Mutation {
    login(email: String!): String
    authenticate(email: String!, emailToken: String!): String
    createOrUpdateUser(data: UserInput!): User
    deleteUser(userId: Int!): User
    createOrUpdateCourse(data: CourseInput!): Course
    deleteCourse(courseId: Int!): Course
    DateTime: DateTime
    JSON: JSON
  }

  input UserInput {
    userId: Int
    firstName: String!
    lastName: String!
    email: String!
    social: JSON
  }

  input CourseInput {
    courseId: Int
    name: String!
    coursesDetails: String!
  }

  "Type model"
  type User {
    id: ID!
    email: String
    firstName: String
    lastName: String
    social: JSON
    isAdmin: Boolean
    "get courses of user"
    courses: [CourseEnrollment]
    "get courses of user is student"
    testResults: [TestResult]
    "get courses of user is teacher"
    testsGraded: [TestResult]
    "get token for authentication"
    tokens: [Token]
    "get feedback"
    feedback: [CourseFeedback]
  }

  type Token {
    id: ID!
    createAt: DateTime!
    updatedAt: DateTime!
    type: TokenType!
    emailToken: String
    valid: Boolean!
    expiration: DateTime!
    userId: Int!
    user: User!
  }

  type Course {
    id: ID!
    name: String!
    courseDetails: String
    members: [CourseEnrollment]!
    tests: [Test]!
    feedback: [CourseFeedback]
  }

  type CourseFeedback {
    id: ID!
    feedback: String
    studentId: Int!
    courseId: Int!
    student: User!
    course: Course!
  }

  type Test {
    id: ID!
    updatedAt: DateTime!
    name: String!
    date: DateTime!
    testResults: [TestResult]!
    courseId: Int!
    course: Course
  }

  type TestResult {
    id: ID!
    createdAt: DateTime!
    result: Int!
    testId: Int!
    test: Test
    studentId: Int!
    student: User
    graderId: Int!
    gradedBy: User!
  }

  type CourseEnrollment {
    createdAt: DateTime!
    role: UserRole!
    userId: Int!
    user: User!
    courseId: Int!
    course: Course
  }

  enum UserRole {
    STUDENT
    TEACHER
  }

  enum TokenType {
    EMAIL
    API
  }

  scalar DateTime
  scalar JSON
`

const resolvers = {
  Query: {
    users: async (_parent: any, _args: any, context: ContextFunction) => {
      return await context.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          social: true,
        },
      })
    },

    user: async (_parent: any, { userId }: any, context: ContextFunction) => {
      const user = await context.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          social: true,
        },
      })

      if (!user) {
        throw new UserInputError('Invalid argument value', {
          argumentName: 'userId',
        })
      } else {
        return user
      }
    },

    courses: async (_parent: any, arg: any, context: ContextFunction) => {
      return await context.prisma.course.findMany({
        include: {
          tests: true,
        },
      })
    },
    course: async (
      _parent: any,
      arg: { courseId: number },
      context: ContextFunction,
    ) => {
      return await context.prisma.course.findUnique({
        where: {
          id: arg.courseId,
        },
        include: {
          tests: true,
        },
      })
    },
  },
  Mutation: {
    login: async (
      _parent: any,
      arg: { email: string },
      context: ContextFunction,
    ) => {
      const emailToken = generateEmailToken()

      // add expiration token
      const tokenExpiration = add(new Date(), {
        minutes: EMAIL_TOKEN_EXPIRATION_MINUTES,
      })

      await context.prisma.token.create({
        data: {
          emailToken,
          type: TokenType.EMAIL,
          expiration: tokenExpiration,
          user: {
            connectOrCreate: {
              create: {
                email: arg.email,
              },
              where: {
                email: arg.email,
              },
            },
          },
        },
      })

      // 👇 send the email token
      await emailHandler(arg.email, emailToken)
    },
    authenticate: async (
      _parent: any,
      arg: { email: string; emailToken: string },
      context: ContextFunction,
    ) => {
      console.log(generateAuthToken(3))
      const fetchEmailToken = await context.prisma.token.findUnique({
        where: {
          emailToken: arg.emailToken,
        },
        include: {
          user: true,
        },
      })

      if (!fetchEmailToken?.valid) {
        throw new AuthenticationError('Invalid token')
      }

      if (fetchEmailToken.expiration < new Date()) {
        throw new AuthenticationError('Token expired')
      }

      if (fetchEmailToken.user.email === arg.email) {
        const tokenExpiration = add(new Date(), {
          hours: AUTHENTICATION_TOKEN_EXPIRATION_HOURS,
        })
        // Create token with expirations
        const createdToken = await context.prisma.token.create({
          data: {
            type: TokenType.API,
            expiration: tokenExpiration,
            user: {
              connect: {
                email: arg.email,
              },
            },
          },
        })

        // Invalidate the email token after it's been used
        await context.prisma.token.update({
          where: {
            id: fetchEmailToken.id,
          },
          data: {
            valid: false,
          },
        })

        // generate auth token
        const authToken = generateAuthToken(createdToken.id)
        return context.express.res
          .status(200)
          .setHeader('Authorization', authToken)
      }
    },

    createOrUpdateUser: async (
      _parent: any,
      arg: { data: ICreateUser },
      context: ContextFunction,
    ) => {
      const data = arg.data
      if (!data.userId) {
        return await context.prisma.user.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            social: JSON.stringify(data.social),
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            social: true,
          },
        })
      } else {
        return await context.prisma.user.update({
          where: {
            id: data.userId,
          },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            social: JSON.stringify(data.social),
          },
        })
      }
    },
    deleteUser: async (
      _parent: any,
      arg: { userId: number },
      context: ContextFunction,
    ) => {
      console.log(arg.userId)

      const user = await context.prisma.$transaction([
        context.prisma.token.deleteMany({
          where: {
            userId: arg.userId,
          },
        }),
        context.prisma.user.delete({
          where: {
            id: arg.userId,
          },
        }),
      ])
      console.log('==========', { user })
      return user[1]
    },
    createOrUpdateCourse: async (
      _parent: any,
      arg: { data: ICreateOrUpdateUser },
      context: ContextFunction,
    ) => {
      const userId = 1
      if (!arg.data.courseId) {
        return await context.prisma.course.create({
          data: {
            name: arg.data.name,
            courseDetails: arg.data.courseDetails,
            members: {
              create: {
                role: 'TEACHER',
                user: {
                  connect: {
                    id: userId,
                  },
                },
              },
            },
          },
        })
      } else {
        return await context.prisma.course.update({
          where: {
            id: arg.data.courseId,
          },
          data: {
            name: arg.data.name,
            courseDetails: arg.data.courseDetails,
          },
        })
      }
    },
    deleteCourse: async (
      _parent: any,
      arg: { userId: number },
      context: ContextFunction,
    ) => {
      return await context.prisma.$transaction([
        context.prisma.token.deleteMany({
          where: {
            userId: arg.userId,
          },
        }),
        context.prisma.user.delete({
          where: {
            id: arg.userId,
          },
        }),
      ])
    },
    DateTime: GraphQLDateTime,
    JSON: GraphQLJSON,
  },
}

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})
