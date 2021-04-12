import sendgrid from '@sendgrid/mail'
import jwt from 'jsonwebtoken'

export const EMAIL_TOKEN_EXPIRATION_MINUTES = 10
export const AUTHENTICATION_TOKEN_EXPIRATION_HOURS = 12
const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_SECRET'
const JWT_ALGORITHM = 'HS256'

export const emailHandler = async (email: string, token: string) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(
      `The SENDGRID_API_KEY env var must be set, otherwise the API won't be able to send emails.`,
      `Using debug mode which logs the email tokens instead.`,
    )
    debugSendEmailToken(email, token)
  } else {
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY)
    sendEmailToken(email, token)
  }
}

const debugSendEmailToken = async (email: string, token: string) => {
  console.log(`email token for ${email}: ${token} `)
}

const sendEmailToken = async (email: string, token: string): Promise<void> => {
  console.log(
    'sendEmailToken',
    process.env.EMAIL_ADDRESS_CONFIGURED_IN_SEND_GRID,
  )

  const msg = {
    to: email,
    from: `${process.env.EMAIL_ADDRESS_CONFIGURED_IN_SEND_GRID}`,
    subject: 'Login token for the modern backend API',
    text: `The login token for the API is: ${token}`,
  }
  await sendgrid.send(msg)
}

export const generateEmailToken = (): string => {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

// Generate a signed JWT token with the tokenId in the payload
export const generateAuthToken = (tokenId: number): string => {
  const jwtPayload = { tokenId }
  return jwt.sign(jwtPayload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    noTimestamp: true,
  })
}
