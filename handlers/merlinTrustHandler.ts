import { Request, Response, NextFunction } from "express";
import { handleMerlinConversation } from "../api/beingHuman";

const merlinTrustHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("Event Starting");

    try {
        console.log("Query parameters:", req.query);

        const userquery = req.query.userquery as string;

        if (!userquery) {
            res.status(400).json({
                error: "Validation Error - Search Criteria Missing"
            });
            return;
        }

        console.log("User Query:", userquery);

        const aiResponse = await handleMerlinConversation(userquery);

        console.log("AI Response:", aiResponse);

        res.status(200).json({ aiResponse });

    } catch (error) {
        console.error("Error in merlinTrustHandler:", error);
        next(error); // Proper error propagation
    }
};

// ✅ Ensure the function is exported as default
export default merlinTrustHandler;
