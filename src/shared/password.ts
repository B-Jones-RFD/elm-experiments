/** Password hashing with scrypt from node:crypto. Stored form: `<saltHex>:<hashHex>`. */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LENGTH)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export const verifyPassword = (password: string, stored: string): boolean => {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
