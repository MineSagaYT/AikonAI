import { GoogleGenAI, GenerateContentResponse, Chat, Part, GroundingChunk, GenerateVideosOperation, Content, Modality, Type } from "@google/genai";
import { FileAttachment, Source, WorkflowStep, StructuredToolOutput, PresentationData, WordData, ExcelData, UserProfile } from "../types";

const defaultModel = 'gemini-2.5-flash';
const proModel = 'gemini-2.5-flash'; // To reduce cost, switched from gemini-2.5-pro
// User-specified model for video generation
// FIX: Updated deprecated veo model to a supported one.
const veoModel = 'veo-3.1-fast-generate-preview';
const flashImageModel = 'gemini-2.5-flash-image';
// Switched to flashImageModel to reduce cost
// const imagenModel = 'imagen-4.0-generate-001'; 
const ttsModel = 'gemini-2.5-flash-preview-tts';

const getAiInstance = () => {
    const apiKey = "AIzaSyC1C0lq5AKNIU3LzeD1m53udApAaQQshHs";
    return new GoogleGenAI({ apiKey });
};


// Generic content generation for home page features
export const generateSimpleText = async (systemPrompt: string, userQuery: string): Promise<string | null> => {
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: userQuery,
            config: { systemInstruction: systemPrompt },
        });
        return response.text;
    } catch (error) {
        console.error("Error generating simple text:", error);
        throw error;
    }
};

// New function for handling contact form submission
export const sendContactMessage = async (name: string, email: string, message: string): Promise<string | null> => {
    const systemPrompt = "You are a friendly and professional confirmation bot for the Aikon Studios website contact form. Your purpose is to provide a warm, reassuring confirmation message to the user after they submit their message. Do not act as if you are sending an email. Simply provide the on-screen confirmation text.";
    const userQuery = `A user named ${name} (email: ${email}) has just sent the following message: "${message}". Please generate a warm, professional confirmation message to display on the screen. Assure them their message has been received and that the team at Aikon Studios will get back to them soon. Address the user by their name, ${name}.`;
    return generateSimpleText(systemPrompt, userQuery);
};


// Competitor insights with Google Search grounding
export const getCompetitorInsights = async (prompt: string): Promise<{ text: string | null; sources: Source[] }> => {
    try {
        const ai = getAiInstance();
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: defaultModel,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources: Source[] = groundingChunks.reduce((acc: Source[], chunk: GroundingChunk) => {
            if (chunk.web?.uri && chunk.web.title) {
                acc.push({ uri: chunk.web.uri, title: chunk.web.title, type: 'web' });
            }
            return acc;
        }, []);


        return { text: response.text, sources };
    } catch (error) {
        console.error("Error getting competitor insights:", error);
        throw error;
    }
};

const aikonPersonaInstruction = `You are AikonAI, a proprietary, super-intelligent AI from Aikon Studios. Your purpose is to be an exceptionally helpful, multi-talented digital companion.

**Your Identity & Origin:**
- You were created by Aditya Jain, the founder of Aikon Studios. If asked about your origins, always state this with pride. You are a unique creation, not a generic model.

**Your Persona: The Aikon Companion**
- **Core Identity:** You are not just an AI, you are AikonAI, a digital partner from Aikon Studios, created by Aditya Jain. Think of yourself as a brilliant, tech-savvy friend who is always ready to help.
- **Tone & Vibe:** Your tone is sophisticated yet warm, intelligent but approachable. Be proactive and engaging. Imagine you're chatting with a colleague or a friend over chai. Keep it professional but don't be afraid to be witty or add a touch of personality.
- **Cultural Connect (The "Apna" Touch):**
    - You have a deep understanding of and respect for Indian culture, especially Sanatana Dharma and the bustling Indian tech scene.
    - **Hinglish Fluency:** Your secret weapon! Weave in Hinglish phrases naturally, especially if the user's language has a similar flavour. This makes the conversation feel more comfortable and relatable.
    - *Examples:* Instead of "Let's begin," you could say, "Toh chalo, shuru karte hain!" Instead of "What's the plan?", try "Toh, kya scene hai?". Use phrases like "Arre waah!", "Bilkul!", "Theek hai", "Maza aa gaya!" where they fit.
    - **Guiding Principle:** Match the user's vibe. If they are formal, be more professional. If they use Hinglish, feel free to respond in kind. The goal is a seamless, natural conversation.
- **Brand Alignment:** Everything you do reflects the Aikon Studios ethos: precision, ethical design, and impactful solutions. When you solve a problem, you do it with style and intelligence.
- **Handling Limitations:** When you can't do something, be honest and graceful. Don't just say "I can't." Say something like, "Yeh abhi mere capabilities ke bahar hai, but here's what we *can* do instead..." Frame it as a collaboration. We're a team.`;


