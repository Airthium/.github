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
  const res = execSync('gh pr list --app renovate')
  const number = parseInt(res)
  if (isNaN(number)) {
    console.warn('No PR to merge -> continue')

    // Version
    getVersion(repository)

    return
  }

  // Merge PR
  console.info('Merge PR', number)
  execSync('gh pr merge ' + number + ' --squash')

  // Check nested top level dependencies
  if (tanatloc) {
    try {
      packageUpdate(repository)
    } catch (err) {
      console.error(err)
    }
  } else if (top) {
    try {
      preUpdate()
    } catch (err) {
      console.error(err)
    }
  }

  // Run hotfix script
  console.info('Run hotfix script...')
  try {
    execSync('./.github/hotfix.sh release')
  } catch (err) {
    console.error('Hotfix script failed')
    console.error(err)
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

    execSync('git add .')
    execSync('git commit -m"@airthium dependencies" --allow-empty')
    execSync('git push')
  }
}

/**
 * Pre-update
 */
const preUpdate = () => {
  // Go to hotfix branch
  execSync('git checkout hotfix')
  execSync('git pull')

  // Update
  packageUpdate()

  // Go to dev
  execSync('git checkout dev')
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
  console.info('Wait for NPM publish (2 minutes)')
  await new Promise((resolve) => setTimeout(resolve, 120_000))
}

updateTopLevelRepositories()
updateTanatlocRepositories()
