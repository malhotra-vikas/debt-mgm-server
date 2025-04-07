import { UserCard } from "../lib/UserData";  // Adjust this path as needed

interface PaymentStatusCard {
    status: 'On-Time' | '30 to 60 days late' | '61 to 90 days late' | '90+ days late' | 'Account Charged Off';
}

interface PaymentBehaviorCard {
    balance: number; // Outstanding balance
    paymentStatus: 'Minimum Payments' | 'More than Minimum' | 'Not Being Paid' | 'Account Charged Off';
}


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

export type FormValues = {
    principal: number;
    apr: number;
    minimumPayment: number;
    additionalPayment: number;
    requiredPrincipalPercentage: number;
}

type PaymentScheduleItem = {
    month: number
    startingBalance: number
    balance: number
    payment: number
    principal: number
    interest: number
    cumulativePrincipal: number
    cumulativeInterest: number
    requiredMinimumPayment: number
    totPaid: number
}

type Summary = {
    totalInterestPaid: number
    totalPrincipalPaid: number
    payoffMonths: number
    yearsToPayoff: number
    monthlyPayment: number
    revisedDebtFreeDate: string
}


// Import the JSON data
import lifeEventData from '../knowledgebase/lifeEventsHairCuts.json';
import { IncomeDetails } from "../handlers/merlinReportHandler";


