import SASjs from '@sasjs/adapter/node'
import { displayResult } from '../utils/displayResult'
import { getAccessToken } from '../utils/config-utils'
import path from 'path'
import { createFile } from '../utils/file-utils'

/**
 * Export compute context to json file in current folder.
 * @param {string} contextName - name of the context to export.
 * @param {object} target - SAS server configuration.
 */
export async function exportContext(contextName, target) {
  const sasjs = new SASjs({
    serverUrl: target.serverUrl,
    serverType: target.serverType
  })

  const accessToken = await getAccessToken(target).catch((err) => {
    displayResult(err)
  })

  const context = await sasjs
    .getComputeContextByName(contextName, accessToken)
    .catch((err) => {
      displayResult(err, '', null)
    })

  if (context && context.id) {
    const contextAllAttributes = await sasjs
      .getComputeContextById(context.id, accessToken)
      .catch((err) => displayResult(err, '', null))

    if (contextAllAttributes) {
      delete contextAllAttributes.links

      let output

      try {
        output = JSON.stringify(contextAllAttributes, null, 2)
      } catch (error) {
        displayResult(null, null, 'Context has bad format.')

        return
      }

      const outputFileName = contextName.replace(/[^a-z0-9]/gi, '_') + '.json'
      const outputPath = path.join(process.cwd(), outputFileName)

      await createFile(outputPath, output)

      displayResult(
        null,
        null,
        `Context successfully exported to '${outputPath}'.`
      )
    }
  }
}