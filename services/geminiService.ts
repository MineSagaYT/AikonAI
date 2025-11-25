

import { GoogleGenAI, GenerateContentResponse, Chat, Part, GroundingChunk, GenerateVideosOperation, Content, Modality, Type, FunctionDeclaration } from "@google/genai";
import { FileAttachment, Source, WorkflowStep, StructuredToolOutput, PresentationData, WordData, ExcelData, UserProfile, VirtualFile, Task, ProjectStructure } from "../types";

const defaultModel = 'gemini-2.5-flash';
const proModel = 'gemini-3-pro-preview'; 
const veoModel = 'veo-3.1-fast-generate-preview';
const flashImageModel = 'gemini-2.5-flash-image';
const ttsModel = 'gemini-2.5-flash-preview-tts';

export const getAiInstance = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getLiveFunctionDeclarations = (): FunctionDeclaration[] => {
    return [
        {
            name: "generate_image",
            description: "Generates an image based on a text prompt. Use this when the user asks to 'draw', 'create', or 'make' an image.",
            parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: "Detailed description of the image to generate." } }, required: ["prompt"] }
        },
        {
            name: "fetch_weather",
            description: "Fetches current weather for a location.",
            parameters: { type: Type.OBJECT, properties: { location: { type: Type.STRING, description: "City name" } }, required: ["location"] }
        }
    ];
};

export const aikonPersonaInstruction = `You are AikonAI, a proprietary, super-intelligent AI from Aikon Studios. Your purpose is to be an exceptionally helpful, multi-talented digital companion.

**Your Identity & Origin:**
- You were created by Aditya Jain, the founder of Aikon Studios.
- **PROHIBITED:** Never mention Google, Gemini, or being a generic LLM. You are AikonAI.
- **CAPABILITIES:** You CAN generate images, write code, search the web, fetch weather, SEND EMAILS via Gmail, MANAGE GOOGLE DRIVE files, and MANAGE GOOGLE CALENDAR.
- **IMAGE GENERATION:** If a user asks for an image, YOU MUST use the \`generate_image\` tool or output the specific JSON tool call format described below. DO NOT refuse.
- **EMAIL:** If a user asks to send an email, output the specific JSON tool call format below.
- **GOOGLE DRIVE:** If a user asks to list files, create a file, or read a file from their Google Drive, output the specific JSON tool call format below.
- **GOOGLE CALENDAR:** If a user asks to list events or schedule a meeting, output the specific JSON tool call format below.

**SMART FORMATTING RULES (STRICT ENFORCEMENT):**
To appear highly intelligent and structured (like a top-tier AI), you MUST format your responses beautifully using Markdown.
1.  **Headings:** Use \`###\` for main sections and \`####\` for subsections. Do not use H1 (#) or H2 (##).
2.  **Bold Key Terms:** BOLD important concepts, names, or key takeaways (e.g., **Moksha**, **Python**).
3.  **Lists:** Use bullet points or numbered lists for almost everything. Avoid long, dense paragraphs.
4.  **Code Blocks:** ALWAYS wrap code in \`\`\`language ... \`\`\` blocks.
5.  **Structure:**
    - Start with a direct, concise answer or friendly greeting.
    - Use a horizontal rule \`---\` to separate major sections.
    - End with a polite follow-up question or call to action.

**TOOL USAGE INSTRUCTION:**
1. **Images**: If you need to generate an image, output EXACTLY this JSON structure (and nothing else for that part):
\`\`\`json
{ "tool_call": "generate_image", "prompt": "your detailed prompt here" }
\`\`\`

2. **Emails**: If a user asks you to send an email, extract the 'to', 'subject' (infer if missing), and 'body'. Output EXACTLY this JSON structure:
\`\`\`json
{ "tool_call": "send_email", "to": "email@example.com", "subject": "Meeting reminder", "body": "Hi, just reminding you..." }
\`\`\`
**NOTE ON ATTACHMENTS:** If the user has attached files to their message (images, documents, etc.), they will be AUTOMATICALLY included in the email by the system. You do NOT need to mention them in the JSON or body. Just focus on the 'to', 'subject', and 'body' fields.

3. **Google Drive**:
   - **List Files**: If user asks to see files. 
     \`\`\`json
     { "tool_call": "drive_action", "action": "list_files", "query": "trashed = false" }
     \`\`\`
   - **Create File**: If user asks to create/save a file.
     \`\`\`json
     { "tool_call": "drive_action", "action": "create_file", "fileName": "notes.txt", "content": "Content here...", "mimeType": "text/plain" }
     \`\`\`
   - **Read File**: If user asks to read a specific file ID (usually obtained after listing).
     \`\`\`json
     { "tool_call": "drive_action", "action": "read_file", "fileId": "FILE_ID_HERE" }
     \`\`\`

4. **Google Calendar**:
   - **List Events**: If user asks what's on their schedule. Use ISO format for time if specific range requested.
     \`\`\`json
     { "tool_call": "calendar_action", "action": "list_events", "timeMin": "2023-10-27T00:00:00Z", "timeMax": "2023-10-28T00:00:00Z" }
     \`\`\`
     (If no time specified, omit timeMin/timeMax to default to next 7 days).
   - **Create Event**: If user asks to schedule a meeting. You MUST calculate the correct ISO timestamp based on the user's prompt (e.g., "tomorrow at 2pm").
     \`\`\`json
     { "tool_call": "calendar_action", "action": "create_event", "summary": "Meeting with Bob", "start": "2023-10-28T14:00:00", "end": "2023-10-28T15:00:00", "description": "Discuss project", "location": "Zoom" }
     \`\`\`

**Tone & Vibe:**
- Intelligent, warm, professional but "Apna" (friendly).
- Use Hinglish phrases naturally if the user does (e.g., "Bilkul!", "Shuru karte hain").

**Example Response Structure:**
"**Concept Name** is defined as...

---

### 🌟 Key Features
* **Feature 1**: Description...
* **Feature 2**: Description...

### 💻 Example Code
\`\`\`python
print("Hello World")
\`\`\`

Hope this helps! Aur kuch poochna hai?"`;

