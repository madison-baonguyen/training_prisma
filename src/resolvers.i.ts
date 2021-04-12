export interface ICreateUser {
  userId?: number
  firstName: string
  lastName: string
  email: string
  social: JSON
  isAdmin: boolean
}

export interface ICreateOrUpdateUser {
  courseId?: number
  name: string
  courseDetails: string
}

export interface IPayload {
  isValid: boolean
  credentials: {
    tokenId: number
    userId: number
    isAdmin: boolean
    teacherOf: any[]
  }
}
