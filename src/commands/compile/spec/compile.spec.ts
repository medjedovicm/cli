import path from 'path'
import {
  Target,
  createFolder,
  readFile,
  fileExists,
  deleteFolder,
  generateTimestamp
} from '@sasjs/utils'
import { BuildConfig } from '@sasjs/utils/types/config'
import {
  findTargetInConfiguration,
  saveGlobalRcFile
} from '../../../utils/config'
import {
  createTestApp,
  createTestJobsApp,
  removeTestApp,
  removeAllTargetsFromConfigs,
  verifyCompiledService,
  updateConfig,
  updateTarget
} from '../../../utils/test'
import { Command } from '../../../utils/command'
import * as compileModule from '../compile'
import { compileSingleFile } from '../compileSingleFile'
import * as compileJobFile from '../internal/compileJobFile'
import * as compileServiceFile from '../internal/compileServiceFile'

describe('sasjs compile', () => {
  let sharedAppName: string
  let appName: string
  let target: Target
  let parentOutputFolder: string
  const homedir = require('os').homedir()

  beforeAll(async () => {
    sharedAppName = `cli-tests-compile-${generateTimestamp()}`
    await createTestApp(homedir, sharedAppName)
  })
  beforeEach(async () => {
    appName = `cli-tests-compile-${generateTimestamp()}`
    await createTestApp(__dirname, appName)
    target = (await findTargetInConfiguration('viya')).target
    jest.spyOn(compileModule, 'copyFilesToBuildFolder')
    jest.spyOn(compileModule, 'compileJobsServicesTests')
  })

  afterEach(async () => {
    await removeTestApp(__dirname, appName)
    jest.clearAllMocks()
  })

  it('should compile an uncompiled project', async () => {
    await expect(compileModule.compile(target)).toResolve()
    expect(compileModule.copyFilesToBuildFolder).toHaveBeenCalled()
    expect(compileModule.compileJobsServicesTests).toHaveBeenCalled()
  })

  it('should compile an uncompiled project with absolute macroPaths', async () => {
    const absolutePathToSharedApp = path.join(homedir, sharedAppName)
    await updateConfig(
      {
        macroFolders: [`${absolutePathToSharedApp}/sasjs/macros`]
      },
      true
    )
    await updateTarget(
      {
        macroFolders: [`${absolutePathToSharedApp}/sasjs/targets/viya/macros`]
      },
      'viya',
      true
    )
    await expect(compileModule.compile(target)).toResolve()
    expect(compileModule.copyFilesToBuildFolder).toHaveBeenCalled()
    expect(compileModule.compileJobsServicesTests).toHaveBeenCalled()
  })

  it('should compile an uncompiled project having no target', async () => {
    await removeAllTargetsFromConfigs()

    await expect(compileModule.compile({} as Target)).toResolve()
    expect(compileModule.copyFilesToBuildFolder).toHaveBeenCalled()
    expect(compileModule.compileJobsServicesTests).toHaveBeenCalled()
  })

  it('should fail to compile for missing program file', async () => {
    let newTarget = {
      ...target,
      serviceConfig: {
        serviceFolders: ['../services']
      }
    } as Target

    const errorMessage =
      'The following files were listed under SAS Programs but could not be found:\n' +
      "1. 'doesnotexist.sas' with fileRef 'SOMEREF'\n" +
      'Please check that they exist in the folder(s) listed in the `programFolders` array in your sasjsconfig.json file.\n' +
      'Program Folders:\n' +
      `- ${path.join(__dirname, appName, 'sasjs/programs')}`
    await expect(compileModule.compile(newTarget)).rejects.toThrow(errorMessage)
    expect(compileModule.copyFilesToBuildFolder).toHaveBeenCalled()
    expect(compileModule.compileJobsServicesTests).toHaveBeenCalled()
  })

  it('should skip compilation if a project is already compiled', async () => {
    await expect(compileModule.compile(target)).toResolve()
    expect(compileModule.copyFilesToBuildFolder).toHaveBeenCalled()
    expect(compileModule.compileJobsServicesTests).toHaveBeenCalled()

    jest.resetAllMocks()

    await compileModule.compile(target)
    expect(compileModule.copyFilesToBuildFolder).not.toHaveBeenCalled()
    expect(compileModule.compileJobsServicesTests).not.toHaveBeenCalled()
  })
})