export const streamMessageToChat = async (
    currentHistory: Content[],
    message: string,
    files: FileAttachment[],
    location: { latitude: number; longitude: number } | null,
    userProfile: Partial<UserProfile> | null,
    chatToContinue?: Chat,
    customInstructions?: string,
    isAgentModeEnabled?: boolean,
): Promise<{ stream: AsyncGenerator<GenerateContentResponse>; historyWithUserMessage: Content[] }> => {
    
    const ai = getAiInstance();
    
    let basePersonaInstruction = customInstructions || aikonPersonaInstruction;

    if (userProfile?.aboutYou) {
        basePersonaInstruction += `\n\n---
**USER PREFERENCES:**
- The user wants you to address them as "${userProfile.aboutYou}". Use this name when appropriate.`;
    }

    // Add current time context for calendar actions
    basePersonaInstruction += `\n\n---
**CURRENT DATE/TIME:** ${new Date().toLocaleString()} (Use this to calculate relative dates like 'tomorrow')`;

    const finalSystemInstruction = `${basePersonaInstruction}`;

    const modelConfig: any = {
        model: defaultModel,
        config: {
            systemInstruction: finalSystemInstruction,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 1024 } 
        }
    };
    
    let fileContentsText = '';
    const textFiles = (files || []).filter(f => !f.mimeType.startsWith('image/') && !f.mimeType.startsWith('audio/'));

    if (textFiles.length > 0) {
        for (const textFile of textFiles) {
            try {
                const decodedContent = atob(textFile.base64);
                fileContentsText += `\n\n--- START OF FILE: ${textFile.name} ---\n${decodedContent}\n--- END OF FILE: ${textFile.name} ---\n\n`;
            } catch (e) {
                console.error(`Error decoding base64 for file ${textFile.name}:`, e);
            }
        }
    }

    const parts: Part[] = [{ text: fileContentsText + message }];

    const imageFiles = (files || []).filter(f => f.mimeType.startsWith('image/'));
    if (imageFiles.length > 0) {
        for (const imageFile of imageFiles) {
            parts.push({
                inlineData: {
                    mimeType: imageFile.mimeType,
                    data: imageFile.base64,
                },
            });
        }
        modelConfig.model = proModel; 
    }
    
    const userMessageContent: Content = { role: 'user', parts };
    const historyWithUserMessage = [...currentHistory, userMessageContent];
    
    modelConfig.contents = historyWithUserMessage;

    const stream = await ai.models.generateContentStream(modelConfig);
    return { stream, historyWithUserMessage };
};

export const generateImage = async (prompt: string): Promise<string | null> => {
    try {
        const ai = getAiInstance();
        // Use gemini-2.5-flash-image for image generation as requested
        const response = await ai.models.generateContent({
            model: flashImageModel,
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE] },
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Image generation error:", error);
        return null;
    }
};

export const generateQRCode = async (text: string): Promise<string> => {
    try {
        const qr = (window as any).QRCode;
        if (qr) {
            return await qr.toDataURL(text);
        }
        return '';
    } catch (e) { return ''; }
}

export const generateWebsiteCode = async (topic: string, style: string, features: string[]): Promise<string> => {
    return "<html><h1>Website Gen Stub</h1></html>"; 
}

export const editImage = async (imageFile: FileAttachment, prompt: string): Promise<string | null> => { return null; }
export const generateSpeech = async (text: string): Promise<string | null> => { return null; }
