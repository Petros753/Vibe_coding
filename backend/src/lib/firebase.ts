import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('../../firebase-service-account.json')

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) })
}

export const firebaseAuth = getAuth()
