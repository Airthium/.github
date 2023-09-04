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
  'typedoc-plugin-airthium'
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
}

/**
 * Update
 * @param {string} repository Repository
 * @param {?boolean} top Top level
 * @param {?boolean} tanatloc Tanatloc repository
 */
const update = (repository, top, tanatloc) => {
  console.info('Update repository:', repository)

  // Go to Repository
  process.chdir('../' + repository)

  // Check Renovate PR
  const res = myExecSync('gh pr list --app renovate')
  const number = parseInt(res)
  if (isNaN(number)) {
    console.warn('No PR to merge -> continue')

    // Version
    getVersion(repository)

    return
  }

  // Merge PR
  console.info('Merge PR', number)
  myExecSync('gh pr merge ' + number + ' --squash')

  // Check nested top level dependencies
  if (tanatloc) {
    try {
      packageUpdate(repository)
    } catch (err) {
      console.error('package update failed')
      console.error(err)
      throw err
    }
  } else if (top) {
    try {
      preUpdate()
    } catch (err) {
      console.error('preUpdate failed')
      console.error(err)
      throw err
    }
  }

  // Run hotfix script
  console.info('Run hotfix script...')
  try {
    myExecSync('./.github/hotfix.sh release')
  } catch (err) {
    console.error('Hotfix script failed')
    console.error(err)
    throw err
  }

  // New version
  getVersion(repository)
  needWait = true
}

/**
 * Package update
 * @param {?string} repository Repository
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
      if (parseInt(packageJSON.dependencies[key]) !== parseInt(newVersion))
        isUpdated = true
      packageJSON.dependencies[key] = newVersion
    }
  })

  Object.keys(devDependencies).forEach((key) => {
    if (key.includes('@airthium/')) {
      const newPackage = key.replace('@airthium/', '')
      const newVersion = newVersions[newPackage]
      if (parseInt(packageJSON.devDependencies[key]) !== parseInt(newVersion))
        packageJSON.devDependencies[key] = newVersion
      isUpdated = true
    }
  })

  // Update package.json
  if (isUpdated) {
    writeFileSync(packageJSONName, JSON.stringify(packageJSON, null, '  '))

    myExecSync('git add .')
    myExecSync('git commit -m"@airthium dependencies" --allow-empty')
  }
}

/**
 * Pre-update
 */
const preUpdate = () => {
  // Go to hotfix branch
  myExecSync('git checkout hotfix')

  // Update
  packageUpdate()

  // Go to dev
  myExecSync('git checkout dev')
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
updateSinglRepositories()
updateFirstLevelRepositories()

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

updateTopLevelRepositories()
updateTanatlocRepositories()
