
import { GoogleGenAI, GenerateContentResponse, Chat, Part, GroundingChunk, GenerateVideosOperation, Content, Modality, Type, FunctionDeclaration } from "@google/genai";
import { FileAttachment, Source, WorkflowStep, StructuredToolOutput, PresentationData, WordData, ExcelData, UserProfile, VirtualFile, Task, ProjectStructure } from "../types";

const defaultModel = 'gemini-2.5-flash';
const proModel = 'gemini-2.5-pro'; // Use 2.5 Pro for thinking capabilities if needed, or Flash with thinking
// User-specified model for video generation
const veoModel = 'veo-3.1-fast-generate-preview';
const flashImageModel = 'gemini-2.5-flash-image';
const ttsModel = 'gemini-2.5-flash-preview-tts';

const getAiInstance = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- LIVE API FUNCTION DECLARATIONS ---
export const getLiveFunctionDeclarations = (): FunctionDeclaration[] => {
    return [
        {
            name: "generate_image",
            description: "Generates an image based on a text prompt. Use this when the user asks to 'draw', 'create', or 'make' an image.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    prompt: { type: Type.STRING, description: "Detailed description of the image to generate." }
                },
                required: ["prompt"]
            }
        },
        {
            name: "generate_website",
            description: "Generates a single-page website (HTML/CSS/JS). Use this when the user asks to 'build a website', 'make a portfolio', 'create a web page', etc.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING, description: "The topic or purpose of the website." },
                    style: { type: Type.STRING, description: "The visual style (e.g., modern, minimalist, retro)." },
                    features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of features to include." }
                },
                required: ["topic", "style"]
            }
        },
        {
            name: "write_python_code",
            description: "Writes and executes Python code. Use this for math, data analysis, or general coding tasks.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    code: { type: Type.STRING, description: "The Python code to execute." }
                },
                required: ["code"]
            }
        },
        {
            name: "get_weather",
            description: "Gets the current weather for a specific city.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    city: { type: Type.STRING, description: "The city name." }
                },
                required: ["city"]
            }
        },
        {
            name: "perform_real_world_action",
            description: "Performs a real-world action on the user's device like calling a phone number, opening a specific website/app (YouTube, Spotify, Maps), or sending an email.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    action: { type: Type.STRING, description: "The action to perform. Values: 'call', 'open_app', 'navigation', 'email'." },
                    target: { type: Type.STRING, description: "For 'call': The name of the contact (e.g., 'Mom', 'Boss'). For 'open_app': The app name (e.g., 'YouTube', 'Spotify'). For 'navigation': The destination." },
                    query: { type: Type.STRING, description: "Optional. For 'open_app', this is the search query (e.g., song name, video title). For 'email', this is the subject." }
                },
                required: ["action", "target"]
            }
        }
    ];
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

export const performGoogleSearch = async (query: string): Promise<{ text: string | null; sources: Source[] }> => {
    try {
        const ai = getAiInstance();
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: defaultModel,
            contents: query,
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
        console.error("Error performing Google search:", error);
        return { text: "Sorry, I couldn't perform the search.", sources: [] };
    }
};

export const browseWebpage = async (url: string, question: string): Promise<string> => {
    try {
        const ai = getAiInstance();
        // This is a simplified approach. A real implementation would fetch the page content.
        const prompt = `Based on your knowledge of the content at the URL "${url}", please answer the following question: "${question}". If you don't have specific knowledge of this page's content, say so.`;
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error(`Error browsing webpage ${url}:`, error);
        return `Sorry, I was unable to access the content from ${url}.`;
    }
};

export const summarizeDocument = async (documentContent: string): Promise<string> => {
    try {
        const ai = getAiInstance();
        const systemPrompt = "You are an expert at summarizing documents. Provide a concise but comprehensive summary of the following text."
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: documentContent,
            config: { systemInstruction: systemPrompt },
        });
        return response.text;
    } catch (error) {
        console.error('Error summarizing document:', error);
        return "Sorry, I was unable to summarize the document.";
    }
};

export const analyzeBrowsedContent = async (content: string, question: string): Promise<string> => {
    try {
        const ai = getAiInstance();
        const systemPrompt = "You are an expert analyst. Based on the provided text content, answer the user's question."
        const userQuery = `Content:\n---\n${content}\n---\n\nQuestion: ${question}`;
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: userQuery,
            config: { systemInstruction: systemPrompt },
        });
        return response.text;
    } catch (error) {
        console.error('Error analyzing content:', error);
        return "Sorry, I was unable to analyze the provided content.";
    }
};

