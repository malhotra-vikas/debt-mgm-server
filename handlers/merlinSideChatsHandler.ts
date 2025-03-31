import { Request, Response, NextFunction } from "express";
import { generateOpenAIResponse } from "../api/beingHuman";

// Import the JSON knowledge base
import knowledgeBase from "../knowledgebase/interceptionPhrases.json"


const merlinSideChatHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("Event Starting");

    try {
        console.log("Query parameters:", req.query);

        const userquery = req.query.question as string;

        if (!userquery) {
            res.status(400).json({
                error: "Validation Error - Search Criteria Missing"
            });
            return;
        }

        console.log("User Query:", userquery);

        // Convert the knowledge base into a single string
        const flatKnowledgeBase = Object.values(knowledgeBase).flat().join("\n");

        // Classify the input query into one of the predefined categories
        const aiResponse = await generateOpenAIResponse(userquery, flatKnowledgeBase);

        console.log("aiResponse:", aiResponse);

        if (aiResponse) {
            res.status(200).json({ aiResponse });
        } 
    } catch (error) {
        console.error("Error in merlinTrustHandler:", error);
        res.status(400);

        next(error); // Proper error propagation
    }
};

// ✅ Ensure the function is exported as default
export default merlinSideChatHandler;
