import chalk from 'chalk'
import ora from 'ora'
import { displayResult } from '../../utils/displayResult'
import { createFile, createFolder, folderExists } from '../../utils/file-utils'
import { parseLogLines } from '../../utils/utils'
import path from 'path'

/**
 * Triggers existing job for execution.
 * @param {object} sasjs - configuration object of SAS adapter.
 * @param {string} accessToken - an access token for an authorized user.
 * @param {string} jobPath - location of the job on SAS Drive.
 * @param {object} target - SAS server configuration.
 * @param {boolean} waitForJob - flag indicating if CLI should wait for job completion.
 * @param {boolean} output - flag indicating if CLI should print out job output. If string was provided, it will be treated as file path to store output.
 * @param {boolean | string} output - flag indicating if CLI should print out job output. If string was provided, it will be treated as file path to store output. If filepath wasn't provided, output.json file will be created in current folder.
 * @param {boolean | string} logFile - flag indicating if CLI should fetch and save log to provided file path. If filepath wasn't provided, {job}.log file will be created in current folder.
 * @param {boolean | string} statusFile - flag indicating if CLI should fetch and save status to the local file. If filepath wasn't provided, it will only print on console.
 */
export async function execute(
  sasjs,
  accessToken,
  jobPath,
  target,
  waitForJob,
  output,
  logFile,
  statusFile
) {
  let result

  const startTime = new Date().getTime()

  if (statusFile !== undefined)
    displayStatus({ state: 'Initiating' }, statusFile)

  const spinner = ora(
    `Job located at ${chalk.greenBright(
      jobPath
    )} has been submitted for execution...\n`
  )

  spinner.start()

  const submittedJob = await sasjs
    .startComputeJob(
      jobPath,
      null,
      { contextName: target.tgtDeployVars.contextName },
      accessToken,
      waitForJob || logFile !== undefined ? true : false
    )
    .catch((err) => {
      result =
        typeof err === 'object' && Object.keys(err).length
          ? JSON.stringify({ state: err.result.state })
          : `${err}`
      if (err.result) {
        return err.result
      }
    })

  spinner.stop()

  const endTime = new Date().getTime()

  if (result)
    displayResult(result, 'An error has occurred when executing a job.', null)
  if (statusFile !== undefined) displayStatus(submittedJob, statusFile, result)

  if (submittedJob && submittedJob.links) {
    if (!result) result = true

    const sessionLink = submittedJob.links.find(
      (l) => l.method === 'GET' && l.rel === 'self'
    ).href

    displayResult(
      null,
      null,
      (waitForJob
        ? `Job located at '${jobPath}' has been executed.\nJob details`
        : `Job session`) + ` can be found at ${target.serverUrl + sessionLink}`
    )

    if (output !== undefined || logFile !== undefined) {
      try {
        const outputJson = JSON.stringify(submittedJob, null, 2)

        if (typeof output === 'string') {
          const outputPath = path.join(
            process.cwd(),
            /\.[a-z]{3,4}$/i.test(output)
              ? output
              : path.join(output, 'output.json')
          )

          let folderPath = outputPath.split(path.sep)
          folderPath.pop()
          folderPath = folderPath.join(path.sep)

          if (!(await folderExists(folderPath))) await createFolder(folderPath)

          await createFile(outputPath, outputJson)

          displayResult(null, null, `Output saved to: ${outputPath}`)
        } else if (output) {
          console.log(outputJson)
        }

        if (logFile !== undefined) {
          const logObj = submittedJob.links.find(
            (link) => link.rel === 'log' && link.method === 'GET'
          )

          if (logObj) {
            const logUrl = target.serverUrl + logObj.href
            const logData = await sasjs.fetchLogFileContent(logUrl, accessToken)
            const logJson = JSON.parse(logData)

            let logPath

            if (typeof logFile === 'string') {
              logPath = path.join(process.cwd(), logFile)
            } else {
              logPath = path.join(
                process.cwd(),
                `${jobPath.split('/').slice(-1).pop()}.log`
              )
            }

            let folderPath = logPath.split(path.sep)
            folderPath.pop()
            folderPath = folderPath.join(path.sep)

            if (!(await folderExists(folderPath))) {
              await createFolder(folderPath)
            }

            let logLines = parseLogLines(logJson)

            await createFile(logPath, logLines)

            displayResult(null, null, `Log saved to: ${logPath}`)
          }
        }

        result = submittedJob
      } catch (error) {
        result = false

        displayResult(
          null,
          'An error has occurred when parsing an output of the job.',
          null
        )
      }
    }
  }

  console.log(
    chalk.whiteBright(
      `This operation took ${(endTime - startTime) / 1000} seconds`
    )
  )

  return result
}

async function displayStatus(submittedJob, statusFile, error = '') {
  const adapterStatus =
    submittedJob && submittedJob.state ? submittedJob.state : 'Not Available'

  const status =
    adapterStatus === 'Not Available' || adapterStatus === 'Error'
      ? `Job Status: ${adapterStatus}\nDetails: ${error}\n`
      : `Job Status: ${adapterStatus}`

  if (adapterStatus === 'completed') displayResult(null, null, status)
  else displayResult({}, status, null)

  if (typeof statusFile === 'string') {
    const statusPath = path.join(process.cwd(), statusFile)

    let folderPath = statusPath.split(path.sep)
    folderPath.pop()
    folderPath = folderPath.join(path.sep)

    if (!(await folderExists(folderPath))) await createFolder(folderPath)

    await createFile(statusPath, status)
  }
}
