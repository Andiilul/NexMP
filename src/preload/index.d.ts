import type { NexmpApi } from '../shared/types/media'

declare global {
  interface Window {
    api: NexmpApi
  }
}
