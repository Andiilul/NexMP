import { randomUUID } from 'crypto'
import { protocol } from 'electron'

const scheme = 'nexmp-media'
const mediaPaths = new Map<string, string>()

export function registerMediaProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true
      }
    }
  ])
}

export function registerMediaProtocol(): void {
  if (protocol.isProtocolHandled(scheme)) return

  protocol.registerFileProtocol(scheme, (request, callback) => {
    const requestUrl = new URL(request.url)
    const mediaId = requestUrl.pathname.replace(/^\//, '')
    const filePath = mediaPaths.get(mediaId)

    if (!filePath) {
      callback({ error: -6 })
      return
    }

    callback({ path: filePath })
  })
}

export function createMediaProtocolUrl(filePath: string): string {
  const id = randomUUID()

  mediaPaths.set(id, filePath)

  return `${scheme}://video/${id}`
}
