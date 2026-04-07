import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'
import { jwtDecode } from 'jwt-decode'
import type { Role, UserRoleMap } from './roles'
import { hasMinRole } from './roles'
import type { ServerConfig, ProxyBackend } from './proxyConfig'
import { resolveProxyBackend } from './instanceRouting'

interface JwtPayload {
  username: string
  iss: string
  iat: number
  exp: number
}

declare module 'fastify' {
  interface FastifyRequest {
    jwtUser?: JwtPayload
    userRole?: Role
    proxyBackend: ProxyBackend
  }
}

const roleCache = new Map<string, { roles: UserRoleMap; time: number }>()
const ROLE_CACHE_TTL = 30_000

export async function fetchRoles (host: string, port: number): Promise<UserRoleMap> {
  const key = `${host}:${port}`
  const now = Date.now()
  const cached = roleCache.get(key)
  if (cached && now - cached.time < ROLE_CACHE_TTL) {
    return cached.roles
  }

  try {
    const res = await fetch(
      `http://${host}:${port}/server/database/item?namespace=fluidd&key=auth`
    )
    const data = await res.json() as { result?: { value?: { roles?: UserRoleMap } } }
    const roles = data.result?.value?.roles ?? {}
    roleCache.set(key, { roles, time: now })
    return roles
  } catch {
    console.warn(`[auth] Could not fetch roles from Moonraker DB at ${key}`)
    return {}
  }
}

export function invalidateRoleCache () {
  roleCache.clear()
}

function extractToken (req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)

  const url = new URL(req.url, 'http://localhost')
  return url.searchParams.get('token')
}

const STATIC_EXT = /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|webmanifest|json)(?:\?|$)/i

const PUBLIC_PATHS = [
  '/access/login',
  '/access/refresh_jwt'
]

function isPublicPath (url: string): boolean {
  return PUBLIC_PATHS.some(p => url.startsWith(p))
}

const SET_PROXY_PATH = '/__fluiddified/set-proxy-backend'

export function authHook (config: ServerConfig) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const path = req.url.split('?')[0]

    req.proxyBackend = resolveProxyBackend(req, config)

    if (path === SET_PROXY_PATH && req.method === 'POST') return
    if (path === '/health') return
    if (isPublicPath(path)) return
    if (STATIC_EXT.test(path)) return

    const token = extractToken(req)
    if (!token) {
      const accept = req.headers.accept ?? ''
      if (accept.includes('text/html')) {
        return reply.redirect('/#/login')
      }
      return reply.status(401).send({ error: 'Authentication required' })
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token)
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        return reply.status(401).send({ error: 'Token expired' })
      }
      req.jwtUser = decoded

      const b = req.proxyBackend
      const roles = await fetchRoles(b.moonrakerHost, b.moonrakerPort)
      req.userRole = roles[decoded.username] ?? 'user'
    } catch {
      return reply.status(401).send({ error: 'Invalid token' })
    }
  }
}

export function roleGuard (minRole: Role) {
  return (req: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    const currentRole = req.userRole ?? 'guest'
    if (!hasMinRole(currentRole, minRole)) {
      reply.status(403).send({ error: 'Insufficient permissions' })
      return
    }
    done()
  }
}
