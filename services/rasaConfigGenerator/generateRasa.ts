import { Customer } from "../../client/Customer"
import { generateRasaConfig } from "../../common/rasaConfigGenerator"
import shell from "shelljs";
function main() {
    
    generateRasaConfig("/Users/hanselke/Dev/troybot/generated/rasa", Customer)
    shell.exec("cp -R ./templates/rasa/ /Users/hanselke/Dev/troybot/generated/rasa")
    shell.exec(`docker run -v /Users/hanselke/Dev/troybot/generated/rasa:/app -v /Users/hanselke/Dev/troybot/generated/models:/app/models rasa/rasa:3.5.6-full train --fixed-model-name ${Customer.id}-${Customer.version}`)
    shell.exec(`cd ./generated/models/ && scp ${Customer.id}-${Customer.version}.tar.gz eighty@192.168.0.151:/data/rasa/models/`)
}
main()