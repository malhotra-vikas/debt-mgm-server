import { Request, Response, NextFunction } from "express";
import { handleMerlinConversation, handleMerlinQuestionAppender } from "../api/beingHuman";

const merlinQuestionAppenderHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("Event Starting");

    try {
    
        console.log("Query parameters:", req.query);

/* req.query is Formatted as 
        {
            question: 'I am looking for some direction on how to resolve a debt situation'
            selection: ''
        }
*/    
        const pastQuestion = req.query.question as string;
        const pastSelection = req.query.selection as string;

        if (!pastQuestion) {
            res.status(400).json({
                error: "Validation Error - Search Criteria Missing"
            });
            return;
        }

        console.log("User Query:", pastQuestion);
        console.log("User Past Selection:", pastSelection);

        const aiResponse = await handleMerlinQuestionAppender(pastQuestion, pastSelection);

        console.log("AI Response:", aiResponse);

        res.status(200).json({ aiResponse });

    } catch (error) {
        console.error("Error in merlinTrustHandler:", error);
        next(error); // Proper error propagation
    }
};

// ✅ Ensure the function is exported as default
export default merlinQuestionAppenderHandler;
