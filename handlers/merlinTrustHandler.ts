import { Request, Response, NextFunction } from "express";
import { handleMerlinTrustConversation } from "../api/beingHuman";

const merlinTrustHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("Event Starting");

    try {

        console.log("Query parameters:", req.query);

        /* req.query is Formatted as 
                {
                    userquery: 'I am looking for some direction on how to resolve a debt situation'
                    case:
                }
        */
        const userquery = req.query.userquery as string;
        const usercase = req.query.usercase as string;


        if (!userquery) {
            res.status(400).json({
                error: "Validation Error - Search Criteria Missing"
            });
            return;
        }

        console.log("User Query:", userquery);

        const aiResponse = await handleMerlinTrustConversation(userquery);

        console.log("AI Response:", aiResponse);

        res.status(200).json({ aiResponse });

    } catch (error) {
        console.error("Error in merlinTrustHandler:", error);
        next(error); // Proper error propagation
    }
};

// ✅ Ensure the function is exported as default
export default merlinTrustHandler;
