import openai from "openai";
import dotenv from "dotenv";
import { TrustPhrases } from "../lib/trust-builder-kb"

dotenv.config();

const gptModel = "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

interface KnowledgeBase {
    question: string;
    answer: string;
}

interface TrustKnowledgeBase {
    phrase: string;
}

interface ConversationContext {
    email: string;
    Context?: string;
}


export async function askMerlinToCreateAHumanResponse(question: string, pastSelection: string): Promise<string> {
    console.log("askOpenAI - Question:", question);

    let effectivePrompt = "";
    effectivePrompt += `The user answered as ${pastSelection} to the Question: ${question}`;

    console.log("askOpenAI - Effective Prompt:", effectivePrompt);

    const chatMessages = [
        {
            role: "system", content: `
            Create a 2-3 lines, humane and empathetic response to acknowledge how the user answered the previous question
            ${effectivePrompt}
            ` },
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
        //console.log("askOpenAI - Parsed Response:", responseData);

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

export async function generateOpenAIResponse(userQuery: string, knowledgeBase: string): Promise<string> {

    // Validate inputs
    if (!userQuery || !knowledgeBase) {
        throw new Error("Both userQuery and knowledgeBase must be provided.");
    }

    const prompt = `
            Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). You help find an appropriate response to user question using the Knowledge Base:
            ${knowledgeBase}
            Now, the user is asking: "${userQuery}"
            Provide a response in a helpful and polite manner. Your response MUST always be within 35 words.
        `;

    const chatMessages = [
        {
            role: "system", content: `Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). `
        },
        { role: "user", content: prompt }
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
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Use environment variables for security
            },
            body: JSON.stringify(openaiPayload),
        })

        if (!response.ok) {
            throw new Error(`OpenAI API Error: ${response.status} - ${response.statusText}`);
        }

        const responseData = await response.json(); // Extract JSON response
        //console.log("askOpenAI - Parsed Response:", responseData);

        // Extract AI response text safely
        const aiResponse = responseData?.choices?.[0]?.message?.content?.trim() || "No response from OpenAI";

        return aiResponse

    } catch (error: any) {
        console.error("Error in askOpenAI:", error);
        // Improve error handling based on error type
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            if (error.message.includes('Rate limit exceeded')) {
                console.error("Rate limit exceeded.");
            }
            if (error.message.includes('Service unavailable')) {
                console.error("Service unavailable.");
            }
        }
        return "I'm sorry, but I couldn't fetch an answer right now. Please try again later.";
    }
}



export async function classifyInput(input: string): Promise<string> {

    const chatMessages = [
        {
            role: "system", content: `Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). `
        },
        { role: "user", content: `Classify the following user input into one of the following categories: vulgar, erroneous, time_and_availability_concerns, entries_about_referrals_or_advice, privacy_concerns, process_frustration. Text: "${input}"\nResponse should only be one of the categories.` }
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
        //console.log("askOpenAI - Parsed Response:", responseData);

        // Extract AI response text safely
        const aiResponse = responseData?.choices?.[0]?.message?.content?.trim() || "No response from OpenAI";

        return aiResponse

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


// OpenAI request function
export async function askMerlinTrustBuilder(question: string, usercase: string, merlinTrustKnowledgeBase: TrustKnowledgeBase[]): Promise<string> {
    console.log("askOpenAI - Question:", question);

    let effectivePrompt = "";
    if (merlinTrustKnowledgeBase.length > 0) {
        const knowledgeBaseEntries = merlinTrustKnowledgeBase
            .map(entry => `Trust Phrase: ${entry.phrase}`)
            .join("\n\n");

        effectivePrompt = `Knowledge Base:\n${knowledgeBaseEntries}\n\n`;

    }


    effectivePrompt += `Build a Trust building response for Question: ${question}`;

    if (usercase && usercase === 'NewUser') {
        effectivePrompt += `. You MUST start with why this is the right place to be`;
    } else {
        effectivePrompt += `. You MUST NOT repeat why this is the right place to be. You MUST NOT repeate earlier messages too.`;
        effectivePrompt += `. You MUST NOT say how you understand this situation. Just give forward looking statements. `;

    }

    console.log("askOpenAI - Effective Prompt:", effectivePrompt);

    const chatMessages = [
        {
            role: "system", content: `Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). 
            Your goal is to build trust and comfort with users. 
            You always query the knowledge base to get information on how to build trust with the user.
            Your responses are consise and of no more than 2-3 lines. `
        },
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
       // console.log("askOpenAI - Parsed Response:", responseData);

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
export async function handleMerlinTrustConversation(userInput: string, usercase: string): Promise<string> {
    console.log("handleMerlinConversation - Input:", userInput);

    let merlinTrustKnowledgeBase = await getMerlinTrustKnowledgeBase();

    console.log("merlinKnowledgeBase is ", merlinTrustKnowledgeBase)
    if (!merlinTrustKnowledgeBase) merlinTrustKnowledgeBase = [];

    try {
        return await askMerlinTrustBuilder(userInput, usercase, merlinTrustKnowledgeBase);
    } catch (error) {
        console.error("Error processing AI response:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
}

export async function handleMerlinQuestionAppender(pastQuestion: string, pastSelection: string): Promise<string> {
    console.log("handleMerlinConversation - Input:", pastQuestion);

    try {
        return await askMerlinToCreateAHumanResponse(pastQuestion, pastSelection);
    } catch (error) {
        console.error("Error processing AI response:", error);
        return "Sorry, I encountered an error while processing your request.";
    }
}

export async function getMerlinSideCarKnowledgeBase(): Promise<TrustKnowledgeBase[]> {
    const shuffledPhrases = shuffleArray([...TrustPhrases]); // Copy and shuffle

    return shuffledPhrases.map((q) => ({
        phrase: q.phrase,
    }));
}


export async function getMerlinTrustKnowledgeBase(): Promise<TrustKnowledgeBase[]> {
    const shuffledPhrases = shuffleArray([...TrustPhrases]); // Copy and shuffle

    return shuffledPhrases.map((q) => ({
        phrase: q.phrase,
    }));
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}