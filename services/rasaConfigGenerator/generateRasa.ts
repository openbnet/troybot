import { Customer } from "../../client/Customer"
import { generateRasaConfig } from "../../common/rasaConfigGenerator"
import shell from "shelljs";
function main() {
    const basePath =  process.cwd() + "/generated"
    const rasaPath = basePath + "/rasa"
    console.log("basePath",basePath)
    console.log("rasaPath",rasaPath)
    generateRasaConfig(rasaPath, Customer)
    shell.exec(`ls -lah ${rasaPath}`)
    shell.exec(`cp -R ./templates/rasa/* ${rasaPath}`)
    shell.exec(`ls -lah ${rasaPath}`)
    shell.exec(`docker run -v ${rasaPath}:/app -v ${basePath}/models:/app/models rasa/rasa:3.5.6-full train --fixed-model-name ${Customer.id}-${Customer.version}`)
    shell.exec(`echo "trying to get base models" && ls -lah && ls -lah ${basePath}/models`)
    shell.exec(`cd ${basePath}/models/ && cp ${Customer.id}-${Customer.version}.tar.gz ${process.cwd()}`)
}
main()