import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

const isRequestedUserOrAdmin = async (userId: string, isAdmin: boolean) => {}

const validateAPIToken = async (tokenId: number) => {
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
