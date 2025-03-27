import { Request, Response, NextFunction } from "express";
import { classifyInput } from "../api/beingHuman";

// Define the type for the knowledge base categories
type KnowledgeBaseCategory = 'vulgar' | 'erroneous' | 'timeAndAvailabilityConcerns' | 'entriesAboutReferralsOrAdvice' | 'privacyConcerns' | 'processFrustration';

// Predefined knowledge bases for each category
const knowledgeBase: Record<KnowledgeBaseCategory, string[]> = {
    vulgar: [
        "That language is not appreciated. Please clean it up.",
        "I am going to take the liberty of ending this conversation now.",
        "If this continues I'll have to end this chat.",
    ],
    erroneous: [
        "I don't understand your response.",
        "That response does not appear appropriate for the question.",
        "I'm having difficulty understanding that response.",
    ],
    timeAndAvailabilityConcerns: [
        "I understand if you are running short on time right now. We can continue later if that is best for you.",
        "We can usually get through the whole process in approximately 10 to 15 minutes, depending on the details of your situation.",
        "We could wrap this up in just a few more minutes if you can spare it.",
        "I certainly appreciate the time you have already invested.",
        "I am here for you 24/7, so come back when you have more time.",
    ],
    entriesAboutReferralsOrAdvice: [
        "While Dealing With Debt does provide guidance and options, we do not recommend, review, endorse, or refer specific companies.",
        "I understand you are eager for answers. However to provide the best possible guidance we suggest going through our four-step process.",
        "I would love to help you determine a path forward, but first we need to get a full understanding of your situation.",
        "I cannot help you evaluate specific offers from companies, but we can help you determine a sensible path forward with actionable steps you can take.",
    ],
    privacyConcerns: [
        "I can assure you what is said between us stays between us.",
        "Under no circumstance will we share your information without your express permission.",
        "Dealing With Debt is a non-profit organization that exists only to assist consumers build the financial future they deserve.",
        "Please understand, while we may ask for statistics about your income and debt, we will never ask for, nor collect any identifying information about your employers or creditors.",
        "This chat is secure and encrypted.",
    ],
    processFrustration: [
        "I can best help you determine a path forward once we complete the four-step process.",
        "I understand your frustration and I respect that your time is limited and valuable.",
        "I can be most helpful after getting a clear understanding of your current situation.",
        "If you can hang in there with me, I truly believe you'll be happy with what we can accomplish together.",
        "I am here for you. My sole objective is to understand your unique situation.",
        "We want to provide the best possible guidance for your specific situation.",
        "I know it feels like a lot, but I want to give you personalized guidance.",
        "It is totally normal to feel overwhelmed.",
        "I am here for you to work through this together.",
        "I understand this process is a challenge, but the details are very important to providing guidance that will be most helpful to you.",
    ]
};

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

        // Classify the input query into one of the predefined categories
        const category = await classifyInput(userquery);

        // Define the valid categories
        const validCategories: KnowledgeBaseCategory[] = [
            'vulgar', 'erroneous', 'timeAndAvailabilityConcerns', 
            'entriesAboutReferralsOrAdvice', 'privacyConcerns', 'processFrustration'
        ];

        // Ensure the category is valid before using it
        if (validCategories.includes(category as KnowledgeBaseCategory)) {
            const responses = knowledgeBase[category as KnowledgeBaseCategory];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            console.log("AI Response:", randomResponse);

            res.status(200).json({ randomResponse });
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
export default merlinSideChatHandler;
