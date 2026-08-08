#!/usr/bin/env node
import { existsSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)

function printHelp() {
  console.log(`NexMP CLI

Usage:
  nexmp reset db          Reset the development database
  nexmp reset db --prod   Reset the installed app database
  nexmp help              Show this help
`)
}

function getDatabaseDirectory(isProd) {
  if (!isProd) return join(process.cwd(), '.nexmp-dev', 'data')

  if (!process.env.APPDATA) {
    throw new Error('APPDATA is not available, so the production database path cannot be resolved.')
  }

  return join(process.env.APPDATA, 'NexMP', 'data')
}

function deleteDatabaseFile(target, dataDirectory) {
  const resolvedDataDirectory = resolve(dataDirectory)
  const resolvedTarget = resolve(target)
  const isInsideDatabaseDirectory = resolvedTarget.startsWith(`${resolvedDataDirectory}\\`)

  if (!isInsideDatabaseDirectory) {
    throw new Error(`Refusing to delete outside database directory: ${resolvedTarget}`)
  }

  if (!existsSync(resolvedTarget)) return false

  unlinkSync(resolvedTarget)
  console.log(`Deleted ${resolvedTarget}`)
  return true
}

function resetDatabase() {
  const isProd = args.includes('--prod')
  const dataDirectory = getDatabaseDirectory(isProd)
  const targets = ['nexmp.db', 'nexmp.db-wal', 'nexmp.db-shm'].map((fileName) =>
    join(dataDirectory, fileName)
  )

  const deletedCount = targets.reduce(
    (count, target) => count + (deleteDatabaseFile(target, dataDirectory) ? 1 : 0),
    0
  )

  if (deletedCount === 0) {
    console.log(`No database files found in ${resolve(dataDirectory)}`)
    return
  }

  console.log(
    `Reset ${isProd ? 'production' : 'development'} database. NexMP will recreate it on next start.`
  )
}

try {
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printHelp()
    process.exit(0)
  }

  if (args[0] === 'reset' && args[1] === 'db') {
    resetDatabase()
    process.exit(0)
  }

  console.error(`Unknown command: ${args.join(' ')}`)
  printHelp()
  process.exit(1)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Command failed.')
  process.exit(1)
}
