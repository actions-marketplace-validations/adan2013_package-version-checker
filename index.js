const core = require('@actions/core')
const { GitHub, context } = require('@actions/github')

const getPackageJson = async (ref, octokit, packageJsonPath) => {
  const packageJSONData = (await octokit.repos.getContents({
    ...context.repo,
    path: packageJsonPath,
    ref,
  })).data.content
  if (!packageJSONData) {
    throw new Error(`Could not find package.json for commit ${ref}`)
  }
  return JSON.parse(Buffer.from(packageJSONData, 'base64').toString())
}

try {
  const token = core.getInput('GITHUB_TOKEN', { required: true })
  const packageJsonPath = core.getInput('PACKAGE_JSON_PATH', { required: false })
  const autoFailureMode = core.getInput('AUTO_FAILURE_MODE', { required: false })
  const baseSHA = core.getInput('PR_BASE_SHA', { required: true })
  const currentSHA = context.sha

  const octokit = new GitHub(token)
  const currentPackageJson = await getPackageJson(currentSHA, octokit, packageJsonPath)
  const basePackageJson = await getPackageJson(baseSHA, octokit, packageJsonPath)

  let isChanged = true
  if(currentPackageJson && basePackageJson) {
    if(currentPackageJson.version === basePackageJson.version) {
      isChanged = false
    }
  }

  const currentVersion = currentPackageJson ? currentPackageJson.version : ''
  const baseVersion = basePackageJson ? basePackageJson.version : ''
  const packageName = currentPackageJson ? currentPackageJson.name : ''

  core.setOutput('isChanged', isChanged)
  core.setOutput('versionFromPR', currentVersion)
  core.setOutput('versionFromBase', baseVersion)
  core.setOutput('packageName', packageName)

  switch (autoFailureMode) {
    case 'isDifferent':
      if(isChanged) core.setFailed(`Version number of package "${packageName}" cannot be changed manually!`)
      break
    case 'isTheSame':
      if(!isChanged) core.setFailed(`Version number of package "${packageName}" is the same related to the base of PR!`)
      break
    case 'off':
      core.info(`Version from base: ${baseVersion} Version from PR: ${currentVersion}`)
      break
    default:
      core.setFailed(`Unknown auto failure mode: ${autoFailureMode}`)
  }
} catch (err) {
  core.setFailed(`Action failed with error ${err}`)
}
