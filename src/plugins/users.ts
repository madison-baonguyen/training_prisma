import Hapi from '@hapi/hapi'
import Joi, { object } from '@hapi/joi'
import Boom from '@hapi/boom'
import { isRequestedUserOrAdmin, isAdmin } from '../auth-helpers'
import { API_AUTH_STATEGY } from './auth'

interface UserInput {
  firstName: string
  lastName: string
  email: string
  social: {
    facebook?: string
    twitter?: string
    github?: string
    website?: string
  }
}

const userInputValidator = Joi.object({
  firstName: Joi.string().alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.optional(),
  }),
  lastName: Joi.string().alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.optional(),
  }),
  email: Joi.string()
    .email()
    .alter({
      create: (schema) => schema.required(),
      update: (schema) => schema.optional(),
    }),
  social: Joi.object({
    facebook: Joi.string().optional(),
    twitter: Joi.string().optional(),
    github: Joi.string().optional(),
    website: Joi.string().optional(),
  }).optional(),
})

const updateUserValidator = userInputValidator.tailor('update')
const createUserValidator = userInputValidator.tailor('create')

// plugin to instantiate Prisma Client
const usersPlugin = {
  name: 'app/users',
  dependencies: ['prisma'],
  register: async function (server: Hapi.Server) {
    // here you can use server.app.prisma
    server.route([
      {
        method: 'GET',
        path: '/profile',
        handler: getAuthenticatedUser,
        options: {
          auth: {
            mode: 'required',
            strategy: API_AUTH_STATEGY,
          },
        },
      },
      {
        method: 'GET',
        path: '/users',
        handler: getUsersHandler,
        options: {
          pre: [isAdmin],
          auth: {
            mode: 'required',
            strategy: API_AUTH_STATEGY,
          },
          validate: {
            failAction: (request, h, err) => {
              // show validation errors to user https://github.com/hapijs/hapi/issues/3706
              throw err
            },
          },
        },
      },
      {
        method: 'POST',
        path: '/users',
        handler: createUserHandler,
        options: {
          pre: [isAdmin],
          auth: {
            mode: 'required',
            strategy: API_AUTH_STATEGY,
          },
          validate: {
            payload: createUserValidator,
            failAction: (request, h, err) => {
              // show validation errors to user https://github.com/hapijs/hapi/issues/3706
              throw err
            },
          },
        },
      },
      {
        method: 'PUT',
        path: '/users/{userId}',
        handler: updateUserHandler,
        options: {
          pre: [isRequestedUserOrAdmin],
          auth: {
            mode: 'required',
            strategy: API_AUTH_STATEGY,
          },
          validate: {
            params: Joi.object({
              userId: Joi.number().integer(),
            }),
            payload: updateUserValidator,
            failAction: (request, h, err) => {
              // show validation errors to user https://github.com/hapijs/hapi/issues/3706
              throw err
            },
          },
        },
      },
      {
        method: 'GET',
        path: '/users/{userId}',
        handler: getUserHandler,
        options: {
          pre: [isRequestedUserOrAdmin],
          auth: {
            mode: 'required',
            strategy: API_AUTH_STATEGY,
          },
          validate: {
            params: Joi.object({
              userId: Joi.number().integer(),
            }),
          },
        },
      },
      {
        method: 'DELETE',
        path: '/users/{userId}',
        handler: deleteUserHandler,
        options: {
          pre: [isRequestedUserOrAdmin],
          auth: {
            mode: 'required',
            strategy: API_AUTH_STATEGY,
          },
          validate: {
            params: Joi.object({
              userId: Joi.number().integer(),
            }),
            failAction: (request, h, err) => {
              // show validation errors to user https://github.com/hapijs/hapi/issues/3706
              throw err
            },
          },
        },
      },
    ])
  },
}

async function createUserHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) {
  const { prisma } = request.server.app
  const payload = request.payload as UserInput
  try {
    const createdUser = await prisma.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        social: JSON.stringify(payload.social),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        social: true,
      },
    })
    return h.response(createdUser).code(201)
  } catch (err) {
    console.log(err)
    return Boom.badImplementation('failed to create user')
  }
}

async function updateUserHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) {
  const { prisma } = request.server.app
  const userId = parseInt(request.params.userId, 10)
  const payload = request.payload as Partial<UserInput>
  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: payload,
    })
    return h.response(updatedUser).code(200)
  } catch (err) {
    console.log(err)
    return h.response().code(500)
  }
}

async function getUserHandler(request: Hapi.Request, h: Hapi.ResponseToolkit) {
  const { prisma } = request.server.app
  const userId = parseInt(request.params.userId, 10)
  try {
    const user = await prisma.user.findUnique({
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
      return h.response().code(404)
    } else {
      return h.response(user).code(200)
    }
  } catch (err) {
    console.log(err)
    return Boom.badImplementation('failed to get user')
  }
}

const getUsersHandler = async (
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) => {
  const { prisma } = request.server.app
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        social: true,
      },
    })
    return h.response(users).code(200)
  } catch (error) {
    console.log(error)
    return Boom.badImplementation()
  }
}

async function deleteUserHandler(
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) {
  const { prisma } = request.server.app
  const userId = parseInt(request.params.userId, 10)
  try {
    await prisma.$transaction([
      prisma.token.deleteMany({
        where: {
          userId: userId,
        },
      }),
      prisma.user.delete({
        where: {
          id: userId,
        },
      }),
    ])
    return h.response().code(204)
  } catch (err) {
    console.log(err)
    return h.response().code(500)
  }
}

const getAuthenticatedUser = async (
  request: Hapi.Request,
  h: Hapi.ResponseToolkit,
) => {
  const { prisma } = request.server.app
  const { userId } = request.auth.credentials

  try {
    const user = await prisma.user.findUnique({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        social: true,
      },
      where: {
        id: userId,
      },
    })
    return h.response(user || undefined).code(200)
  } catch (err) {
    request.log('error', err)
    return Boom.badImplementation()
  }
}

export default usersPlugin
