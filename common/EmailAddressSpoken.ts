import { EntityInstance } from "./types"

export const EmailAddressSpoken: EntityInstance[] = [
    {
        value: "alice@example.com",
        synonyms: ["alice at example dot com"],
    },
    {
        value: "john.doe@emailprovider.org",
        synonyms: ["john dot doe at email provider dot org", "john doe at emailprovider dot org"],
    },
    {
        value: "contact.me123@mycompany.net",
        synonyms: ["contact dot me 123 at my company dot net", "contact me123 at mycompany dot net"],
    },
    {
        value: "user1234@gmail.com",
        synonyms: ["user 1234 at gmail dot com", "user1234 at g mail dot com"],
    },
    {
        value: "support-team@email-provider.co.uk",
        synonyms: ["support dash team at email dash provider dot co dot uk",],
    },
    {
        value: "web.master123@my-site.com",
        synonyms: ["web dot master 123 at my dash site dot com", "web master123 at my dash site dot com"],
    },
    {
        value: "contact_us123@company-site.org",
        synonyms: ["contact underscore us123 at company dash site dot org", "contact us 123 at company dash site dot org"],
    },
    {
        value: "salesdepartment@emailprovider.io",
        synonyms: ["sales department at email provider dot io", "sales department at email provider dot i o"],
    },

]