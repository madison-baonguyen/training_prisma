export interface ICreateUser {
  userId?: number
  firstName: string
  lastName: string
  email: string
  social: JSON
}

export interface ICreateOrUpdateUser {
  courseId?: number
  name: string
  courseDetails: string
}
