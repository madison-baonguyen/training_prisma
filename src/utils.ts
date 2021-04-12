import { PrismaClient, UserRole } from '@prisma/client'
import { ForbiddenError } from 'apollo-server-errors'

const prisma = new PrismaClient()

export const isAdmin = async (isAdmin: boolean, express: any) => {
  if (isAdmin) {
    express.req.next
  } else {
    throw new ForbiddenError('Forbidden')
  }
}

export const isRequestedUserOrAdmin = async (id: any, express: any) => {
  const { userId, isAdmin } = express.req.payload.credentials
  console.log('=======', express.req.payload.credentials)
  console.log(id, userId)

  if (isAdmin) {
    // If the user is an admin allow
    express.req.next
  } else if (id == userId) {
    return express.req.next
  } else {
    throw new ForbiddenError('Forbidden')
  }
}

export const validateAPIToken = async (tokenId: number) => {
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
        tokenId: tokenId,
        userId: fetchedToken.userId,
        isAdmin: fetchedToken.user.isAdmin,
        // convert teacherOf into an array of courseIds
        teacherOf: teacherOf.map(({ courseId }) => courseId),
      },
    }
  } catch (error) {
    console.log(['error', 'auth', 'db'], error)
    return { isValid: false, errorMessage: 'DB Error' }
  }
}
