import Boom from '@hapi/boom'
import Hapi from '@hapi/hapi'
import Joi from '@hapi/joi'
import { TokenType, UserRole } from '@prisma/client'
import { add } from 'date-fns'
import jwt from 'jsonwebtoken'

export const API_AUTH_STATEGY = 'API'

const authPlugin: Hapi.Plugin<null> = {
  name: 'app/auth',
  dependencies: ['prisma', 'hapi-auth-jwt2', 'app/email'],
  register: async function (server: Hapi.Server) {
    // TODO: Add the authentication strategy

    if (!process.env.JWT_SECRET) {
      server.log(
        'warn',
        'The JWT_SECRET env var is not set. This is unsafe! If running in production, set it.',
      )
    }

    server.auth.strategy(API_AUTH_STATEGY, 'jwt', {
      key: JWT_SECRET,
      verifyOptions: { algorithms: [JWT_ALGORITHM] },
      validate: validateAPIToken,
    })

    server.route([
      // Login
      {
        method: 'POST',
        path: '/login',
        handler: loginHandler,
        options: {
          auth: false,
          validate: {
            payload: Joi.object({
              email: Joi.string().email().required(),
            }),
          },
        },
      },
      // Authenticate
      {
        method: 'POST',
        path: '/authenticate',
        handler: authenHandler,
        options: {
          auth: false,
          validate: {
            payload: Joi.object({
              email: Joi.string().email().required(),
              emailToken: Joi.string().required(),
            }),
          },
        },
      },
    ])
  },
}

const EMAIL_TOKEN_EXPIRATION_MINUTES = 10
interface LoginInput {
  email: string
}

async function loginHandler(request: Hapi.Request, h: Hapi.ResponseToolkit) {
  // 👇 get prisma and the sendEmailToken from shared application state
  const { prisma, sendEmailToken } = request.server.app
  // 👇 get the email from the request payload
  const { email } = request.payload as LoginInput
  // 👇 generate an alphanumeric token
  const emailToken = generateEmailToken()
  // 👇 create a date object for the email token expiration
  const tokenExpiration = add(new Date(), {
    minutes: EMAIL_TOKEN_EXPIRATION_MINUTES,
  })

  try {
    // 👇 create a short lived token and update user or create if they don't exist
    const createdToken = await prisma.token.create({
      data: {
        emailToken,
        type: TokenType.EMAIL,
        expiration: tokenExpiration,
        user: {
          connectOrCreate: {
            create: {
              email,
            },
            where: {
              email,
            },
          },
        },
      },
    })

    console.log(email, emailToken)

    // 👇 send the email token
    await sendEmailToken(email, emailToken)
    return h.response().code(200)
  } catch (error) {
    return Boom.badImplementation(error.message)
  }
}

interface AuthenticateInput {
  email: string
  emailToken: string
}

declare module '@hapi/hapi' {
  interface AuthCredentials {
    userId: number
    tokenId: number
    isAdmin: boolean
    // 👇 The courseIds that a user is a teacher of, thereby granting him permissions to change entitites
    teacherOf: number[]
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_SECRET'
const JWT_ALGORITHM = 'HS256'
const AUTHENTICATION_TOKEN_EXPIRATION_HOURS = 12

const authenHandler = async (
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) => {
  const { prisma } = request.server.app

  const { email, emailToken } = request.payload as AuthenticateInput

  try {
    const fetchEmailToken = await prisma.token.findUnique({
      where: {
        emailToken: emailToken,
      },
      include: {
        user: true,
      },
    })

    if (!fetchEmailToken?.valid) {
      return Boom.unauthorized()
    }

    if (fetchEmailToken.expiration < new Date()) {
      return Boom.unauthorized('Token exprired')
    }

    if (fetchEmailToken.user.email === email) {
      const tokenExpiration = add(new Date(), {
        hours: AUTHENTICATION_TOKEN_EXPIRATION_HOURS,
      })

      // Create token with expiration
      const createdToken = await prisma.token.create({
        data: {
          type: TokenType.API,
          expiration: tokenExpiration,
          user: {
            connect: {
              email,
            },
          },
        },
      })

      // Invalidate the email token after it's been used
      await prisma.token.update({
        where: {
          id: fetchEmailToken.id,
        },
        data: {
          valid: false,
        },
      })

      const authToken = generateAuthToken(createdToken.id)
      return h.response().code(200).header('Authorization', authToken)
    }
  } catch (error) {}
}

interface APITokenPayload {
  tokenId: number
}

const apiTokenSchema = Joi.object({
  tokenId: Joi.number().integer().required(),
})

const validateAPIToken = async (
  decoded: APITokenPayload,
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) => {
  const { prisma } = request.server.app
  const { tokenId } = decoded
  const { error } = apiTokenSchema.validate(decoded)

  if (error) {
    request.log(['error', 'auth'], `API token error: ${error.message}`)
    return { isValid: false }
  }

  try {
    const fetchedToken = await prisma.token.findUnique({
      where: {
        id: tokenId,
      },
      include: {
        user: true,
      },
    })

    // Check if token could be found in database and is valid
    if (!fetchedToken || !fetchedToken?.valid) {
      return { isValid: false, errorMessage: 'Invalid token' }
    }

    // check token expired
    if (fetchedToken.expiration < new Date()) {
      return { isValid: false, errorMessage: 'Token Expired' }
    }

    const teacherOf = await prisma.courseEnrollment.findMany({
      where: {
        userId: fetchedToken.userId,
        role: UserRole.TEACHER,
      },
      select: {
        courseId: true,
      },
    })

    return {
      isValid: true,
      credentials: {
        tokenId: decoded.tokenId,
        userId: fetchedToken.userId,
        isAdmin: fetchedToken.user.isAdmin,
        // convert teacherOf into an array of courseIds
        teacherOf: teacherOf.map(({ courseId }) => courseId),
      },
    }
  } catch (error) {
    request.log(['error', 'auth', 'db'], error)
    return { isValid: false, errorMessage: 'DB Error' }
  }
}

// Generate a random 8 digit number as the email token
const generateEmailToken = (): string => {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

// Generate a signed JWT token with the tokenId in the payload
const generateAuthToken = (tokenId: number): string => {
  const jwtPayload = { tokenId }
  return jwt.sign(jwtPayload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    noTimestamp: true,
  })
}

export default authPlugin