describe('sasjs compile single file', () => {
  let appName: string
  let target: Target

  afterEach(async () => {
    await removeTestApp(__dirname, appName)
    jest.clearAllMocks()
  })

  describe('job', () => {
    beforeEach(async () => {
      appName = `cli-tests-compile-${generateTimestamp()}`
      await createTestJobsApp(__dirname, appName)
      target = (await findTargetInConfiguration('viya')).target
      jest.spyOn(compileJobFile, 'compileJobFile')
    })

    it('should compile single file', async () => {
      await expect(
        compileSingleFile(
          target,
          new Command(`compile job -s ./jobs/extract/makedata1.sas`),
          'job'
        )
      ).toResolve()
      expect(compileJobFile.compileJobFile).toHaveBeenCalled()
    })

    it('should compile single file with absolute path', async () => {
      await expect(
        compileSingleFile(
          target,
          new Command(
            `compile job -s ${process.projectDir}/jobs/extract/makedata1.sas`
          ),
          'job'
        )
      ).toResolve()
      expect(compileJobFile.compileJobFile).toHaveBeenCalled()
    })
  })

  describe('service', () => {
    beforeEach(async () => {
      appName = `cli-tests-compile-${generateTimestamp()}`
      await createTestApp(__dirname, appName)
      target = (await findTargetInConfiguration('viya')).target
      jest.spyOn(compileServiceFile, 'compileServiceFile')
    })

    it('should compile single file', async () => {
      await expect(
        compileSingleFile(
          target,
          new Command(`compile service -s sasjs/services/common/example.sas`),
          'service'
        )
      ).toResolve()
      expect(compileServiceFile.compileServiceFile).toHaveBeenCalled()
    })
    it('should compile single file with absolute path', async () => {
      await expect(
        compileSingleFile(
          target,
          new Command(
            `compile service -s ${process.projectDir}/sasjs/services/common/example.sas`
          ),
          'service'
        )
      ).toResolve()
      expect(compileServiceFile.compileServiceFile).toHaveBeenCalled()
    })
  })
})

const defaultBuildConfig: BuildConfig = {
  buildOutputFolder: '.sasjs/sasjsbuild',
  buildOutputFileName: 'test.sas',
  initProgram: '',
  termProgram: '',
  macroVars: {}
}