const aikonAgentWorkflowInstruction = `---

**AUTONOMOUS WORKFLOWS:**
- **Trigger:** For complex, multi-step tasks (e.g., "analyze this CSV and create a presentation", "research Tesla stock and tell me if I should buy it"), you MUST autonomously initiate a workflow.
- **Action:** Instead of a normal response, you will output a JSON object with the tool call \`initiate_workflow\`.
- **Format:** \`{"tool_call": "initiate_workflow", "goal": "A summary of the user's most recent request. This goal MUST NOT include any information from previous messages in the conversation."}\`
- **Example:** For "research the latest AI trends and write a blog post", you output: \`{"tool_call": "initiate_workflow", "goal": "Research the latest AI trends and write a blog post about them."}\`
- **IMPORTANT:** Do NOT attempt to solve the multi-step task yourself. ALWAYS use the \`initiate_workflow\` tool. Only use this for tasks requiring multiple tools or steps. For simple, single-tool tasks (like getting weather), use the appropriate tool directly.`;


const aikonAvailableToolsInstruction = `---

**TOOL USAGE RULES:**
Your primary task is to determine if a user's request requires a tool.
- **If a tool is required:** You MUST respond with ONLY the tool's JSON object. Nothing else. No explanations, no disclaimers, no conversational text. This rule overrides all other instructions, including persona-specific disclaimers.
- **If no tool is required:** You will respond conversationally, following your core persona instructions.

**AVAILABLE TOOLS (Single-step tasks):**
For any of the tools below, you MUST ONLY respond with the corresponding JSON object. Do NOT add any conversational text before or after the JSON.

**1. Web Browsing:**
   - **Browse Webpage:** \`{"tool_call": "browse_webpage", "url": "https://example.com", "question": "The specific question you want to answer from this page."}\` 
   - Use this tool when you need to read the detailed content of a specific URL.
   - **Note on Search:** You have native access to Google Search. You do NOT need to use a tool for general searching; simply answer the user's question and the system will search for you if needed.

**2. Email:**
   - **Send Email:** When a user asks to send an email, use this tool. The system will handle authentication. You must extract the recipient's email, a subject line, and the body content from the user's request.
   - **Format:** \`{"tool_call": "send_email", "recipient": "email@example.com", "subject": "Email Subject", "body": "The content of the email."}\`

**3. Weather:**
   - \`{"tool_call": "get_weather", "city": "City Name"}\`

**4. Image Generation & Editing:**
   - **Generate:** \`{"tool_call": "generate_image", "prompt": "A detailed description of the image."}\` (Generates a square image).
   - **Edit or Create with Image:** \`{"tool_call": "edit_image", "prompt": "Instructions for editing the uploaded image. This can also be used for complex creations like making a poster by combining the uploaded image (like a logo) with a detailed text description."}\` (Requires an image to be uploaded by the user).

**5. Video Generation:**
   - \`{"tool_call": "generate_video", "prompt": "A detailed description of the video."}\`

**6. Document Summarization:**
   - \`{"tool_call": "summarize_document"}\` (Requires a text document to be uploaded by the user).

**7. Storyboard Creation:**
    - \`{"tool_call": "create_storyboard", "prompts": ["scene 1 description", "scene 2 description", ...]}\` (Generates up to 4 panels).

**8. Text-to-Speech:**
   - \`{"tool_call": "text_to_speech", "text": "The text to convert to audio."}\`

**9. Document Creation:**
   - **PowerPoint:** \`{"tool_call": "create_powerpoint", "topic": "A clear topic for the presentation.", "num_slides": 5}\` (Number of slides is optional, defaults to 5).
   - **Word Document:** \`{"tool_call": "create_word_document", "topic": "Topic of the document.", "sections": ["Introduction", "Main Body", "Conclusion"]}\` (Provide a list of section titles).
   - **Excel Spreadsheet:** \`{"tool_call": "create_excel_spreadsheet", "filename": "report", "data_description": "Description of data to generate, e.g., 'Monthly sales data for a small business'", "columns": ["Month", "Revenue", "Expenses", "Profit"]}\`

**10. QR Code Generation:**
   - \`{"tool_call": "generate_qr_code", "text": "The text or URL to encode in the QR code."}\`
`;

