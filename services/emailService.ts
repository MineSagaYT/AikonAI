export const sendEmail = async (
    accessToken: string,
    to: string,
    subject: string,
    body: string
): Promise<{ success: boolean; message: string }> => {
    try {
        const emailLines = [];
        emailLines.push(`To: ${to}`);
        emailLines.push('Content-Type: text/plain; charset="UTF-8"');
        emailLines.push('MIME-Version: 1.0');
        emailLines.push(`Subject: ${subject}`);
        emailLines.push('');
        emailLines.push(body);

        const email = emailLines.join('\r\n');
        
        // Use modern and robust method for UTF-8 to base64url encoding
        const utf8Bytes = new TextEncoder().encode(email);
        let binaryString = '';
        utf8Bytes.forEach((byte) => {
            binaryString += String.fromCharCode(byte);
        });
        const base64EncodedEmail = btoa(binaryString)
            .replace(/\+/g, '-')
            .replace(/\//g, '_');


        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: base64EncodedEmail
            })
        });

        const data = await response.json();

        if (response.ok) {
            return { success: true, message: `Email sent successfully to ${to}.` };
        } else {
            console.error('Gmail API Error:', data.error);
            // Check for specific auth errors to guide the user
            if (data.error.status === 'UNAUTHENTICATED' || data.error.code === 401) {
                return { success: false, message: `Authentication failed. Please try connecting your Gmail account again.` };
            }
            return { success: false, message: `Failed to send email: ${data.error.message}` };
        }
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, message: 'An unexpected error occurred while sending the email.' };
    }
};