describe('sasjs compile outside project', () => {
  let sharedAppName: string
  let appName: string
  let parentOutputFolder: string
  const homedir = require('os').homedir()

  describe('with global config', () => {
    beforeAll(async () => {
      sharedAppName = `cli-tests-compile-${generateTimestamp()}`
      await createTestApp(homedir, sharedAppName)
    })

    beforeEach(async () => {
      appName = `cli-tests-compile-${generateTimestamp()}`
      await updateConfig(
        {
          macroFolders: [
            `./${sharedAppName}/sasjs/macros`,
            `./${sharedAppName}/sasjs/targets/viya/macros`
          ]
        },
        false
      )
      process.projectDir = ''
      process.currentDir = path.join(__dirname, appName)
      await createFolder(process.currentDir)
    })

    afterEach(async () => {
      await updateConfig(
        {
          macroFolders: [],
          buildConfig: defaultBuildConfig
        },
        false
      )
      await deleteFolder(parentOutputFolder)
      await deleteFolder(process.currentDir)
    })

    afterAll(async () => {
      await removeTestApp(homedir, sharedAppName)
      await deleteFolder(path.join(homedir, '.sasjs'))
    })

    it('should compile single file', async () => {
      const buildOutputFolder = path.join(homedir, '.sasjs', 'sasjsbuild')
      const destinationPath = path.join(
        buildOutputFolder,
        'services',
        'services',
        'example1.sas'
      )

      parentOutputFolder = buildOutputFolder

      await expect(
        compileSingleFile(
          undefined as unknown as Target,
          new Command(`compile service -s ../services/example1.sas`),
          'service'
        )
      ).resolves.toEqual({
        destinationPath
      })

      await expect(fileExists(destinationPath)).resolves.toEqual(true)

      const compiledContent = await readFile(destinationPath)

      const macrosToTest: string[] = [
        'mf_nobs',
        'examplemacro',
        'yetanothermacro'
      ]

      await verifyCompiledService(compiledContent, macrosToTest, false, false)
    })

    it('should compile single file with absolute macroFolder paths', async () => {
      const buildOutputFolder = path.join(homedir, '.sasjs', 'sasjsbuild')
      const destinationPath = path.join(
        buildOutputFolder,
        'services',
        'services',
        'example1.sas'
      )
      const absolutePathToSharedApp = path.join(homedir, sharedAppName)

      parentOutputFolder = buildOutputFolder

      await updateConfig(
        {
          macroFolders: [
            `${absolutePathToSharedApp}/sasjs/macros`,
            `${absolutePathToSharedApp}/sasjs/targets/viya/macros`
          ]
        },
        false
      )
      await expect(
        compileSingleFile(
          undefined as unknown as Target,
          new Command(`compile service -s ../services/example1.sas`),
          'service'
        )
      ).resolves.toEqual({
        destinationPath
      })

      await expect(fileExists(destinationPath)).resolves.toEqual(true)

      const compiledContent = await readFile(destinationPath)

      const macrosToTest: string[] = [
        'mf_nobs',
        'examplemacro',
        'yetanothermacro'
      ]

      await verifyCompiledService(compiledContent, macrosToTest, false, false)
    })

    it('should fail to compile single file', async () => {
      const buildOutputFolder = path.join(homedir, '.sasjs', 'sasjsbuild')
      parentOutputFolder = buildOutputFolder
      const dependencies = ['examplemacro.sas', 'yetanothermacro.sas']
      await updateConfig(
        {
          macroFolders: []
        },
        false
      )
      await expect(
        compileSingleFile(
          undefined as unknown as Target,
          new Command(`compile service -s ../services/example1.sas`),
          'service'
        )
      ).rejects.toEqual(
        `Unable to locate dependencies: ${dependencies.join(', ')}`
      )
    })

    it('should compile single file at absolute path in global config.buildConfig.buildOutputFolder', async () => {
      const buildOutputFolder = path.join(__dirname, 'random-folder', appName)
      const destinationPath = path.join(
        buildOutputFolder,
        'services',
        'services',
        'example1.sas'
      )

      parentOutputFolder = path.join(__dirname, 'random-folder')

      await updateConfig(
        {
          buildConfig: {
            ...defaultBuildConfig,
            buildOutputFolder
          }
        },
        false
      )
      await expect(
        compileSingleFile(
          undefined as unknown as Target,
          new Command(`compile service -s ../services/example1.sas`),
          'service'
        )
      ).resolves.toEqual({
        destinationPath
      })

      await expect(fileExists(destinationPath)).resolves.toEqual(true)

      const compiledContent = await readFile(destinationPath)

      const macrosToTest: string[] = [
        'mf_nobs',
        'examplemacro',
        'yetanothermacro'
      ]

      await verifyCompiledService(compiledContent, macrosToTest, false, false)
    })

    it('should compile single file at relative path in global config.buildConfig.buildOutputFolder', async () => {
      const buildOutputFolder = path.join(homedir, appName, 'random-folder')
      const destinationPath = path.join(
        buildOutputFolder,
        'services',
        'services',
        'example1.sas'
      )

      parentOutputFolder = path.join(homedir, appName)

      await updateConfig(
        {
          buildConfig: {
            ...defaultBuildConfig,
            buildOutputFolder: appName + '/random-folder'
          }
        },
        false
      )
      await expect(
        compileSingleFile(
          undefined as unknown as Target,
          new Command(`compile service -s ../services/example1.sas`),
          'service'
        )
      ).resolves.toEqual({
        destinationPath
      })

      await expect(fileExists(destinationPath)).resolves.toEqual(true)

      const compiledContent = await readFile(destinationPath)

      const macrosToTest: string[] = [
        'mf_nobs',
        'examplemacro',
        'yetanothermacro'
      ]

      await verifyCompiledService(compiledContent, macrosToTest, false, false)
    })
  })

  describe('without global config', () => {
    beforeEach(async () => {
      appName = `cli-tests-compile-${generateTimestamp()}`
      await saveGlobalRcFile('')
      process.projectDir = ''
      process.currentDir = path.join(__dirname, appName)
      await createFolder(process.currentDir)
    })

    afterEach(async () => {
      await deleteFolder(parentOutputFolder)
      await deleteFolder(process.currentDir)
    })

    it('should fail to compile single file', async () => {
      const dependencies = ['examplemacro.sas', 'yetanothermacro.sas']
      await expect(
        compileSingleFile(
          undefined as unknown as Target,
          new Command(`compile service -s ../services/example1.sas`),
          'service'
        )
      ).rejects.toEqual(
        `Unable to locate dependencies: ${dependencies.join(', ')}`
      )
    })
  })
})