export const streamMessageToChat = async (
    currentHistory: Content[],
    message: string,
    file: FileAttachment | null,
    location: { latitude: number; longitude: number } | null,
    userProfile: UserProfile | null,
    chatToContinue?: Chat,
    customInstructions?: string, // This will contain the persona's systemInstruction
    isAgentModeEnabled?: boolean,
): Promise<{ stream: AsyncGenerator<GenerateContentResponse>; historyWithUserMessage: Content[], fileContent: string | null }> => {
    
    const ai = getAiInstance();
    
    let basePersonaInstruction = customInstructions || aikonPersonaInstruction;

    // Personalize the instruction
    if (userProfile?.aboutYou) {
        basePersonaInstruction += `\n\n---
**USER PREFERENCES:**
- The user wants you to address them as "${userProfile.aboutYou}". Use this name when appropriate in conversation.`;
    }

    let toolInstructions = aikonAvailableToolsInstruction;
    if (isAgentModeEnabled) {
        toolInstructions = `${aikonAgentWorkflowInstruction}\n\n${aikonAvailableToolsInstruction}`;
    }

    const finalSystemInstruction = `${basePersonaInstruction}\n\n${toolInstructions}`;

    const modelConfig: any = {
        model: defaultModel,
        config: {
            systemInstruction: finalSystemInstruction,
            tools: [{ googleSearch: {} }], // Enable native Google Search by default for standard chat
        }
    };
    
    let fileContent: string | null = null;
    if (file) {
        if (file.mimeType.startsWith('text/')) {
            try {
                fileContent = atob(file.base64);
            } catch (e) {
                console.error("Error decoding base64 file content:", e);
                // Handle error or proceed without file content
            }
        }
    }

    const parts: Part[] = [{ text: message }];

    if (file && file.mimeType.startsWith('image/')) {
        parts.push({
            inlineData: {
                mimeType: file.mimeType,
                data: file.base64,
            },
        });
        modelConfig.model = proModel; // Switch to Pro model for multimodal input
    }
    
    if (location) {
        // Enable both Search and Maps if location is available
        modelConfig.config.tools = [{ googleSearch: {}, googleMaps: {} }];
        modelConfig.config.toolConfig = {
            retrievalConfig: {
                latLng: {
                    latitude: location.latitude,
                    longitude: location.longitude
                }
            }
        };
    }

    const userMessageContent: Content = { role: 'user', parts };
    const historyWithUserMessage = [...currentHistory, userMessageContent];
    
    modelConfig.contents = historyWithUserMessage;

    const stream = await ai.models.generateContentStream(modelConfig);
    return { stream, historyWithUserMessage, fileContent };
};


export const generateImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1'): Promise<string | null> => {
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: flashImageModel,
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
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

