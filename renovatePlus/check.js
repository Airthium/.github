'use strict'

import { execSync } from 'child_process'

const singleRepositories = ['nodeEUETS']

const firstLevelRepositories = [
  'deep-object-diff',
  'extract-json-from-string',
  'pg-format',
  'pg-native',
  'tanatloc-formula-validator',
  'tanatloc-template-parser',
  'typedoc-plugin-airthium',
  'tanatloc-3d'
]

const topLevelRepositories = [
  'airthium.com',
  'airthium.com-calculator',
  'tanatloc'
]

const tanatlocRepositories = [
  'tanatloc-docker',
  'tanatloc-electron',
  'tanatloc-electron-full'
]

/**
 * My myExecSync
 * @param {string} command Command
 */
const myExecSync = (command) => {
  try {
    return execSync(command)
  } catch (err) {
    console.error('myExecSync error')
    console.error(err.stderr.toString())
    throw err
  }
}

/**
 * Check
 * @param {string} repository Repository
 */
const check = (repository) => {
  console.info(' *** Check repository:', repository)

  // Go to Repository
  process.chdir('../' + repository)

  // Run hotfix script
  console.info(' **** Run hotfix script...')
  try {
    myExecSync('./.github/hotfix.sh')
  } catch (err) {
    console.error(' ***** Hotfix script failed')
  }
}

/**
 * Update single repositories
 */
const updateSinglRepositories = () => {
  for (const repository of singleRepositories) check(repository)
}

/**
 * Update first level repositories
 */
const updateFirstLevelRepositories = () => {
  for (const repository of firstLevelRepositories) check(repository)
}

/**
 * Update top level repositories
 */
const updateTopLevelRepositories = () => {
  for (const repository of topLevelRepositories) check(repository)
}

/**
 * Update Tanatloc repositories
 */
const updateTanatlocRepositories = () => {
  for (const repository of tanatlocRepositories) check(repository)
}

process.chdir('..')
try {
  updateSinglRepositories()
} catch (err) {
  process.exit(-1)
}
try {
  updateFirstLevelRepositories()
} catch (err) {
  process.exit(-2)
}

try {
  updateTopLevelRepositories()
} catch (err) {
  process.exit(-3)
}
try {
  updateTanatlocRepositories()
} catch (err) {
  process.exit(-4)
}