export const computeHairCutPercentage = (userData: UserData): { hairCutPercentage: number, lifeEvents: string[] } => {
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

    return { hairCutPercentage: hairCutPercentage, lifeEvents: userLifeEvents };

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

export const calculateAllIncomesForUserHousehold = (userData: UserData): IncomeDetails => {

    console.log("userData is ", JSON.stringify(userData, null, 2));

    // Initialize base annual income
    let annualIncome = 0;
    let spouseIncome = parseFloat(userData.data.spouseAnnualSalary);
    let userIncome = parseFloat(userData.data.userAnnualSalary);
    let partTimeMonthlyIncome = parseFloat(userData.data.partTimeMonthly);
    let consultingMonthlyIncome = parseFloat(userData.data.consultingMonthly);

    // Add spouse and user income to annual income
    annualIncome += spouseIncome;
    annualIncome += userIncome;

    // Add part-time and consulting income to annual income
    annualIncome += partTimeMonthlyIncome * 12;
    annualIncome += consultingMonthlyIncome * 12;

    // Get current date
    const currentDate = new Date();

    // Initialize monthly income variables
    let retirementMonthly = 0, alimonyMonthly = 0, severanceMonthly = 0, disabilityMonthly = 0;
    let workerCompMonthly = 0, childSupportMonthly = 0, unemploymentMonthly = 0, socialSecurityMonthly = 0;

    // Helper function to check and add income if it is active
    const checkAndAddIncome = (incomeSource: string, endDate: string | null, monthlyIncome: number) => {
        if (monthlyIncome && endDate) {
            let endDateParsed = new Date(endDate);
            if (endDateParsed > currentDate) {
                annualIncome += (monthlyIncome * 12)
                return monthlyIncome;
            }
        }
        return 0;
    };

    // Add income from different sources if still active
    retirementMonthly += checkAndAddIncome(userData.data.userRetirementMonthly, userData.data.userRetirementEndDate, parseFloat(userData.data.userRetirementMonthly));
    alimonyMonthly += checkAndAddIncome(userData.data.alimonyMonthly, userData.data.alimonyEndDate, parseFloat(userData.data.alimonyMonthly));
    severanceMonthly += checkAndAddIncome(userData.data.severanceMonthly, userData.data.severanceEndDate, parseFloat(userData.data.severanceMonthly));
    disabilityMonthly += checkAndAddIncome(userData.data.disabilityMonthly, userData.data.disabilityEndDate, parseFloat(userData.data.disabilityMonthly));
    workerCompMonthly += checkAndAddIncome(userData.data.workerCompMonthly, userData.data.workerCompEndDate, parseFloat(userData.data.workerCompMonthly));
    childSupportMonthly += checkAndAddIncome(userData.data.childSupportMonthly, userData.data.childSupportEndDate, parseFloat(userData.data.childSupportMonthly));
    unemploymentMonthly += checkAndAddIncome(userData.data.unemploymentMonthly, userData.data.unemploymentEndDate, parseFloat(userData.data.unemploymentMonthly));
    socialSecurityMonthly += checkAndAddIncome(userData.data.socialSecurityMonthly, userData.data.socialSecurityEndDate, parseFloat(userData.data.socialSecurityMonthly));

    // Return all income sources and the total annual income
    return {
        houseHoldAnnualIncome: annualIncome,
        spouseAnnualIncome: spouseIncome,
        userAnnualIncome: userIncome,
        socialSecurityMonthly: socialSecurityMonthly,
        socialSecurityEndDate: userData.data.socialSecurityEndDate,

        unemploymentMonthly: unemploymentMonthly,
        unemploymentEndDate: userData.data.unemploymentEndDate,

        childSupportMonthly: childSupportMonthly,
        childSupportEndDate: userData.data.childSupportEndDate,
        
        workerCompMonthly: workerCompMonthly,
        workerCompEndDate: userData.data.workerCompEndDate,

        disabilityMonthly: disabilityMonthly,
        disabilityEndDate: userData.data.disabilityEndDate,

        severanceMonthly: severanceMonthly,
        severanceEndDate: userData.data.severanceEndDate,

        alimonyMonthly: alimonyMonthly,
        alimonyEndDate: userData.data.alimonyEndDate,

        retirementMonthly: retirementMonthly,
        userRetirementEndDate: userData.data.userRetirementEndDate,
        
        partTimeMonthly: partTimeMonthlyIncome,  // Added partTimeMonthly
        consultingMonthly: consultingMonthlyIncome  // Added consultingMonthly
    };
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

export function calculatePaymentSchedule(values: FormValues): [Summary] {
    let balance = values.principal
    const monthlyRate = (values.apr / 100) / 12
    const schedule: PaymentScheduleItem[] = []
    let month = 0
    let totalInterestPaid = 0
    let totalPrincipalPaid = 0
    let monthlyPayment = 0;

    while (balance > 0) {
        month++
        const startingBalance = balance
        const interest = balance * monthlyRate
        const requiredPrincipal = balance * (values.requiredPrincipalPercentage / 100)
        const requiredMinimumPayment = Math.max(interest + requiredPrincipal, values.minimumPayment)
        let payment = Math.max(values.minimumPayment, interest + requiredPrincipal) + values.additionalPayment
        payment = Math.min(payment, balance + interest)
        const principal = payment - interest
        balance -= principal
        const totPaid = payment
        totalInterestPaid += interest
        totalPrincipalPaid += principal
        monthlyPayment = payment;

        if (month > 600) break
    }

    const summary: Summary = {
        totalInterestPaid: parseFloat(totalInterestPaid.toFixed(2)),
        totalPrincipalPaid: parseFloat(totalPrincipalPaid.toFixed(2)),
        yearsToPayoff: parseFloat((month / 12).toFixed(2)),
        payoffMonths: month,
        monthlyPayment: monthlyPayment,
        revisedDebtFreeDate: calculateDebtFreeDate(month)
    }

    return [summary]
}



function calculateDebtFreeDate(monthsToPayoff: number): string {
    const today = new Date()
    const debtFreeDate = new Date(today.setMonth(today.getMonth() + monthsToPayoff))
    return debtFreeDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}


export function emphasizeKeyPhrases(summary: string): string {
    return summary
        // 💰 Dollar amounts like $36,130.00 or $570.36
        .replace(/\$\d{1,3}(,\d{3})*(\.\d{2})?/g, match => `<span class="bold">${match}</span>`)

        // 📊 Percentages like 79.23% or 12%
        .replace(/\d{1,3}(\.\d+)?%/g, match => `<span class="bold">${match}</span>`)

        // 📆 Time durations like "62 months" or "12.5 months"
        .replace(/\b\d+(\.\d+)?\s+(month|months|year|years)\b/gi, match => `<span class="bold">${match}</span>`);
}


export function calculateCreditCardUtilization(debtCards: UserCard[]) {
    const totalBalance = debtCards.reduce((sum, card) => sum + card.balance, 0);
    const totalCreditLimit = debtCards.reduce((sum, card) => sum + card.creditLimit, 0);

    // Calculate utilization percentage
    const utilization = (totalBalance / totalCreditLimit) * 100;

    let utilizationLabel = "";
    if (utilization <= 30) {
        utilizationLabel = "Low";
    } else if (utilization <= 49.99) {
        utilizationLabel = "Moderate";
    } else if (utilization <= 72.99) {
        utilizationLabel = "High";
    } else {
        utilizationLabel = "Very High";
    }

    return { utilization, utilizationLabel };
}


export function calculateCardPaymentStatus(debtCards: UserCard[]) {
    const totalCards = debtCards.length;

    // Count occurrences of each status
    const onTimeCount = debtCards.filter(card => card.paymentTimelyStatus === 'On-Time').length;
    const late30To60Count = debtCards.filter(card => card.paymentTimelyStatus === '30 to 60 days late').length;
    const late61To90Count = debtCards.filter(card => card.paymentTimelyStatus === '61 to 90 days late').length;
    const late90PlusCount = debtCards.filter(card => card.paymentTimelyStatus === '90+ days late').length;
    const chargedOffCount = debtCards.filter(card => card.paymentTimelyStatus === 'Account Charged Off').length;

    const onTimePercentage = (onTimeCount / totalCards) * 100;
    const concerningCondition = late61To90Count + late90PlusCount + chargedOffCount > 0;

    let paymentStatus = "Good";

    if (onTimePercentage < 65 || concerningCondition) {
        paymentStatus = "Concerning";
    }

    if (onTimePercentage < 50 || late61To90Count + late90PlusCount + chargedOffCount > 1) {
        paymentStatus = "Dire";
    }

    return { onTimePercentage, paymentStatus };
}

export function calculateCardPaymentAmounts(debtCards: UserCard[]) {
    const totalBalance = debtCards.reduce((sum, card) => sum + card.balance, 0);

    // Compute how much balance is serviced by each payment behavior
    const minPaymentBalance = debtCards
        .filter(card => card.monthlyPaymentType === 'Minimum Required')  // Change condition here
        .reduce((sum, card) => sum + card.balance, 0);

    const moreThanMinPaymentBalance = debtCards
        .filter(card => card.monthlyPaymentType === 'More Than Minimum')
        .reduce((sum, card) => sum + card.balance, 0);

    const notBeingPaidBalance = debtCards
        .filter(card => card.monthlyPaymentType === 'Not Being Paid') // If no matching data, adjust accordingly
        .reduce((sum, card) => sum + card.balance, 0);

    const chargedOffBalance = debtCards
        .filter(card => card.monthlyPaymentType === 'Account Charged Off') // Adjust if necessary
        .reduce((sum, card) => sum + card.balance, 0);

    console.log("totalBalance - ", totalBalance)
    console.log("minPaymentBalance - ", minPaymentBalance)
    console.log("moreThanMinPaymentBalance - ", moreThanMinPaymentBalance)
    console.log("notBeingPaidBalance - ", notBeingPaidBalance)
    console.log("chargedOffBalance - ", chargedOffBalance)

    const minPaymentPercentage = (minPaymentBalance / totalBalance) * 100;
    const moreThanMinPaymentPercentage = (moreThanMinPaymentBalance / totalBalance) * 100;
    const notBeingPaidPercentage = (notBeingPaidBalance / totalBalance) * 100;
    const chargedOffPercentage = (chargedOffBalance / totalBalance) * 100;

    let paymentBehavior = "In great shape";

    if (minPaymentPercentage >= 35 && minPaymentPercentage <= 66.99) {
        paymentBehavior = "In good shape";
    }

    if (minPaymentPercentage >= 67) {
        paymentBehavior = "Kicking the can down the road";
    }

    if (notBeingPaidPercentage >= 9.99 || chargedOffPercentage >= 1) {
        paymentBehavior = "Have a serious situation brewing";
    }

    return {
        minPaymentPercentage,
        moreThanMinPaymentPercentage,
        notBeingPaidPercentage,
        chargedOffPercentage,
        paymentBehavior
    };
}
