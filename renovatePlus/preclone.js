'use strict'

import { execSync } from 'child_process'

const repositories = [
  'nodeEUETS',
  'deep-object-diff',
  'extract-json-from-string',
  'pg-format',
  'pg-native',
  'tanatloc-formula-validator',
  'tanatloc-template-parser',
  'typedoc-plugin-airthium',
  'tanatloc-3d',
  'airthium.com',
  'airthium.com-calculator',
  'tanatloc',
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

const clone = (repository) => {
  try {
    myExecSync(
      'git clone --recurse-submodules git@github.com:Airthium/' +
        repository +
        '.git -b dev'
    )
  } catch (err) {
    try {
      myExecSync(
        'git clone --recurse-submodules git@github.com:Airthium/' +
          repository +
          '.git'
      )
    } catch (err) {}
  }

  try {
    myExecSync('cd ' + repository + ' && git checkout dev && git pull && cd -')
  } catch (err) {
    myExecSync('cd ' + repository + ' && git pull && cd -')
  }
}

const main = () => {
  repositories.forEach((repository) => clone(repository))
}

process.chdir('../..')
main()
