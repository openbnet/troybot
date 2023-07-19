import { Customer } from "../../client/Customer"
import { generateRasaConfig } from "../../common/rasaConfigGenerator"

function main() {
    generateRasaConfig("./generated/rasa", Customer)
}
main()