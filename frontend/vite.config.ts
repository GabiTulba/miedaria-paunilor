import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/// Build-time values the site cannot be published without (the privacy
/// policy names the data controller).
const REQUIRED_BUILD_ENV = [
  'VITE_BUSINESS_LEGAL_NAME',
  'VITE_BUSINESS_TAX_ID',
  'VITE_BUSINESS_TRADE_REGISTER_NO',
]

/// The root `.env` is shared with docker-compose; Vite exposes only its
/// VITE_-prefixed entries to the client bundle. Inside the Docker build the
/// same values arrive as process env instead, which `loadEnv` also reads.
const ENV_DIR = '..'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, ENV_DIR, '')
  if (command === 'build') {
    const missing = REQUIRED_BUILD_ENV.filter(name => !env[name]?.trim())
    if (missing.length > 0) {
      throw new Error(`Missing required build environment variables: ${missing.join(', ')}`)
    }
  }
  // `MODE` in the root `.env`, or VITE_SITE_MODE as the Docker build passes it.
  const siteMode = env.VITE_SITE_MODE || env.MODE
  if (siteMode !== 'dev' && siteMode !== 'prod') {
    throw new Error(`MODE must be dev or prod, not "${siteMode ?? ''}"`)
  }
  return {
    envDir: ENV_DIR,
    plugins: [react()],
    define: { 'import.meta.env.VITE_SITE_MODE': JSON.stringify(siteMode) },
  }
})