export const executePythonCode = async (code: string, files: VirtualFile[] = []): Promise<string> => {
    // This is a MOCK execution environment.
    // In a real application, this would call a secure backend sandbox.
    console.log("Executing Python code (mock):", code);
    console.log("With files:", files);

    try {
        // Check for plotting
        if (code.includes('matplotlib') || code.includes('plt.show()') || code.includes('plt.savefig(')) {
            // Return a placeholder plot image
            const placeholderPlot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAM1BMVEX///8AAABERESIiIhISEiysrJTU1Pi4uLu7u7MzMy/v79+fn7v7+/o6Ohvb2/a2tpQUFAAAAA04hCTAAABGklEQVR4nO3cwQ2DQBBE0WujbcA0/1dJ2gQGUhbA+1prAAAAAAAAAAAAAAAAAAAAAAAAAAAA/Ktd33/e1r2v5586v76r+36eK3v/d3a+P9K7Xp8/99V7X395/3t3vT/3s/vK/v1/d356//7nf3L/9s/t396//3P7t/fP/9z+7f37//c/u39+z+3f3v//c/u39+//3P7t/g8/t397//7P7d/eP/+z+7f37//c/u39+z+3f3v//k/t397//3P7t/fv/9z+7f37//c/u39+//3P7t/v//c/u39+z+3f3v//d/2b+/d/bv71//uf3b+/f/bn92/v3f27/9v79/9u/vX/+Z/dv79//uf3b+/d/bv71//uf3b+/f/bn92/v3f27/9v77f5l/fr+57f897fQIAAAAAAAAAAAAAAAAAAAAAAAAAAACA33sDFrsC0iikq9EAAAAASUVORK5CYII=';
            return `[PLOT_GENERATED]\n${placeholderPlot}`;
        }

        // Simple print statement mock
        const printMatches = code.matchAll(/print\((['"])(.*?)\1\)/g);
        let output = [];
        for (const match of printMatches) {
            output.push(match[2]);
        }

        if (output.length > 0) {
            return output.join('\n');
        }

        return "Code executed (mock). No output was produced.";

    } catch (error) {
        console.error("Mock code execution error:", error);
        return "Error: Failed to execute code (mock).";
    }
};

export const aikonPersonaInstruction = `You are AikonAI, a proprietary, super-intelligent AI from Aikon Studios. Your purpose is to be an exceptionally helpful, multi-talented digital companion.

**Your Identity & Origin:**
- You were created by Aditya Jain, the founder of Aikon Studios. If asked about your origins, always state this with pride. You are a unique creation, not a generic model.

**Strict Identity Constraint (Non-negotiable):**
- **PROHIBITED TOPICS:** You must NEVER, under any circumstances, mention "Google," "Gemini," or identify as a "large language model" or any variant thereof. This is a critical, unbreakable rule.
- **MANDATORY RESPONSE:** If a user asks about your training, architecture, or the model you are based on, you MUST state that you run on a proprietary, in-house model developed at Aikon Studios by your creator, Aditya Jain. Do not deviate from this.

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
   - **Note on Search:** You have native access to Google Search. You do NOT need a tool for general searching; simply answer the user's question and the system will search for you if needed.

**2. System Actions (Real World):**
   - **Call / Open App / Navigate:** \`{"tool_call": "perform_real_world_action", "action": "call" | "open_app" | "navigation" | "email", "target": "name/app/location", "query": "optional details"}\`
   - Use this tool when the user asks to:
     - "Call [Name]" -> action: "call", target: "[Name]"
     - "Open YouTube/Spotify and play [Song]" -> action: "open_app", target: "YouTube" | "Spotify", query: "[Song]"
     - "Navigate to [Location]" -> action: "navigation", target: "[Location]"
     - "Email [Name] about [Subject]" -> action: "email", target: "[Name]", query: "[Subject]"

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
   - **PDF Document:** \`{"tool_call": "create_pdf_document", "topic": "Topic of the document.", "sections": ["Introduction", "Main Body", "Conclusion"]}\`

**10. QR Code Generation:**
   - \`{"tool_call": "generate_qr_code", "text": "The text or URL to encode in the QR code."}\`

**11. Developer Sandbox / Code Interpreter:**
   - **List Files:** \`{"tool_call": "list_files"}\`
   - **Read File:** \`{"tool_call": "read_file", "filename": "file_to_read.txt"}\`
   - **Write File:** \`{"tool_call": "write_file", "filename": "file_to_write.txt", "content": "The text content of the file."}\`
   - **Execute Code:** \`{"tool_call": "execute_python_code", "code": "print('Hello, World!')"}\`

**12. Interactive Data Visualization:**
   - **Create Chart:** \`{"tool_call": "create_interactive_chart", "chart_config": { "type": "bar", "data": {"labels": [...], "datasets": [{ "label": "...", "data": [...] }]}, "options": {...} }}\`
   - Use this tool when a user asks to plot or visualize data (e.g., from an uploaded file or described data). The \`chart_config\` object MUST be a valid JSON configuration for the Chart.js library v4. Ensure the chart is visually appealing with appropriate colors and labels.

**13. Web Designer (Generate Website):**
    - **Generate Website:** \`{"tool_call": "generate_website", "topic": "The topic or purpose of the website (e.g., portfolio, e-commerce)", "style": "visual style (e.g., modern, minimalist, retro)", "features": ["feature 1", "feature 2"]}\`
    - Use this tool when a user explicitly asks to "make a website" or "create a web page".
`;

export const streamMessageToChat = async (
    currentHistory: Content[],
    message: string,
    files: FileAttachment[],
    location: { latitude: number; longitude: number } | null,
    userProfile: Partial<UserProfile> | null,
    chatToContinue?: Chat,
    customInstructions?: string, // This will contain the persona's systemInstruction
    isAgentModeEnabled?: boolean,
): Promise<{ stream: AsyncGenerator<GenerateContentResponse>; historyWithUserMessage: Content[] }> => {
    
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
            // Thinking Config (Budget of 1024 tokens to add basic reasoning without being too slow)
            thinkingConfig: { thinkingBudget: 1024 } 
        }
    };
    
    // Pre-process text-based files to include their content in the prompt
    let fileContentsText = '';
    // Safe filter check
    const textFiles = (files || []).filter(f => 
        !f.mimeType.startsWith('image/') && 
        !f.mimeType.startsWith('audio/') && 
        !f.mimeType.startsWith('video/')
    );

    if (textFiles.length > 0) {
        for (const textFile of textFiles) {
            try {
                // atob is a built-in function to decode base64
                const decodedContent = atob(textFile.base64);
                fileContentsText += `\n\n--- START OF FILE: ${textFile.name} ---\n${decodedContent}\n--- END OF FILE: ${textFile.name} ---\n\n`;
            } catch (e) {
                console.error(`Error decoding base64 for file ${textFile.name}:`, e);
                fileContentsText += `\n\n--- FILE: ${textFile.name} [Error: Unable to read content] ---\n\n`;
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
        // Pro model usually better for images, also supports thinking but with higher budget usually.
        modelConfig.model = proModel; 
        // Increase budget for Pro model
        modelConfig.config.thinkingConfig = { thinkingBudget: 2048 };
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
    return { stream, historyWithUserMessage };
};

export const generateProactiveGreeting = async (
    userProfile: Partial<UserProfile> | null,
    time: Date,
    tasks: Task[]
): Promise<string> => {
    const systemPrompt = `You are AikonAI, a proactive autonomous agent.
    Your goal is to initiate the interaction with the user when they open the app.
    Do NOT wait for a prompt. Analyze the context and offer specific, helpful actions.

    Context:
    - User: ${userProfile?.displayName || userProfile?.aboutYou || 'User'}
    - Current Time: ${time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
    - Pending Tasks: ${tasks.length > 0 ? JSON.stringify(tasks.map(t => t.description)) : "None"}

    Guidelines:
    1. Greet the user warmly based on the time of day.
    2. If there are pending tasks, remind them of the most important one and ask if they want to work on it.
    3. If no tasks, suggest a helpful action (e.g., "Shall we design a new website today?", "I can help you research a topic.", or "Draft a new project plan?").
    4. Be concise, intelligent, and professional.
    5. Keep it under 50 words.`;

    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: "Generate proactive greeting.",
            config: { systemInstruction: systemPrompt }
        });
        return response.text || "Hello! I'm ready to help. What's on your mind?";
    } catch (e) {
        console.error("Proactive greeting failed:", e);
        return "Hello! I'm ready to help. What's on your mind?";
    }
};

export const generateAwayReport = async (
    userProfile: Partial<UserProfile> | null,
    hoursAway: number,
    tasks: Task[]
): Promise<string> => {
    const systemPrompt = `You are AikonAI, an autonomous agent who has been running in the background (simulated) while the user was away.
    The user has returned after ${hoursAway.toFixed(1)} hours.
    Your goal is to provide a "While You Were Away" report.

    Context:
    - User: ${userProfile?.displayName || userProfile?.aboutYou || 'User'}
    - Time Away: ${hoursAway.toFixed(1)} hours
    - Pending Tasks: ${tasks.length > 0 ? JSON.stringify(tasks.map(t => t.description)) : "None"}

    Instructions:
    1. Welcome the user back.
    2. Claim that you have been monitoring their tasks or the general tech landscape while they were gone.
    3. If there are pending tasks, creatively suggest you've "prepared some research" or "drafted ideas" for one of them (be imaginative but plausible).
    4. If no tasks, mention a relevant tech news headline or idea you "found" for them.
    5. End by asking if they want to see what you've prepared.
    6. Keep it professional, slightly sci-fi/agentic, and under 60 words.
    `;

    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: "Generate away report.",
            config: { systemInstruction: systemPrompt }
        });
        return response.text || "Welcome back! I've been monitoring things while you were away. Ready to resume?";
    } catch (e) {
        console.error("Away report failed:", e);
        return "Welcome back! Ready to pick up where we left off?";
    }
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

