import { Customer } from "../../client/Customer"
import { generateRasaConfig } from "../../common/rasaConfigGenerator"
import shell from "shelljs";
function main() {
    const basePath = process.cwd() + "/generated"
    const rasaPath = basePath + "/rasa"
    console.log("basePath", basePath)
    console.log("rasaPath", rasaPath)
    const currentUserId = process.getuid ? process.getuid() : null
    if (!currentUserId) {
        throw new Error("os doesnt support process.getuid")
    }
    console.log("currentUserId", currentUserId)
    generateRasaConfig(rasaPath, Customer)
    shell.exec(`ls -lah ${rasaPath}`)
    shell.exec(`cp -R ./templates/rasa/* ${rasaPath}`)
    shell.exec(`ls -lah ${rasaPath}`)
    shell.exec(`sudo chown -R 1001:${currentUserId} ${basePath}`)
    shell.exec(`docker run -v ${rasaPath}:/app -v ${basePath}/models:/app/models rasa/rasa:3.6.4-full train --fixed-model-name ${Customer.id}-${Customer.version}`)
    shell.exec(`sudo chown -R ${currentUserId}:${currentUserId} ${basePath}`)
    shell.exec(`echo "trying to get base models" && ls -lah && ls -lah ${basePath}/models`)
    shell.exec(`cd ${basePath}/models/ && cp ${Customer.id}-${Customer.version}.tar.gz ${process.cwd()}/models`)
    shell.exec(`echo RASA_MODEL=${Customer.id}-${Customer.version}.tar.gz > .env`)
}
main()