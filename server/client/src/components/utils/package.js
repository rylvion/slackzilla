import packageInformation from '../../../../../package.json'

export const packageInfo = packageInformation
export const version = packageInformation.version
export function getMetadata() {
    return {
        name: packageInformation.name,
        version: packageInformation.version,
        description: packageInformation.description,
    }
}