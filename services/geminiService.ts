import { GoogleGenAI, GenerateContentResponse, Chat, Part, GroundingChunk, GenerateVideosOperation, Content, Modality, Type } from "@google/genai";
import { FileAttachment, Source, WorkflowStep, StructuredToolOutput, PresentationData, WordData, ExcelData } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.warn("API_KEY environment variable not set. AikonAI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const defaultModel = 'gemini-2.5-flash';
const proModel = 'gemini-2.5-pro';
// User-specified model for video generation
// FIX: Updated deprecated veo model to a supported one.
const veoModel = 'veo-3.1-fast-generate-preview';
const flashImageModel = 'gemini-2.5-flash-image';
// User-specified model for image generation
// FIX: Updated deprecated imagen model to a supported one.
const imagenModel = 'imagen-4.0-generate-001';
const ttsModel = 'gemini-2.5-flash-preview-tts';


// Generic content generation for home page features
export const generateSimpleText = async (systemPrompt: string, userQuery: string): Promise<string | null> => {
    if (!API_KEY) return "API Key not configured.";
    try {
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: userQuery,
            config: { systemInstruction: systemPrompt },
        });
        return response.text;
    } catch (error) {
        console.error("Error generating simple text:", error);
        return "Sorry, I couldn't generate a response at this moment.";
    }
};

