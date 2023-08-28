interface CountryMapping {
    [letter: string]: string;
}

const countryMappings: CountryMapping = {
    "a": "America\n",
    "b": "Britain\n",
    "c": "China\n",
    "d": "Denmark\n",
    "e": "England\n",
    "f": "Fiji\n",
    "g": "Germany\n",
    "h": "Hong Kong\n",
    "i": "India\n",
    "j": "Japan\n",
    "k": "Korea\n",
    "l": "London\n",
    "m": "Malaysia\n",
    "n": "Norway\n",
    "o": "Osaka\n",
    "p": "Paris\n",
    "q": "Queensland\n",
    "r": "Russia\n",
    "s": "Singapore\n",
    "t": "Thailand\n",
    "u": "Uganda\n",
    "v": "Venice\n",
    "w": "Washington\n",
    "x": "X-ray\n",
    "y": "Yemen\n",
    "z": "Zambia\n",
    // Add more letters and corresponding country names as needed
};

export function transformEmailsToCountry(sentence: string): string {
    const emailRegex = /(\S+@\S+\.\S+)/g;

    const transformedSentence = sentence.replace(emailRegex, (email) => {
        const [username, domain] = email.split('@');
        const domainParts = domain.split('.');
        const transformedUsername = username.split('-')
            .map(part => part.split('').map(letter => countryMappings[letter] || letter).join(' '))
            .join(' dash ');

        const transformedDomain = domainParts
            .slice(0, -1) // Exclude the last part (TLD)
            .map(part => part.split('').map(letter => countryMappings[letter] || letter).join(' '))
            .join(' dot ');

        const lastTLDPart = domainParts[domainParts.length - 1];
        const transformedLastTLDPart = countryMappings[lastTLDPart] || lastTLDPart;

        return `${transformedUsername} at ${transformedDomain} dot ${transformedLastTLDPart}`;
    });

    return transformedSentence;
}