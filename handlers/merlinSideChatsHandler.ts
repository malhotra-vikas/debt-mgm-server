import { Request, Response, NextFunction } from "express";
import { classifyInput, generateOpenAIResponse } from "../api/beingHuman";

// Define the type for the knowledge base categories
type KnowledgeBaseCategory = 'vulgar' | 'erroneous' | 'time_and_availability_concerns' | 'entries_about_referrals_or_advice' | 'privacy_concerns' | 'process_frustration';

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
    time_and_availability_concerns: [
        "I understand if you are running short on time right now. We can continue later if that is best for you.",
        "We can usually get through the whole process in approximately 10 to 15 minutes, depending on the details of your situation.",
        "We could wrap this up in just a few more minutes if you can spare it.",
        "I certainly appreciate the time you have already invested.",
        "I am here for you 24/7, so come back when you have more time.",
    ],
    entries_about_referrals_or_advice: [
        "While Dealing With Debt does provide guidance and options, we do not recommend, review, endorse, or refer specific companies.",
        "I understand you are eager for answers. However to provide the best possible guidance we suggest going through our four-step process.",
        "I would love to help you determine a path forward, but first we need to get a full understanding of your situation.",
        "I cannot help you evaluate specific offers from companies, but we can help you determine a sensible path forward with actionable steps you can take.",
    ],
    privacy_concerns: [
        "I can assure you what is said between us stays between us.",
        "Under no circumstance will we share your information without your express permission.",
        "Dealing With Debt is a non-profit organization that exists only to assist consumers build the financial future they deserve.",
        "Please understand, while we may ask for statistics about your income and debt, we will never ask for, nor collect any identifying information about your employers or creditors.",
        "This chat is secure and encrypted.",
        "If you are looking for guidance for resolving debt, you are in the right place! Our goal is to help people better understand their situation and their options.",
        "I am looking forward to doing my best to assist you today.",
        "Most people I talk to are feeling pressure and stress, and may be uncertain what to do about their situation. We are here to help those that are seeking guidance and options.",
        "I completely understand how frustrating that can be. But that is why Dealing With Debt and I exist!",
        "We help consumers every day work through their challenges and develop a plan of action to deal them.",
        "My sole objective is to listen to you describe your unique circumstances, and then provide guidance and options.",
        "We understand that financial problems are stressful. The good news is that you are in the right place. Our process has been successful with helping people discover a path forward.",
        "I would love to be able to provide you guidance on a path forward. However, I must first get a full understanding of your unique situation.",
        "While Dealing With Debt is familiar with many companies aiming to help people with financial issues, we do not recommend specific companies or provide critiques, reviews or endorsements.",
        "Dealing With Debt is a non-profit organization providing free guidance and support to consumers seeking financial education or assistance during difficult financial circumstances.",
        "We have an established four-step process that will give us a clear understanding of your situation, and then we can provide guidance and options.",
    ],
    process_frustration: [
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
    ],
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
        //const category = await classifyInput(userquery);

        //console.log("category:", category);

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
