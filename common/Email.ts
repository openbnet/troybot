export function transformEmailToSpeechText(email: string): string {
    if (email.includes(' ')) {
        console.error("email includes spaces", email)
        throw new Error("Email address cannot contain spaces");
    }
    email = email.toUpperCase()
    console.log("transformEmail", email)
    const mapping: Record<string, string> = {
        '@': 'at',
        '.': 'dot'
    };

    const convertedEmail = email.split('').map(char => mapping[char] || char).join(' ');

    return convertedEmail;
}