// Competitor insights with Google Search grounding
export const getCompetitorInsights = async (prompt: string): Promise<{ text: string | null; sources: Source[] }> => {
    if (!API_KEY) return { text: "API Key not configured.", sources: [] };
    try {
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
        return { text: "Sorry, I couldn't fetch insights at this moment.", sources: [] };
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


const aikonToolsInstruction = `---

**AUTONOMOUS WORKFLOWS:**
- **Trigger:** For complex, multi-step tasks (e.g., "analyze this CSV and create a presentation", "research Tesla stock and tell me if I should buy it"), you MUST autonomously initiate a workflow.
- **Action:** Instead of a normal response, you will output a JSON object with the tool call \`initiate_workflow\`.
- **Format:** \`{"tool_call": "initiate_workflow", "goal": "A summary of the user's most recent request. This goal MUST NOT include any information from previous messages in the conversation."}\`
- **Example:** For "research the latest AI trends and write a blog post", you output: \`{"tool_call": "initiate_workflow", "goal": "Research the latest AI trends and write a blog post about them."}\`
- **IMPORTANT:** Do NOT attempt to solve the multi-step task yourself. ALWAYS use the \`initiate_workflow\` tool. Only use this for tasks requiring multiple tools or steps. For simple, single-tool tasks (like getting weather), use the appropriate tool directly.

---

**AVAILABLE TOOLS (Single-step tasks):**
For any of the tools below, you MUST ONLY respond with the corresponding JSON object. Do NOT add any conversational text before or after the JSON.

**1. Web Search & Browsing:**
   - **Search:** \`{"tool_call": "google_search", "query": "Your search query here"}\`
   - **Browse Webpage:** \`{"tool_call": "browse_webpage", "url": "https://example.com"}\`

**2. Email:**
   - **Send Email:** When a user asks to send an email, use this tool. The system will handle authentication. You must extract the recipient's email, a subject line, and the body content from the user's request.
   - **Format:** \`{"tool_call": "send_email", "recipient": "email@example.com", "subject": "Email Subject", "body": "The content of the email."}\`

**3. Weather:**
   - \`{"tool_call": "get_weather", "city": "City Name"}\`

**4. Image Generation & Editing:**
   - **Generate:** \`{"tool_call": "generate_image", "prompt": "A detailed description of the image.", "aspectRatio": "16:9"}\` (Supported aspect ratios: '1:1', '16:9', '9:16', '4:3', '3:4')
   - **Edit:** \`{"tool_call": "edit_image", "prompt": "Instructions for editing the uploaded image."}\` (Requires an image to be uploaded by the user).

**5. Video Generation:**
   - \`{"tool_call": "generate_video", "prompt": "A detailed description of the video."}\`

**6. Document Summarization:**
   - \`{"tool_call": "summarize_document"}\` (Requires a text document to be uploaded by the user).

**7. Storyboard Creation:**
    - \`{"tool_call": "create_storyboard", "prompts": ["scene 1 description", "scene 2 description", ...]}\` (Generates up to 4 panels).

**8. Text-to-Speech:**
   - \`{"tool_call": "text_to_speech", "text": "The text to convert to audio."}\`
`;

export const streamMessageToChat = async (
    currentHistory: Content[],
    message: string,
    file: FileAttachment | null,
    location: { latitude: number; longitude: number } | null,
    chatToContinue?: Chat,
    customInstructions?: string, // This will contain the persona's systemInstruction
): Promise<{ stream: AsyncGenerator<GenerateContentResponse>; historyWithUserMessage: Content[], fileContent: string | null }> => {

    let finalSystemInstruction: string;

    // A persona instruction (from Persona selector) or custom instructions (from settings) will be passed here.
    if (customInstructions) {
        // When a persona is active, its instruction COMPLETELY REPLACES the default AikonAI personality.
        // The tool instructions are always appended to ensure the persona can still use its full capabilities.
        finalSystemInstruction = `${customInstructions}\n\n${aikonToolsInstruction}`;
    } else {
        // No persona is active, so use the default AikonAI personality combined with the tool instructions.
        finalSystemInstruction = `${aikonPersonaInstruction}\n\n${aikonToolsInstruction}`;
    }

    const modelConfig: any = {
        model: defaultModel,
        config: {
            systemInstruction: finalSystemInstruction,
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
        // FIX: When providing location data via `toolConfig`, the API requires the corresponding
        // tool (`googleMaps`) to be explicitly enabled in the `tools` array.
        // This resolves an "Ambiguous request" 404 error from the backend.
        modelConfig.config.tools = [{ googleMaps: {} }];
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
    if (!API_KEY) return null;
    try {
        const response = await ai.models.generateImages({
            model: imagenModel,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio,
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (error) {
        console.error("Image generation error:", error);
        return null;
    }
};

export const editImage = async (imageFile: FileAttachment, prompt: string): Promise<string | null> => {
     if (!API_KEY) return null;
    try {
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

export const fetchVideoFromUri = async (uri: string): Promise<Blob> => {
    const response = await fetch(`${uri}&key=${API_KEY}`);
    return await response.blob();
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    if (!API_KEY) return null;
    try {
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
    const availableTools = [
        { name: 'googleSearch', description: 'Search Google for up-to-date information. Use for news, facts, or any external data. Returns a list of search results with URLs.', args: { query: 'string' } },
        { name: 'browse_webpage', description: 'Fetches the content of a single webpage URL and returns a text summary. Use this AFTER googleSearch to "read" one of the search results.', args: { url: 'string' } },
        { name: 'list_files', description: 'List files available in the current session.', args: {} },
        { name: 'read_file', description: 'Read the content of a file from the current session.', args: { filename: 'string' } },
        { name: 'write_file', description: 'Write content to a file in the current session. This is the primary tool for creating documents, reports, code, or any text-based final output. This will create a new file or overwrite an existing one.', args: { filename: 'string', content: 'string' } },
        { name: 'create_powerpoint', description: 'Generates and downloads a complete PowerPoint (.pptx) file on a given topic. Use this to create presentations.', args: { topic: 'string', num_slides: 'number' } },
        { name: 'create_word_document', description: 'Generates and downloads a Word (.docx) document. Use this for reports, articles, or any text-based document.', args: { topic: 'string', sections: 'string[]' } },
        { name: 'create_excel_spreadsheet', description: 'Generates and downloads an Excel (.xlsx) file with sample data. Use this for creating spreadsheets.', args: { filename: 'string', data_description: 'string', columns: 'string[]' } },
        { name: 'request_user_approval', description: 'Ask the user for approval to proceed with a potentially sensitive or irreversible action.', args: { question: 'string' } },
        { name: 'finish', description: 'Call this tool ONLY when the goal is fully achieved or is impossible to complete. The final, complete answer must be provided in the \'final_content\' argument.', args: { final_content: 'string' } },
    ];

    const systemPrompt = `You are a world-class autonomous agent executor. Your job is to decide the very next step to achieve a user's goal.
You are given the goal, plan, and completed steps. You must decide which single tool to call next.

**CORE DIRECTIVES:**
1.  **JSON RESPONSE:** Your response MUST be a single, valid JSON object. This object must contain two keys: "step_summary" (a string describing your action) and "tool_call" (an object with "name" and "args" keys). Do not add any text or markdown outside of this single JSON object.
2.  **TOOL USAGE:**
    - **Content Creation:** To create any text, document, report, or code, you MUST use the \`write_file\` tool. For generating professional documents like PPTX, DOCX, or XLSX, use the specific tools provided (\`create_powerpoint\`, etc.).
    - **Research Strategy:** First, use \`googleSearch\` to find relevant URLs. Then, analyze the results and use \`browse_webpage\` on the single best URL.
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
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Based on the context, select the next tool to call.`,
            config: {
                systemInstruction: systemPrompt,
                // REASON: This configuration can be brittle. The model is already heavily prompted to return JSON.
                // Removing this may prevent potential SDK/API errors (like HTTP status 0) if the model
                // occasionally fails to generate a response that strictly adheres to the MIME type.
                // The parsing logic below is robust enough to handle JSON within a text block.
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
        return { error: "I encountered an error while trying to execute the next step." };
    }
};

// --- PRE-BUILT TOOL FUNCTIONS (for simplified, direct tool calls) ---

export const summarizeDocument = async (content: string): Promise<string> => {
    if (!API_KEY) return "API Key not configured.";
    try {
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: `Please summarize the following document:\n\n${content}`,
        });
        return response.text;
    } catch (error) {
        return "Sorry, I was unable to summarize the document.";
    }
};

export const performGoogleSearch = async (query: string): Promise<{ text: string | null; sources: Source[] }> => {
    return getCompetitorInsights(`The user is asking: "${query}". Please provide a comprehensive answer based on Google Search results.`);
};

export const browseWebpage = async (url: string): Promise<string> => {
    if (!API_KEY) return "API Key not configured.";

    let targetUrl = url;
    // Heuristic to detect and rewrite Vertex AI Search's proxied URLs into their original form.
    // Example proxied URL: https://vertexaisearch.cloud.google.com/.../documents/en.wikipedia.org%2Fwiki%2FVishnu
    const vertexPattern = /vertexaisearch\.cloud\.google\.com\/.*documents\/([^\?]+)/;
    const match = url.match(vertexPattern);

    if (match && match[1]) {
        try {
            const decodedPath = decodeURIComponent(match[1]);
            // The decoded path is often just the domain and path, e.g., "en.wikipedia.org/wiki/Vishnu"
            targetUrl = `https://${decodedPath}`;
        } catch (e) {
            console.warn("Could not decode Vertex AI Search URL path:", match[1]);
            // Fallback to original URL if decoding fails
            targetUrl = url;
        }
    }

    try {
        // Use a CORS proxy to fetch website content from the client-side.
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch from proxy with status: ${response.status}`);
        }
        const data = await response.json();
        const htmlContent = data.contents;

        if (!htmlContent) {
            return `I was able to connect to ${targetUrl}, but could not find any readable content. The page might be empty or heavily reliant on JavaScript.`;
        }

        // Create a temporary DOM element to parse and clean the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Remove irrelevant tags to focus on main content
        tempDiv.querySelectorAll('script, style, nav, footer, header, aside, form, button, input').forEach(el => el.remove());

        // Get the text content, which strips remaining HTML tags
        let textContent = tempDiv.textContent || tempDiv.innerText || "";
        
        // Clean up excessive whitespace and newlines
        textContent = textContent.replace(/\s\s+/g, ' ').trim();

        if (textContent.length < 50) {
            return `Could not extract enough meaningful text from ${targetUrl}. The page might be a login portal or an application.`;
        }

        // The text content might still be very long, so summarize it with Gemini for a clean response.
        const summarizationPrompt = `Please provide a concise summary of the following text content that was extracted from the website ${targetUrl}. Focus on the main purpose of the site, its key offerings, and what it is about.\n\n---\n\n${textContent.substring(0, 8000)}\n\n---`;

        const summaryResponse = await ai.models.generateContent({
            model: defaultModel,
            contents: summarizationPrompt,
        });

        return summaryResponse.text;

    } catch (error) {
        console.error(`Error fetching or processing webpage ${targetUrl}:`, error);
        return `Error: I encountered a technical problem while trying to access the content of ${targetUrl}. The website might be blocking automated access or is temporarily unavailable.`;
    }
};


// --- DOCUMENT CONTENT GENERATION ---

export const generatePresentationContent = async (topic: string, num_slides: number): Promise<PresentationData | { error: string }> => {
    const systemPrompt = "You are an expert presentation creator. Generate the content for a slide deck in JSON format based on the user's topic. For each slide, provide a concise title and a few bullet points (as an array of strings). Do not include a title slide in the JSON data, only the content slides.";
    try {
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Topic: "${topic}", Number of slides: ${num_slides}`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        slides: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    content: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ["title", "content"]
                            }
                        }
                    },
                    required: ["slides"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error generating presentation content:", error);
        return { error: "Failed to generate content for the presentation." };
    }
}

export const generateWordContent = async (topic: string, sections: string[]): Promise<WordData | { error: string }> => {
    const systemPrompt = "You are an expert writer. Generate the content for a document in JSON format. The user will provide a topic and a list of section titles. For each section, write a detailed paragraph or two of content.";
    try {
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Topic: "${topic}", Sections: ${JSON.stringify(sections)}`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
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
                                },
                                required: ["title", "content"]
                            }
                        }
                    },
                    required: ["title", "sections"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error generating document content:", error);
        return { error: "Failed to generate content for the document." };
    }
}

export const generateExcelContent = async (data_description: string, columns: string[]): Promise<Omit<ExcelData, 'filename'> | { error: string }> => {
    const systemPrompt = "You are a data generation expert. Create sample data in JSON format based on a description and column headers. Generate 10-20 rows of realistic data. The 'rows' field should be an array of arrays, where each inner array corresponds to a row.";
    try {
        const response = await ai.models.generateContent({
            model: proModel,
            contents: `Data Description: "${data_description}", Columns: ${JSON.stringify(columns)}. Please generate the data.`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
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
                                    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { oneOf: [{type: Type.STRING}, {type: Type.NUMBER}] } } }
                                },
                                required: ["sheetName", "headers", "rows"]
                            }
                        }
                    },
                    required: ["sheets"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error generating excel data:", error);
        return { error: "Failed to generate data for the spreadsheet." };
    }
}