type TaxBracket = {
    threshold: number;
    rate: number;
};

type TaxBrackets = {
    single: TaxBracket[];
    joint: TaxBracket[];
};


type LifeEventImpact = {
    [key: string]: number;
};


// Import the JSON data
import lifeEventData from '../knowledgebase/lifeEventsHairCuts.json';


export const computeHairCutPercentage = (userData: UserData): {hairCutPercentage: number, lifeEvents: string[]} => {
    let hairCutPercentage = 0;
    let userLifeEvents: string[] = [];  // Initialize to empty array

    // Extract the lifeEventImpact from the imported JSON
    const lifeEventImpact: LifeEventImpact = lifeEventData.lifeEventImpact;

    // Extract life events from user data
    let lifeEventsForUser = userData.data.allLifeEvents;
    let catastropicLossForUser = userData.data.catastropicLoss;
    let extendedFamilyCareForUser = userData.data.extendedFamilyCare;

    // Handle case where allLifeEvents is a string (e.g., a comma-separated list)
    if (typeof lifeEventsForUser === 'string') {
        lifeEventsForUser = lifeEventsForUser.split(',').map(event => event.trim().replace(/^,/, ''));
    }

    userLifeEvents = lifeEventsForUser

    // Logging for debugging purposes
    console.log("Cleaned lifeEvents are: ", lifeEventsForUser);
    //console.log("lifeEventImpact are: ", lifeEventImpact);

    // Compute the haircut percentage by summing the impacts of the life events
    lifeEventsForUser.forEach((lifeEvent: string | number) => {
        if (lifeEventImpact[lifeEvent] !== undefined) {
            hairCutPercentage += lifeEventImpact[lifeEvent];
        }
    });

    // Case-insensitive check for 'Yes' or 'No' for catastrophic loss
    if (catastropicLossForUser.toLowerCase() === 'yes') {
        hairCutPercentage += lifeEventImpact['Catastrophic loss'] || 0;
        userLifeEvents.push('Catastrophic loss');
    }

    // Case-insensitive check for 'Yes' or 'No' for extended family care
    if (extendedFamilyCareForUser.toLowerCase() === 'yes') {
        hairCutPercentage += lifeEventImpact['Financially supporting extended family'] || 0;
        userLifeEvents.push('Financially supporting extended family');
    }

    return {hairCutPercentage: hairCutPercentage, lifeEvents: userLifeEvents};

}

const taxBrackets: TaxBrackets = {
    single: [
        { threshold: 11600, rate: 0.1 },
        { threshold: 47150, rate: 0.12 },
        { threshold: 100525, rate: 0.22 },
        { threshold: 191950, rate: 0.24 },
        { threshold: 243725, rate: 0.32 },
        { threshold: 609350, rate: 0.35 },
        { threshold: Infinity, rate: 0.37 }
    ],
    joint: [
        { threshold: 23200, rate: 0.1 },
        { threshold: 94300, rate: 0.12 },
        { threshold: 201050, rate: 0.22 },
        { threshold: 383900, rate: 0.24 },
        { threshold: 487450, rate: 0.32 },
        { threshold: 731200, rate: 0.35 },
        { threshold: Infinity, rate: 0.37 }
    ]
};

export const calculateTax = (income: number, filingStatus: 'single' | 'joint'): number => {
    const brackets = taxBrackets[filingStatus];
    let taxAmount = 0;
    let previousThreshold = 0;

    for (let i = 0; i < brackets.length; i++) {
        const currentBracket = brackets[i];

        // If income is less than or equal to the current threshold
        if (income <= currentBracket.threshold) {
            taxAmount += (income - previousThreshold) * currentBracket.rate;
            break;
        } else {
            taxAmount += (currentBracket.threshold - previousThreshold) * currentBracket.rate;
            previousThreshold = currentBracket.threshold;
        }
    }

    return taxAmount;
}




