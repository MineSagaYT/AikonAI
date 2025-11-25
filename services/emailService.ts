import { FileAttachment } from '../types';

export const sendEmail = async (
    accessToken: string,
    to: string,
    subject: string,
    body: string,
    attachments: FileAttachment[] = []
): Promise<{ success: boolean; message: string }> => {
    try {
        const boundary = "mk_boundary_" + Date.now().toString();
        const emailLines = [];
        
        emailLines.push(`To: ${to}`);
        emailLines.push(`Subject: ${subject}`);
        emailLines.push('MIME-Version: 1.0');
        emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
        emailLines.push('');
        
        // Text Body
        emailLines.push(`--${boundary}`);
        emailLines.push('Content-Type: text/plain; charset="UTF-8"');
        emailLines.push('Content-Transfer-Encoding: 7bit');
        emailLines.push('');
        emailLines.push(body);
        emailLines.push('');

        // Attachments
        if (attachments && attachments.length > 0) {
            for (const attachment of attachments) {
                emailLines.push(`--${boundary}`);
                // Ensure proper MIME type is set (default to octet-stream if missing)
                const mimeType = attachment.mimeType || 'application/octet-stream';
                emailLines.push(`Content-Type: ${mimeType}`);
                emailLines.push('Content-Transfer-Encoding: base64');
                emailLines.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
                emailLines.push('');
                // attachment.base64 is expected to be the raw base64 string (without data URI prefix)
                emailLines.push(attachment.base64);
                emailLines.push('');
            }
        }
        
        emailLines.push(`--${boundary}--`);

        const emailRaw = emailLines.join('\r\n');
        
        // Encode the entire MIME message to Base64URL
        // Using encodeURIComponent + unescape is a robust way to handle UTF-8 chars in the body before btoa
        const base64EncodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');


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
            const attMsg = attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : '';
            return { success: true, message: `Email sent successfully to ${to}${attMsg}.` };
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