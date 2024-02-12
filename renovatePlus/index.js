'use strict'

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

let needWait = false
const newVersions = {}

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
 * Get version
 * @param {string} repository Repository
 */
const getVersion = (repository) => {
  const content = readFileSync(
    repository === 'tanatloc-docker' ? 'docker/package.json' : 'package.json'
  )
  const packageJSON = JSON.parse(content)

  newVersions[repository] = packageJSON.version
  console.info('    -> Version ' + packageJSON.version)
}

/**
 * Update
 * @param {string} repository Repository
 * @param {?boolean} top Top level
 * @param {?boolean} tanatloc Tanatloc repository
 */
const update = (repository, top, tanatloc) => {
  let isUpdated = false
  console.info(' *** Update repository:', repository)

  // Go to Repository
  process.chdir('../' + repository)

  // Check Renovate PR
  const res = myExecSync('gh pr list --app renovate')
  const number = parseInt(res)
  if (isNaN(number)) {
    console.warn(' **** No PR to merge -> continue')

    // Version
    getVersion(repository)

    if (!top && !tanatloc) return
  } else {
    // Merge PR
    console.info(' **** Merge PR', number)
    myExecSync('gh pr merge ' + number + ' --squash --delete-branch')
    isUpdated = true
  }

  // Check nested top level dependencies
  if (tanatloc) {
    console.info('Update @airthium dependencies')
    try {
      isUpdated = packageUpdate(repository)
    } catch (err) {
      console.error(' ***** package update failed')
      console.error(err)
      throw err
    }
  } else if (top) {
    try {
      isUpdated = preUpdate()
    } catch (err) {
      console.error(' ***** preUpdate failed')
      console.error(err)
      throw err
    }
  }

  // Run hotfix script
  if (isUpdated) {
    console.info(' **** Run hotfix script...')
    try {
      myExecSync('./.github/hotfix.sh release')
    } catch (err) {
      console.error(' ***** Hotfix script failed')
      throw err
    }
  }

  // New version
  getVersion(repository)
  needWait = true
}

/**
 * Package update
 * @param {?string} repository Repository
 * @returns {boolean} Is updated
 */
const packageUpdate = (repository) => {
  myExecSync('git pull')

  let isUpdated = false

  const packageJSONName =
    repository === 'tanatloc-docker' ? 'docker/package.json' : 'package.json'

  // Check package.json
  const content = readFileSync(packageJSONName)
  const packageJSON = JSON.parse(content)

  const dependencies = packageJSON.dependencies ?? {}
  const devDependencies = packageJSON.devDependencies ?? {}

  Object.keys(dependencies).forEach((key) => {
    if (key.includes('@airthium/')) {
      const newPackage = key.replace('@airthium/', '')
      const newVersion = newVersions[newPackage]
      if (packageJSON.dependencies[key] !== newVersion) {
        isUpdated = true
        packageJSON.dependencies[key] = newVersion
      }
    }
  })

  Object.keys(devDependencies).forEach((key) => {
    if (key.includes('@airthium/')) {
      const newPackage = key.replace('@airthium/', '')
      const newVersion = newVersions[newPackage]
      if (packageJSON.devDependencies[key] !== newVersion) {
        isUpdated = true
        packageJSON.devDependencies[key] = newVersion
      }
    }
  })

  // Update package.json
  if (isUpdated) {
    writeFileSync(packageJSONName, JSON.stringify(packageJSON, null, '  '))

    myExecSync('git add .')
    myExecSync('git commit -m"@airthium dependencies" --allow-empty')
  }

  return isUpdated
}

/**
 * Pre-update
 * @returns {boolean} Is updated
 */
const preUpdate = () => {
  // Go to hotfix branch
  myExecSync('git checkout hotfix')

  // Update
  const isUpdated = packageUpdate()

  // Go to dev
  myExecSync('git checkout dev')

  return isUpdated
}

/**
 * Update single repositories
 */
const updateSinglRepositories = () => {
  for (const repository of singleRepositories) update(repository)
}

/**
 * Update first level repositories
 */
const updateFirstLevelRepositories = () => {
  for (const repository of firstLevelRepositories) update(repository)
}

/**
 * Update top level repositories
 */
const updateTopLevelRepositories = () => {
  for (const repository of topLevelRepositories) update(repository, true)
}

/**
 * Update Tanatloc repositories
 */
const updateTanatlocRepositories = () => {
  for (const repository of tanatlocRepositories) update(repository, true, true)
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

if (needWait) {
  console.info('')
  console.info('*** Wait for NPM publish (2 minutes)... ***')
  console.info('')
  await new Promise((resolve) => setTimeout(resolve, 60_000))
  console.info('')
  console.info('*** Wait for NPM publish (1 minutes) ***')
  console.info('')
  await new Promise((resolve) => setTimeout(resolve, 60_000))
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