export const calculateTotalAnnualIncome = (userData: UserData): {houseHoldAnnualIncome: number, spouseIncome: number} => {

    console.log("userData is ", JSON.stringify(userData, null, 2))
    // annualSalary already includes user, spouse and partime too
    let totalIncome = parseFloat(userData.data.annualSalary); // Base annual salary
    let spouseIncome = parseFloat(userData.data.spouseAnnualSalary);


    // Alimony, check if it's provided and active
    if (userData.data.alimonyMonthly) {
        let alimonyMonthly = parseFloat(userData.data.alimonyMonthly);
        // If alimony end date exists, calculate how many months it will be paid
        const alimonyMonths = userData.data.alimonyEndDate ? monthsUntilEnd(userData.data.alimonyEndDate) : 12;
        totalIncome += alimonyMonthly * alimonyMonths;
    }

    // Retirement benefits (monthly)
    if (userData.data.userRetirementMonthly) {
        console.log("userData.data.retirementMonthly is ", userData.data.userRetirementMonthly)
        console.log("userData.data.retirementEndDate is ", userData.data.userRetirementEndDate)

        // If the retirement end date is missing or empty, assume it lasts for the full year (12 months)
        const retirementMonths = userData.data.userRetirementEndDate && userData.data.userRetirementEndDate !== ""
            ? monthsUntilEnd(userData.data.userRetirementEndDate)  // Calculate months until the end date
            : 12; // Default to 12 months if end date is not provided or empty

        //const retirementMonths = userData.data.userRetirementMonthly ? monthsUntilEnd(userData.data.userRetirementEndDate) : 12;
        console.log("retirementMonths is ", retirementMonths)

        totalIncome += parseFloat(userData.data.userRetirementMonthly) * retirementMonths;
    }


    // Alimony
    if (userData.data.alimonyMonthly) {
        let alimonyMonthly = parseFloat(userData.data.alimonyMonthly);
        const alimonyMonths = userData.data.alimonyEndDate && userData.data.alimonyEndDate !== ""
            ? monthsUntilEnd(userData.data.alimonyEndDate)
            : 12; // Default to 12 months if end date is not provided
        totalIncome += alimonyMonthly * alimonyMonths;
    }

    // Severance
    if (userData.data.severanceMonthly) {
        let severanceMonthly = parseFloat(userData.data.severanceMonthly);
        const severanceMonths = userData.data.severanceEndDate && userData.data.severanceEndDate !== ""
            ? monthsUntilEnd(userData.data.severanceEndDate)
            : 12;
        totalIncome += severanceMonthly * severanceMonths;
    }

    // Disability
    if (userData.data.disabilityMonthly) {
        let disabilityMonthly = parseFloat(userData.data.disabilityMonthly);
        const disabilityMonths = userData.data.disabilityEndDate && userData.data.disabilityEndDate !== ""
            ? monthsUntilEnd(userData.data.disabilityEndDate)
            : 12;
        totalIncome += disabilityMonthly * disabilityMonths;
    }

    // Worker Compensation
    if (userData.data.workerCompMonthly) {
        let workerCompMonthly = parseFloat(userData.data.workerCompMonthly);
        const workerCompMonths = userData.data.workerCompEndDate && userData.data.workerCompEndDate !== ""
            ? monthsUntilEnd(userData.data.workerCompEndDate)
            : 12;
        totalIncome += workerCompMonthly * workerCompMonths;
    }

    // Child Support
    if (userData.data.childSupportMonthly) {
        let childSupportMonthly = parseFloat(userData.data.childSupportMonthly);
        const childSupportMonths = userData.data.childSupportEndDate && userData.data.childSupportEndDate !== ""
            ? monthsUntilEnd(userData.data.childSupportEndDate)
            : 12;
        totalIncome += childSupportMonthly * childSupportMonths;
    }

    // Unemployment
    if (userData.data.unemploymentMonthly) {
        let unemploymentMonthly = parseFloat(userData.data.unemploymentMonthly);
        const unemploymentMonths = userData.data.unemploymentEndDate && userData.data.unemploymentEndDate !== ""
            ? monthsUntilEnd(userData.data.unemploymentEndDate)
            : 12;
        totalIncome += unemploymentMonthly * unemploymentMonths;
    }

    // Social Security
    if (userData.data.socialSecurityMonthly) {
        let socialSecurityMonthly = parseFloat(userData.data.socialSecurityMonthly);
        const socialSecurityMonths = userData.data.socialSecurityEndDate && userData.data.socialSecurityEndDate !== ""
            ? monthsUntilEnd(userData.data.socialSecurityEndDate)
            : 12;
        totalIncome += socialSecurityMonthly * socialSecurityMonths;
    }


    return {houseHoldAnnualIncome: totalIncome, spouseIncome: spouseIncome} ;
};


// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}
// Helper function to calculate the months remaining until a given end date
const monthsUntilEnd = (endDate: string): number => {
    const currentDate = new Date();
    const endDateObj = new Date(endDate);
    const diffTime = endDateObj.getTime() - currentDate.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 3600 * 24 * 30))); // Approximate number of months, ensuring no negative value
};


export const getSentimentLabel = (utilization: number, minPayment: number, disposable: number): string => {
    if (utilization < 30 && minPayment < disposable) {
        return "✅ Stable";
    } else if (utilization < 60 && minPayment < disposable) {
        return "🟡 Caution";
    } else {
        return "⚠️ Vulnerable";
    }
}
