import { Request, Response, NextFunction } from "express";
import { classifyInput } from "../api/beingHuman";

// Define the type for the knowledge base categories
type KnowledgeBaseCategory = 'vulgar' | 'erroneous' | 'timeAndAvailabilityConcerns' | 'entriesAboutReferralsOrAdvice' | 'privacyConcerns' | 'processFrustration';

const merlinIntentHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

        // Classify the input query into one of the predefined categories
        const category = await classifyInput(userquery);

        // Define the valid categories
        const validCategories: KnowledgeBaseCategory[] = [
            'vulgar', 'erroneous', 'timeAndAvailabilityConcerns', 
            'entriesAboutReferralsOrAdvice', 'privacyConcerns', 'processFrustration'
        ];

        // Ensure the category is valid before using it
        if (validCategories.includes(category as KnowledgeBaseCategory)) {
            console.log("Category mapped:", category);

            res.status(200).json({ category });
        } else {
            // Handle unexpected category (not valid)
            res.status(400).json({
                error: "Invalid category returned from classification"
            });
        }

    } catch (error) {
        console.error("Error in merlinTrustHandler:", error);
        next(error); // Proper error propagation
    }
};

// ✅ Ensure the function is exported as default
export default merlinIntentHandler;