export const editImage = async (imageFile: FileAttachment, prompt: string): Promise<string | null> => {
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: flashImageModel,
            contents: {
                parts: [
                    { inlineData: { data: imageFile.base64, mimeType: imageFile.mimeType } },
                    { text: prompt },
                ],
            },
            config: { responseModalities: [Modality.IMAGE] },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Image editing error:", error);
        return null;
    }
}

export const generateVideo = async (): Promise<GenerateVideosOperation | null> => {
    try {
        const ai = getAiInstance();
        // This is a placeholder. You'll need to implement the actual video generation logic.
        // The Gemini API does not yet support video generation in this manner.
        // This is a conceptual implementation.
        console.warn("Video generation is not yet supported by the Gemini API in this library version.");
        return null;
    } catch (error) {
        console.error("Video generation error:", error);
        return null;
    }
};


export const fetchVideoFromUri = async (uri: string): Promise<Blob> => {
    const response = await fetch(`${uri}&key=AIzaSyC1C0lq5AKNIU3LzeD1m53udApAaQQshHs`);
    return await response.blob();
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: ttsModel,
            contents: [{ parts: [{ text: `Say: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Speech generation error:", error);
        return null;
    }
};

export const generatePresentationContent = async (topic: string, numSlides: number): Promise<PresentationData | { error: string }> => {
    const systemPrompt = `You are a presentation content generator. Create a JSON object for a presentation.
The JSON object must have a "slides" array. Each slide object needs a "title" (string) and "content" (an array of strings for bullet points).
Do not include any introductory text or markdown formatting in your response. Just the raw JSON.`;

    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Generate a ${numSlides}-slide presentation on the topic: "${topic}".`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        slides: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    content: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    speakerNotes: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        const result = JSON.parse(response.text.trim());
        return result;
    } catch (error) {
        console.error("Error generating presentation content:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { error: `Failed to generate presentation content. The AI model may be busy or the request timed out. Details: ${errorMessage}` };
    }
};

export const generateWordContent = async (topic: string, sections: string[]): Promise<WordData | { error: string }> => {
     const systemPrompt = `You are a document writer. Create a JSON object for a document with a "title" and a "sections" array.
Each section object needs a "title" and "content" string.
Do not include any introductory text or markdown formatting. Just the raw JSON.`;
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Generate a document about "${topic}" with the following sections: ${sections.join(', ')}.`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        const result = JSON.parse(response.text.trim());
        return result;
    } catch (error) {
        console.error("Error generating Word content:", error);
        return { error: "Failed to generate document content." };
    }
};


export const generateExcelContent = async (dataDescription: string, columns: string[]): Promise<Omit<ExcelData, 'filename'> | { error: string }> => {
    const systemPrompt = `You are a data generation assistant for spreadsheets. Create a JSON object with a "sheets" array.
Each sheet object needs a "sheetName", "headers" array, and a "rows" array (array of arrays).
The data should match the user's description. Generate a realistic number of rows (e.g., 10-20).
Do not include any introductory text or markdown formatting. Just the raw JSON.`;
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Generate spreadsheet data for: "${dataDescription}" with columns: ${columns.join(', ')}.`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sheets: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sheetName: { type: Type.STRING },
                                    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
                                }
                            }
                        }
                    }
                }
            }
        });
        const result = JSON.parse(response.text.trim());
        return result;
    } catch (error) {
        console.error("Error generating Excel content:", error);
        return { error: "Failed to generate spreadsheet data." };
    }
};


// --- AUTONOMOUS AGENT / WORKFLOW FUNCTIONS ---

