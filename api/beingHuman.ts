import openai from "openai";
import dotenv from "dotenv";
import { personalSituationQuestions } from "../lib/personal-situation-questions";

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


export async function askMerlinToCreateAHumanResponse(question: string, pastSelection: string): Promise<string> {
    console.log("askOpenAI - Question:", question);

    let effectivePrompt = "";
    effectivePrompt += `The user answered as ${pastSelection} to the Question: ${question}`;

    console.log("askOpenAI - Effective Prompt:", effectivePrompt);

    const chatMessages = [
        { role: "system", content: `
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


// OpenAI request function
export async function askMerlinTrustBuilder(question: string, merlinKnowledgeBase: KnowledgeBase[]): Promise<string> {
    console.log("askOpenAI - Question:", question);

    let effectivePrompt = "";
    if (merlinKnowledgeBase.length > 0) {
        const knowledgeBaseEntries = merlinKnowledgeBase.map(entry => `Q: ${entry.question}\nA: ${entry.answer}`).join("\n\n");
        effectivePrompt = `Knowledge Base:\n${knowledgeBaseEntries}\n\n`;
    }
    effectivePrompt += `Question: ${question}`;

    console.log("askOpenAI - Effective Prompt:", effectivePrompt);

    const chatMessages = [
        { role: "system", content: `Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). 
            Your goal is to build trust and comfort with users. 
            You use this site to learn about Dealing with Debt https://us.dealingwithdebt.org
            You always query the knowledge base to answer queries and never make up information.
            Your responses are consise and of no more than two lines. 
            
            **About Dealing WIth Debt:** DWD is a 501 (c) 3 non-profit charitable organization that is addressing this important public health concern by creating the first social
            platform dedicated to providing a safe space for consumers to connect with peers, complete financial education courses, access engaging content, 
            obtain information, and access resources and tools needed to achieve personal success.` },
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

    console.log("merlinKnowledgeBase is ", merlinKnowledgeBase)
    if (!merlinKnowledgeBase) merlinKnowledgeBase = [];

    try {
        return await askMerlinTrustBuilder(userInput, merlinKnowledgeBase);
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

export async function getMerlinKnowledgeBase(): Promise<KnowledgeBase[]> {
    return Object.values(personalSituationQuestions).map((q) => ({
        question: q.question,
        answer: q.options ? q.options.join(", ") : "No predefined answers",
    }));
}