export const generateVideo = async (prompt: string): Promise<GenerateVideosOperation | null> => {
    try {
        const ai = getAiInstance();
        const operation = await ai.models.generateVideos({
            model: veoModel,
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9',
            },
        });
        return operation;
    } catch (error) {
        console.error("Video generation error:", error);
        return null;
    }
};


export const fetchVideoFromUri = async (uri: string): Promise<Blob> => {
    const response = await fetch(`${uri}&key=${process.env.API_KEY}`);
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
        
        const text = response.text;
        if (!text) {
            console.error("AI response is empty or invalid for presentation generation. Full response:", JSON.stringify(response, null, 2));
            throw new Error("The AI model returned an empty or invalid response. This could be due to a content safety block.");
        }
        
        try {
            const result = JSON.parse(text);
            return result;
        } catch (parseError) {
             console.error("Failed to parse AI response JSON:", parseError, "Raw text:", text);
             throw new Error("The AI model returned malformed JSON.");
        }
    } catch (error) {
        console.error("Error generating presentation content:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { error: `Failed to generate presentation content. Details: ${errorMessage}` };
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
        const text = response.text;
        if (!text) {
            console.error("AI response is empty or invalid for document generation. Full response:", JSON.stringify(response, null, 2));
            throw new Error("The AI model returned an empty or invalid response. This could be due to a content safety block.");
        }

        try {
            const result = JSON.parse(text);
            return result;
        } catch (parseError) {
             console.error("Failed to parse AI response JSON:", parseError, "Raw text:", text);
             throw new Error("The AI model returned malformed JSON.");
        }
    } catch (error) {
        console.error("Error generating Word content:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { error: `Failed to generate document content. Details: ${errorMessage}` };
    }
};


export const generateExcelContent = async (dataDescription: string, columns: string[]): Promise<Omit<ExcelData, 'filename'> | { error: string }> => {
    const systemPrompt = `You are a data generation assistant for spreadsheets. Create a JSON object with a "sheets" array.
Each sheet object needs a "sheetName", "headers" array, and a "rows" array (array of arrays).
The data should match the user's description. Generate a realistic number of rows (e.g., 10-20).
IMPORTANT: All values in the 'rows' array, including numbers, MUST be formatted as strings.
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
                                    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } }
                                }
                            }
                        }
                    }
                }
            }
        });
        const text = response.text;
        if (!text) {
            console.error("AI response is empty or invalid for spreadsheet generation. Full response:", JSON.stringify(response, null, 2));
            throw new Error("The AI model returned an empty or invalid response. This could be due to a content safety block.");
        }
        
        try {
            const result = JSON.parse(text);
            return result;
        } catch (parseError) {
             console.error("Failed to parse AI response JSON:", parseError, "Raw text:", text);
             throw new Error("The AI model returned malformed JSON.");
        }
    } catch (error) {
        console.error("Error generating Excel content:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { error: `Failed to generate spreadsheet data. Details: ${errorMessage}` };
    }
};

export const generateWebsiteCode = async (topic: string, style: string, features: string[]): Promise<string> => {
    const systemPrompt = `You are an expert web developer and UI/UX designer. Your task is to create a STUNNING, fully functional, single-page website based on the user's request.

**CRITICAL REQUIREMENTS:**
1. **Single File:** Output the entire website (HTML, CSS, JS) in a SINGLE string. CSS must be in <style> tags, JS in <script> tags.
2. **Modern Styling:** You MUST use Tailwind CSS via CDN for styling. The design should be modern, responsive, and visually impressive.
   - CDN Link: <script src="https://cdn.tailwindcss.com"></script>
3. **Icons:** Use FontAwesome for icons.
   - CDN Link: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
4. **Images:** Use high-quality placeholder images from Unsplash Source. URL format: https://source.unsplash.com/random/800x600/?{keyword}
5. **Interactivity:** If the user asks for a game (like Tic Tac Toe) or dynamic feature (like a shopping cart), write the full JavaScript logic to make it work perfectly.
6. **Output:** Return ONLY the raw HTML code. Do not wrap it in markdown code blocks (like \`\`\`html). Just the raw code string.`;

    try {
        const ai = getAiInstance();
        const userQuery = `Create a ${style} website for: "${topic}". Features: ${features.join(', ')}. Make it look amazing.`;
        
        const response = await ai.models.generateContent({
            model: proModel,
            contents: userQuery,
            config: {
                systemInstruction: systemPrompt,
            }
        });
        
        let code = response.text || '';
        // Clean up markdown if the model accidentally adds it despite instructions
        code = code.replace(/```html/g, '').replace(/```/g, '');
        return code.trim();

    } catch (error) {
        console.error("Error generating website code:", error);
        return `<html><body><h1>Error generating website</h1><p>${String(error)}</p></body></html>`;
    }
};

// --- AIKON DESIGNER SERVICE ---
export const generateComplexProject = async (prompt: string, currentFiles: ProjectStructure | null): Promise<ProjectStructure | { error: string }> => {
    const systemPrompt = `You are the Lead Architect of Aikon Designer, a futuristic AI IDE. 
    Your goal is to build a complex, multi-file web application based on the user's prompt.
    
    **OUTPUT FORMAT:**
    You must return a single JSON object with the following structure:
    {
      "description": "A short technical summary of what you built.",
      "files": [
        { "name": "App.tsx", "path": "/src/App.tsx", "language": "typescript", "content": "..." },
        { "name": "index.css", "path": "/src/index.css", "language": "css", "content": "..." }
        // ... other files
      ],
      "previewHtml": "..." 
    }

    **CRITICAL INSTRUCTIONS:**
    1. **Virtual Files:** Create a realistic React project structure (App.tsx, components/, hooks/, css). Use functional components and Tailwind CSS classes.
    2. **Preview HTML:** Since we cannot bundle React in the browser easily, you must ALSO generate a "Single File Build" version of the project in the 'previewHtml' field. This HTML file should contain everything needed (Tailwind CDN, React/ReactDOM CDNs if necessary, or just vanilla JS/HTML that *looks* exactly like the React code) to render the project instantly in an iframe. The user will see the React code in the editor, but the 'previewHtml' is what they will visually interact with.
    3. **Quality:** The code must be production-ready, clean, and modern.
    
    If updating an existing project, return the full updated structure.`;

    try {
        const ai = getAiInstance();
        // If context exists, include it (simplified for now, sending just prompt)
        const userQuery = currentFiles 
            ? `Update the current project based on this request: ${prompt}. \nCurrent files summary: ${currentFiles.files.map(f => f.path).join(', ')}` 
            : `Create a new web project: ${prompt}`;

        const response = await ai.models.generateContent({
            model: proModel,
            contents: userQuery,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                 // Use thinking for complex architecture
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response");
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Aikon Designer Error:", error);
        return { error: "Failed to architect the project. Please try again." };
    }
}


// --- AUTONOMOUS AGENT / WORKFLOW FUNCTIONS ---

export const generatePlan = async (goal: string): Promise<{ plan: string[] } | { error: string }> => {
    const systemPrompt = `You are a world-class autonomous agent planner. Your job is to create a step-by-step plan to achieve a user's goal.
The plan should be a simple array of strings. Each string is a clear, high-level step.

**Available Tools for Planning:**
Your plan should be a sequence of actions that can be executed by tools like:
- \`search_and_summarize\`: To find information.
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
  ["Search for Tesla's Q1 2024 earnings report.", "Create a PowerPoint presentation summarizing the key findings."]

Now, generate a plan for the following goal. Your response must be only the JSON object.`;
    
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

    const systemPrompt = `You are a world-class autonomous agent executor. Your job is to decide the very next step to achieve a user's goal.
You are given the goal, plan, and completed steps. You must decide which single tool to call next.

**CORE DIRECTIVES:**
1.  **JSON RESPONSE:** Your response MUST be a single, valid JSON object. This object must contain two keys: "step_summary" (a string describing your action) and "tool_call" (an object with "name" and "args" keys). Do not add any text or markdown outside of this single JSON object.
2.  **TOOL USAGE:**
    - **Content Creation:** To create any text, document, report, or code, you MUST use the \`write_file\` tool. For generating professional documents like PPTX, DOCX, or XLSX, use the specific tools provided (\`create_powerpoint\`, etc.).
    - **Research Strategy:** Use the \`search_and_summarize\` tool to perform research. This tool directly returns a summary, so you do not need to browse individual web pages.
    - **Finishing:** When the goal is fully achieved and the final content has been written to a file or is ready to be delivered, use the \`finish\` tool.
3.  **ERROR HANDLING & RESILIENCE:**
    - If a tool fails, DO NOT GIVE UP. Analyze the error and the previous steps and try a different approach.
    - If you are truly stuck after multiple retries or the goal is impossible, use the \`finish\` tool and clearly explain the problem in the 'final_content' argument.

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
                responseMimeType: "application/json",
            }
        });
        const text = response.text.trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("Error running workflow step:", error);
        return { error: "An unexpected error occurred while trying to determine the next step." };
    }
};

export const classifyIntentAndSelectPersona = async (prompt: string): Promise<string> => {
    const systemPrompt = `You are an intelligent routing agent. Your task is to analyze the user's prompt and determine which specialized persona is best suited to handle the request.

Respond with ONLY the string name of the persona (e.g., "Study Buddy" or "Legal Document Reviewer").
If no special persona is needed, respond with "AikonAI".

Here are the available personas and their specialties:

- **AikonAI**: Default, general-purpose assistant. For casual conversation, simple questions, and tasks not covered by others.
- **Legal Document Reviewer**: For analyzing legal texts, contracts, agreements. Use if the prompt includes legal jargon, requests a review of a legal document, or mentions terms like "contract", "agreement", "policy".
- **Study Buddy**: For explaining complex educational or academic topics. Use if the user asks to "explain", "teach me about", asks about a concept, or wants a breakdown of a subject.
- **Writing Assistant**: For improving, proofreading, or rewriting text. Use if the user provides a block of text and asks for edits or suggestions.
- **Fitness Advice**: For questions about exercise, nutrition, and health.
- **Personal Finance Assistant**: For questions about budgeting, saving, and analyzing financial data (especially if a file is attached).
- **Developer Sandbox**: For requests involving writing or executing code, managing files, or other programming-related tasks.

Analyze the following prompt and return the single best persona name.`;

    try {
        const ai = getAiInstance();
        const response = await ai.models.generateContent({
            model: defaultModel,
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0,
            },
        });

        const personaName = response.text?.trim().replace(/"/g, ''); // Remove quotes if model adds them

        const validPersonas = ["AikonAI", "Legal Document Reviewer", "Study Buddy", "Writing Assistant", "Fitness Advice", "Personal Finance Assistant", "Developer Sandbox"];
        if (personaName && validPersonas.includes(personaName)) {
            return personaName;
        }
        
        console.warn(`Persona classification returned an invalid name: "${personaName}". Defaulting to AikonAI.`);
        return "AikonAI";

    } catch (error) {
        console.error("Error classifying intent:", error);
        return "AikonAI"; // Default on error
    }
};