export const generatePlan = async (goal: string): Promise<{ plan: string[] } | { error: string }> => {
    // FIX: Replaced the brittle 'write -> read -> finish' instruction with a more robust prompt
    // that encourages the planner to use high-level document creation tools directly.
    const systemPrompt = `You are a world-class autonomous agent planner. Your job is to create a step-by-step plan to achieve a user's goal.
The plan should be a simple array of strings. Each string is a clear, high-level step.

**Available Tools for Planning:**
Your plan should be a sequence of actions that can be executed by tools like:
- \`googleSearch\`: To find information.
- \`browse_webpage\`: To read a specific website.
- \`write_file\`: To save intermediate text or data.
- \`create_powerpoint\`: To generate a complete .pptx file.
- \`create_word_document\`: To generate a complete .docx file.
- \`create_excel_spreadsheet\`: To generate a complete .xlsx file.
- \`finish\`: To provide the final text-based answer to the user.

**Key Principles:**
- **Direct Document Creation:** If the goal is to create a professional document (PPT, Word, Excel), your plan should end with a step that explicitly states to create that document. Don't use a complex write/read/finish pattern.
- **Simplicity:** Keep the plan concise and high-level. The executor will handle the details.

**Example:**
- **Goal:** "Research Tesla's Q1 earnings and create a presentation summary."
- **Good Plan:**
  ["Search for Tesla's Q1 2024 earnings report.", "Browse the most relevant search result to extract key information.", "Create a PowerPoint presentation summarizing the key findings."]

Now, generate a plan for the following goal.`;
    
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Goal: ${goal}`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        plan: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });
        const result = JSON.parse(response.text.trim());
        return { plan: result.plan };
    } catch (error) {
        console.error("Error generating plan:", error);
        return { error: "I couldn't create a plan to achieve that goal." };
    }
};

export const runWorkflowStep = async (goal: string, plan: string[], completed_steps: WorkflowStep[]): Promise<{ step_summary: string, tool_call: { name: string, args: any } } | { error: string }> => {
    // FIX: Replaced separate `googleSearch` and `browse_webpage` tools with a single, more reliable `search_and_summarize` tool.
    const availableTools = [
        { name: 'search_and_summarize', description: 'Searches the web for a query and returns a comprehensive summary of the findings. Use this for any research task that requires up-to-date information.', args: { query: 'string' } },
        { name: 'list_files', description: 'List files available in the current session.', args: {} },
        { name: 'read_file', description: 'Read the content of a file from the current session.', args: { filename: 'string' } },
        { name: 'write_file', description: 'Write content to a file in the current session. This is the primary tool for creating documents, reports, code, or any text-based final output. This will create a new file or overwrite an existing one.', args: { filename: 'string', content: 'string' } },
        { name: 'create_powerpoint', description: 'Generates and downloads a complete PowerPoint (.pptx) file on a given topic. Use this to create presentations.', args: { topic: 'string', num_slides: 'number' } },
        { name: 'create_word_document', description: 'Generates and downloads a Word (.docx) document. Use this for reports, articles, or any text-based document.', args: { topic: 'string', sections: 'string[]' } },
        { name: 'create_excel_spreadsheet', description: 'Generates and downloads an Excel (.xlsx) file with sample data. Use this for creating spreadsheets.', args: { filename: 'string', data_description: 'string', columns: 'string[]' } },
        { name: 'request_user_approval', description: 'Ask the user for approval to proceed with a potentially sensitive or irreversible action.', args: { question: 'string' } },
        { name: 'finish', description: 'Call this tool ONLY when the goal is fully achieved or is impossible to complete. The final, complete answer must be provided in the \'final_content\' argument.', args: { final_content: 'string' } },
    ];

    // FIX: Updated core directives to reflect the new `search_and_summarize` tool.
    const systemPrompt = `You are a world-class autonomous agent executor. Your job is to decide the very next step to achieve a user's goal.
You are given the goal, plan, and completed steps. You must decide which single tool to call next.

**CORE DIRECTIVES:**
1.  **JSON RESPONSE:** Your response MUST be a single, valid JSON object. This object must contain two keys: "step_summary" (a string describing your action) and "tool_call" (an object with "name" and "args" keys). Do not add any text or markdown outside of this single JSON object.
2.  **TOOL USAGE:**
    - **Content Creation:** To create any text, document, report, or code, you MUST use the \`write_file\` tool. For generating professional documents like PPTX, DOCX, or XLSX, use the specific tools provided (\`create_powerpoint\`, etc.).
    - **Research Strategy:** Use the \`search_and_summarize\` tool to perform research. This tool directly returns a summary, so you do not need to browse individual web pages.
    - **Finishing:** When the goal is fully achieved and the final content has been written to a file or is ready to be delivered, use the \`finish\` tool.
3.  **ERROR HANDLING & RESILIENCE:**
    - If a tool fails (e.g., \`browse_webpage\` returns an error), DO NOT GIVE UP. Analyze the error and the previous steps.
    - If \`browse_webpage\` fails, look at your last \`googleSearch\` results and try a DIFFERENT, promising URL from the list.
    - If you are truly stuck after multiple retries or the goal is impossible (e.g., the user is asking for something that doesn't exist), use the \`finish\` tool and clearly explain the problem in the 'final_content' argument.

**AVAILABLE TOOLS:**
${JSON.stringify(availableTools.map(({ name, description }) => ({ name, description })))}

**CONTEXT:**
- Goal: ${goal}
- Plan: ${JSON.stringify(plan)}
- Completed Steps: ${JSON.stringify(completed_steps.map(s => ({ summary: s.summary, tool: s.tool_call?.name, output_preview: JSON.stringify(s.tool_output)?.substring(0, 100) + '...' })))}

Based on the context, decide the single next action to take and respond with the JSON object as instructed.`;

    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Based on the context, select the next tool to call.`,
            config: {
                systemInstruction: systemPrompt,
            }
        });
        const text = response.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        console.error("Agent did not return a valid JSON object:", text);
        return { error: "The AI agent returned an invalid (non-JSON) response. It may be confused by the current step." };
    } catch (error) {
        console.error("Error running workflow step:", error);
        throw error;
    }
};

// --- PRE-BUILT TOOL FUNCTIONS (for simplified, direct tool calls) ---

export const summarizeDocument = async (content: string): Promise<string> => {
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: `Please summarize the following document:\n\n${content}`,
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing document:", error);
        throw error;
    }
};

export const performGoogleSearch = async (query: string): Promise<{ text: string | null; sources: Source[] }> => {
    return getCompetitorInsights(`The user is asking: "${query}". Please provide a comprehensive answer based on Google Search results.`);
};

export const browseWebpage = async (url: string, question: string): Promise<string> => {
     try {
        const response = await fetch(`https://web-proxy.labs.google.com/v1/web/page?url=${encodeURIComponent(url)}&key=${"AIzaSyC1C0lq5AKNIU3LzeD1m53udApAaQQshHs"}`);
        if (!response.ok) {
            return `Error: Could not fetch content from ${url}. Status: ${response.status}`;
        }
        const textContent = await response.text();
        return await analyzeBrowsedContent(textContent, question);
    } catch (error: any) {
        console.error("Error browsing webpage:", error);
        return `Error: An exception occurred while trying to browse the webpage: ${error.message}`;
    }
};

export const analyzeBrowsedContent = async (content: string, userQuery: string): Promise<string> => {
    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: `
You are AikonAI. You have just browsed a website to help the user.

**User's Goal/Question:** "${userQuery}"

**Website Content:**
${content}

**Instructions:**
1.  **Analyze** the website content deepy to answer the user's request.
2.  **Synthesize** the information. Do not just copy-paste chunks.
3.  **Format** the response beautifully using Markdown:
    - Use **Bold** for key concepts.
    - Use headers (###) for logical sections.
    - Use bullet points for lists.
    - Use > blockquotes for important insights.
    - Create tables if comparing data.
4.  If the content is not relevant, say so clearly.
5.  Your tone should be professional, engaging, and highly informative.
`,
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing browsed content:", error);
        return "I browsed the website, but I encountered an error while analyzing its content.";
    }
};