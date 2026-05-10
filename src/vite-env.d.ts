/// <reference types="vite/client" />

import type { AtelierApi } from './shared/types'

declare global {
  interface Window {
    atelier: AtelierApi
  }
}
