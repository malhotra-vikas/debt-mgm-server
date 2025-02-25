import openai from "openai";
import dotenv from "dotenv";

dotenv.config();

const gptModel = "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

interface KnowledgeBase {
    question: string;
    answer: string;
}

interface ConversationContext {
    email: string;
    Context?: string;
}

// OpenAI request function
export async function askMerlinAi(question: string, merlinKnowledgeBase: KnowledgeBase[]): Promise<string> {
    console.log("askOpenAI - Question:", question);

    let effectivePrompt = "";
    if (merlinKnowledgeBase.length > 0) {
        const knowledgeBaseEntries = merlinKnowledgeBase.map(entry => `Q: ${entry.question}\nA: ${entry.answer}`).join("\n\n");
        effectivePrompt = `Knowledge Base:\n${knowledgeBaseEntries}\n\n`;
    }
    effectivePrompt += `Question: ${question}`;

    console.log("askOpenAI - Effective Prompt:", effectivePrompt);

    const chatMessages = [
        { role: "system", content: "Your name is Alexa. You are the Director of Hospitality for Rose Creek, a Country Club. You answer users' questions about the Club, its offerings, and membership options. You always query the knowledge base to answer queries and never make up information." },
        { role: "user", content: effectivePrompt }
    ];

    const openaiPayload = {
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: false,
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(openaiPayload),
        })
    
    
        if (!response.ok) {
            throw new Error(`OpenAI API Error: ${response.status} - ${response.statusText}`);
        }
    
        const responseData = await response.json(); // Extract JSON response
        console.log("askOpenAI - Parsed Response:", responseData);
    
        // Extract AI response text safely
        const aiResponse = responseData?.choices?.[0]?.message?.content?.trim() || "No response from OpenAI";

        return aiResponse
    
        
        //if (response?.data?.choices?.[0]?.message?.content) {
        //    return response.data.choices[0].message.content.trim();
        //} else {
        //    throw new Error("No valid completion received.");
        /// }
    } catch (error: any) {
        console.error("Error in askOpenAI:", error);
        if (error.response) {
            console.error("HTTP status:", error.response.status);
            console.error("Response body:", error.response.data);
            if (error.response.status === 429) console.error("Rate limit exceeded.");
            if (error.response.status === 503) console.error("Service unavailable.");
        }
        return "I'm sorry, but I couldn't fetch an answer right now. Please try again later.";
    }
}

// Main conversation handler
export async function handleMerlinConversation(userInput: string): Promise<string> {
    console.log("handleMerlinConversation - Input:", userInput);

    let merlinKnowledgeBase = await getMerlinKnowledgeBase();
    if (!merlinKnowledgeBase) merlinKnowledgeBase = [];

    try {
        return await askMerlinAi(userInput, merlinKnowledgeBase);
    } catch (error) {
        console.error("Error processing AI response:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
}

export async function getMerlinKnowledgeBase(): Promise<KnowledgeBase[]> {

    return [];
}
