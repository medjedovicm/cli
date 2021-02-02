import path from 'path'

import { doc } from '../../../main'
import { Command } from '../../../utils/command'
import { createTestApp, removeTestApp } from '../../../utils/test'
import { generateTimestamp } from '../../../utils/utils'
import { folderExists, fileExists, deleteFile } from '../../../utils/file'

describe('sasjs doc', () => {
  let appName: string

  afterEach(async () => {
    await removeTestApp(__dirname, appName)
  })

  it(
    `should generate docs`,
    async () => {
      appName = `test-app-doc-${generateTimestamp()}`
      const docOutputDefault = path.join(
        __dirname,
        appName,
        'sasjsbuild',
        'docs'
      )

      await createTestApp(__dirname, appName)

      await expect(doc(new Command(`doc`))).resolves.toEqual(0)

      await verifyDocs(docOutputDefault)
    },
    60 * 1000
  )

  it(
    `should generate docs for single target`,
    async () => {
      appName = `test-app-doc-${generateTimestamp()}`
      const docOutputDefault = path.join(
        __dirname,
        appName,
        'sasjsbuild',
        'docs'
      )

      await createTestApp(__dirname, appName)

      await expect(doc(new Command(`doc -t viya`))).resolves.toEqual(0)

      await verifyDocs(docOutputDefault, 'viya')
    },
    60 * 1000
  )

  it(
    `should generate docs to ./my-docs`,
    async () => {
      appName = `test-app-doc-${generateTimestamp()}`

      const docOutputProvided = path.join(__dirname, appName, 'my-docs')

      await createTestApp(__dirname, appName)

      await expect(folderExists(docOutputProvided)).resolves.toEqual(false)

      await expect(
        doc(new Command(`doc --outDirectory ${docOutputProvided}`))
      ).resolves.toEqual(0)

      await verifyDocs(docOutputProvided)
    },
    60 * 1000
  )

  it(
    `should fail to generate docs for not having Doxyfile configuration`,
    async () => {
      appName = `test-app-doc-${generateTimestamp()}`

      await createTestApp(__dirname, appName)

      await deleteFile(path.join(__dirname, appName, 'sasjs/doxy/Doxyfile'))

      await expect(doc(new Command(`doc`))).resolves.toEqual(2)
    },
    60 * 1000
  )
})

const verifyDocs = async (docsFolder: string, target: string = 'no-target') => {
  const indexHTML = path.join(docsFolder, 'index.html')
  const appInitHTML = path.join(docsFolder, 'appinit_8sas.html')

  const sas9MacrosExampleMacro = path.join(
    docsFolder,
    'targets_2sas9_2macros_2examplemacro_8sas_source.html'
  )
  const sas9ServicesAdminDostuff = path.join(
    docsFolder,
    'targets_2sas9_2services_2admin_2dostuff_8sas_source.html'
  )
  const viyaMacrosExampleMacro = path.join(
    docsFolder,
    'targets_2viya_2macros_2examplemacro_8sas_source.html'
  )
  const viyaServicesAdminDostuff = path.join(
    docsFolder,
    'targets_2viya_2services_2admin_2dostuff_8sas_source.html'
  )
  const yetAnotherMacro = path.join(docsFolder, 'yetanothermacro_8sas.html')
  const yetAnotherMacroSource = path.join(
    docsFolder,
    'yetanothermacro_8sas_source.html'
  )

  await expect(folderExists(docsFolder)).resolves.toEqual(true)

  await expect(fileExists(indexHTML)).resolves.toEqual(true)
  await expect(fileExists(appInitHTML)).resolves.toEqual(true)

  const expectSas9Files = target === 'no-target' || target === 'sas9'
  const expectViyaFiles = target === 'no-target' || target === 'viya'

  await expect(fileExists(sas9MacrosExampleMacro)).resolves.toEqual(
    expectSas9Files
  )
  await expect(fileExists(sas9ServicesAdminDostuff)).resolves.toEqual(
    expectSas9Files
  )
  await expect(fileExists(viyaMacrosExampleMacro)).resolves.toEqual(
    expectViyaFiles
  )
  await expect(fileExists(viyaServicesAdminDostuff)).resolves.toEqual(
    expectViyaFiles
  )

  await expect(fileExists(yetAnotherMacro)).resolves.toEqual(true)
  await expect(fileExists(yetAnotherMacroSource)).resolves.toEqual(true)
}