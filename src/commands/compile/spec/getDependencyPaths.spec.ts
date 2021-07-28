import { Target, generateTimestamp } from '@sasjs/utils'
import path from 'path'
import { removeFromGlobalConfig } from '../../../utils/config'
import { readFile } from '@sasjs/utils'
import {
  createTestGlobalTarget,
  resetTestAppAndReuse
} from '../../../utils/test'
import {
  getDependencyPaths,
  prioritiseDependencyOverrides
} from '../../shared/dependencies'
import { APP_NAMES } from '../../../../APPS_FOR_TESTING'

describe('getDependencyPaths', () => {
  let target: Target

  beforeAll(async () => {
    const appName = `cli-tests-dependency-paths-${generateTimestamp()}`
    target = await createTestGlobalTarget(appName, '/Public/app')
    await resetTestAppAndReuse(APP_NAMES.MINIMAL_SEED_APP)
  })

  afterAll(async () => {
    await removeFromGlobalConfig(target.name)
  })

  test('it should recursively get all dependency paths', async () => {
    const fileContent = await readFile(path.join(__dirname, './example.sas'))
    const dependenciesList = [
      'mp_abort.sas',
      'mf_getuniquefileref.sas',
      'mf_getuniquelibref.sas',
      'mf_isblank.sas',
      'mf_mval.sas',
      'mf_trimstr.sas',
      'mf_getplatform.sas',
      'mf_abort.sas',
      'mfv_existfolder.sas',
      'mv_createfolder.sas'
    ]
    const dependencyPaths = await getDependencyPaths(fileContent)

    dependencyPaths.forEach((dep) => {
      expect(dependenciesList.some((x) => dep.includes(x))).toBeTruthy()
    })
  })

  test('it should get third level dependencies', async () => {
    const fileContent = await readFile(
      path.join(__dirname, './nested-deps.sas')
    )
    const dependenciesList = [
      'mf_isblank.sas',
      'mm_createwebservice.sas',
      'mm_createstp.sas',
      'mf_getuser.sas',
      'mm_createfolder.sas',
      'mm_deletestp.sas',
      'mf_nobs.sas',
      'mf_getattrn.sas',
      'mf_abort.sas',
      'mf_verifymacvars.sas',
      'mm_getdirectories.sas',
      'mm_updatestpsourcecode.sas',
      'mp_dropmembers.sas',
      'mm_getservercontexts.sas',
      'mm_getrepos.sas'
    ]

    const dependencyPaths = await getDependencyPaths(fileContent)

    dependenciesList.forEach((expectedDep) => {
      expect(
        dependencyPaths.some((dep) => dep.includes(expectedDep))
      ).toBeTruthy()
    })
  })

  test('it should throw an error when a dependency is not found', async () => {
    const missingDependencies = ['foobar.sas', 'foobar2.sas']
    const missingDependencyFile = './missing-dependency.sas'

    const fileContent = await readFile(
      path.join(__dirname, missingDependencyFile)
    )

    await expect(getDependencyPaths(fileContent)).rejects.toEqual(
      `Unable to locate dependencies: ${missingDependencies.join(', ')}`
    )
  })

  test('it should ignore non-sas dependencies', async () => {
    const fileContent = await readFile(
      path.join(__dirname, './non-sas-dependency.sas')
    )
    const dependenciesList = [
      'mp_abort.sas',
      'mf_getuniquefileref.sas',
      'mf_getuniquelibref.sas',
      'mf_isblank.sas',
      'mf_mval.sas',
      'mf_trimstr.sas',
      'mf_getplatform.sas',
      'mf_abort.sas',
      'mfv_existfolder.sas',
      'mv_createfolder.sas'
    ]

    await expect(getDependencyPaths(fileContent)).resolves.not.toThrow()

    const dependencyPaths = await getDependencyPaths(fileContent)

    dependencyPaths.forEach((dep) => {
      expect(dependenciesList.some((x) => dep.includes(x))).toBeTruthy()
    })
  })

  test('it should prioritise overridden dependencies', () => {
    const dependencyNames = ['mf_abort.sas']
    const mfAbortPath = path.join('sas', 'macros', 'mf_abort.sas')
    const dependencyPaths = [
      path.join('node_modules', '@sasjs', 'core', 'core', 'mf_abort.sas'),
      mfAbortPath
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths
    )

    expect(result).toEqual([mfAbortPath])
  })

  test('it should prioritise overridden dependencies, if both are non-core', () => {
    const dependencyNames = ['mf_abort.sas']
    const mfAbortPath = path.join('sas', 'macros', 'mf_abort.sas')
    const dependencyPaths = [
      mfAbortPath,
      path.join('sas', 'macros2', 'mf_abort.sas')
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths,
      ['macros', 'macros2']
    )

    expect(result).toEqual([mfAbortPath])
  })

  test('it should prioritise overridden dependencies with windows file paths', () => {
    const dependencyNames = ['mf_abort.sas']
    const dependencyPaths = [
      'node_modules\\@sasjs\\core\\core\\mf_abort.sas',
      'sas\\macros\\mf_abort.sas'
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths,
      [],
      '\\'
    )

    expect(result).toEqual(['sas\\macros\\mf_abort.sas'])
  })

  test('it should prioritise overridden dependencies provided specific macros', () => {
    const dependencyNames = ['mf_abort.sas']
    const mfAbortPath = path.join('sas', 'sas9macros', 'mf_abort.sas')
    const dependencyPaths = [
      path.join('node_modules', '@sasjs', 'core', 'core', 'mf_abort.sas'),
      mfAbortPath,
      path.join('sas', 'macros', 'mf_abort.sas')
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths,
      ['sas9macros']
    )

    expect(result).toEqual([mfAbortPath])
  })

  test(`it should prioritise overridden dependencies, if specific 'macroLoc' was provided, but macro at such 'macroLoc' is not present`, () => {
    const dependencyNames = ['mf_abort.sas']
    const mfAbortPath = path.join('sas', 'macros', 'mf_abort.sas')
    const dependencyPaths = [
      path.join('node_modules', '@sasjs', 'core', 'core', 'mf_abort.sas'),
      mfAbortPath
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths,
      ['sas9macros']
    )

    expect(result).toEqual([mfAbortPath])
  })

  test('it should prioritise overridden dependencies and remove extra dependencies, if specific macros were provided', () => {
    const dependencyNames = ['mf_abort.sas']
    const mfAbortPath = path.join('sas', 'sas9macros', 'mf_abort.sas')
    const dependencyPaths = [
      path.join('node_modules', '@sasjs', 'core', 'core', 'mf_abort.sas'),
      path.join('sas', 'sasviyamacros', 'mf_abort.sas'),
      mfAbortPath,
      path.join('sas', 'macros2', 'mf_abort.sas'),
      path.join('sas', 'macros', 'mf_abort.sas')
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths,
      ['sas9macros']
    )

    expect(result).toEqual([mfAbortPath])
  })

  test('it should prioritise overridden dependencies and remove duplicated dependencies, if specific macros were provided', () => {
    const dependencyNames = ['mf_abort.sas']
    const mfAbortPath = path.join('sas', 'sas9macros', 'mf_abort.sas')
    const dependencyPaths = [
      path.join('node_modules', '@sasjs', 'core', 'core', 'mf_abort.sas'),
      mfAbortPath,
      mfAbortPath,
      path.join('sas', 'macros', 'mf_abort.sas'),
      path.join('sas', 'macros', 'mf_abort.sas')
    ]

    const result = prioritiseDependencyOverrides(
      dependencyNames,
      dependencyPaths,
      ['sas9macros']
    )

    expect(result).toEqual([mfAbortPath])
  })
})
