const fs = require('fs')
const path = require('path')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')

const rootDir = path.join(__dirname, '..')

const commandsPath = path.join(rootDir, 'src', 'data', 'commands.json')
const commandSchemaPath = path.join(rootDir, 'schemas', 'command.schema.json')
const manifestSchemaPath = path.join(rootDir, 'schemas', 'manifest.schema.json')
const metaPath = path.join(rootDir, 'src', 'meta.js')
const packagePath = path.join(rootDir, 'package.json')
const manifestPath = path.join(rootDir, 'manifest.json')

const meta = require(metaPath)
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const commandsData = JSON.parse(fs.readFileSync(commandsPath, 'utf8'))
const commandSchema = JSON.parse(fs.readFileSync(commandSchemaPath, 'utf8'))
const manifestSchema = JSON.parse(fs.readFileSync(manifestSchemaPath, 'utf8'))

function exitWithError(message) {
    console.error(`manifest generation failed: ${message}`)
    process.exit(1)
}

function assertRequiredString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        exitWithError(`required metadata missing: ${label}`)
    }
}

function assertRequiredBoolean(value, label) {
    if (typeof value !== 'boolean') {
        exitWithError(`required metadata missing: ${label}`)
    }
}

function getCommandEntrySchema(schema) {
    if (!schema.patternProperties) {
        exitWithError('schemas/command.schema.json is missing patternProperties')
    }

    const pattern = Object.keys(schema.patternProperties)[0]

    if (!pattern) {
        exitWithError('schemas/command.schema.json has no command entry schema')
    }

    return schema.patternProperties[pattern]
}

function buildSlashCommands(commands, validateCommand) {
    const slashCommands = []

    for (const [name, command] of Object.entries(commands)) {
        if (name === '$schema') {
            continue
        }

        if (!validateCommand(command)) {
            const errors = (validateCommand.errors || [])
                .map(error => `${error.instancePath || '/'} ${error.message}`)
                .join('; ')

            console.warn(`skipping malformed command "${name}": ${errors}`)
            continue
        }

        const slashCommand = {
            command: command.cmd,
            description: command.description,
            should_escape: false
        }

        if (command.usage_hint) {
            slashCommand.usage_hint = command.usage_hint
        }

        slashCommands.push(slashCommand)
    }

    return slashCommands.sort((a, b) =>
        a.command.localeCompare(b.command)
    )
}

function buildManifest() {
    assertRequiredString(meta.displayName, 'displayName')
    assertRequiredString(meta.shortDesc, 'shortDesc')
    assertRequiredString(meta.longDesc, 'longDesc')
    assertRequiredString(meta.themeColor, 'themeColor')

    assertRequiredBoolean(meta.socketMode, 'socketMode')

    assertRequiredString(
        meta.botUser?.displayName,
        'botUser.displayName'
    )

    assertRequiredBoolean(
        meta.botUser?.alwaysOnline,
        'botUser.alwaysOnline'
    )

    if (!Array.isArray(meta.oauthScopes) || meta.oauthScopes.length === 0) {
        exitWithError('required metadata missing: oauthScopes')
    }

    const ajv = new Ajv({
        allErrors: true,
        strict: false
    })

    addFormats(ajv)

    const validateCommand = ajv.compile(
        getCommandEntrySchema(commandSchema)
    )

    const validateManifest = ajv.compile(manifestSchema)

    const manifest = {
        display_information: {
            name: meta.displayName,
            description: meta.shortDesc,
            long_description: meta.longDesc,
            background_color: meta.themeColor
        },

        features: {
            bot_user: {
                display_name: meta.botUser.displayName,
                always_online: meta.botUser.alwaysOnline
            },

            slash_commands: buildSlashCommands(
                commandsData,
                validateCommand
            )
        },

        oauth_config: {
            scopes: {
                bot: [...new Set(meta.oauthScopes)]
            },

            pkce_enabled: Boolean(meta.pkceEnabled)
        },

        settings: {
            socket_mode_enabled: meta.socketMode,
            org_deploy_enabled: Boolean(meta.settings?.orgDeployEnabled),
            is_hosted: Boolean(meta.settings?.isHosted)
        }
    }

    if (typeof meta.settings?.tokenRotationEnabled === 'boolean') {
        manifest.settings.token_rotation_enabled =
            meta.settings.tokenRotationEnabled
    }

    if (!validateManifest(manifest)) {
        console.error('manifest schema validation failed:')

        for (const error of validateManifest.errors || []) {
            console.error(
                `- ${error.instancePath || '/'}: ${error.message}`
            )
        }

        exitWithError('generated manifest failed schema validation')
    }

    return manifest
}

const manifest = buildManifest()

fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
)

console.log(
    `generated manifest.json with ${manifest.features.slash_commands.length} commands`
)

console.log(
    `manifest source version: ${packageJson.version}`
)