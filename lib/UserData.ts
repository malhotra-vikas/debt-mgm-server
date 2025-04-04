export interface UserCardPurpose {
    cardPurpose: string;
    purposeFrequency: string;
}

// Define the type for AI Narrative structure
export interface AINarrative {
    para1: string;
    para2: string;
    para3?: string
}

export interface UserCard {
    balance: number;
    cardType: string;
    interest: number;
    creditLimit: number;
    cardUseStatus: string;
    monthlyPaymentType: string;
    paymentTimelyStatus: string;
    minPaymentDue: number;
    totalInterestPaid: number;
    payoffMonths: number;
    yearsToPayoff: string;
    debtFreeDate: string    
}

export interface UserDebt {
    debtType: string;
    amountOwed: number;
    entityName: string;
    inCollection: string;
    isPaymentPlan: string;
    paymentStatus: string;
    monthlyPaymentAmount: number;
    collectionCompanyName: string;
}

export interface Data {
    monthly: number;
    homeAsset: string;
    userCards: UserCard[];
    homeAddress: string;
    personEmail: string;
    savingAsset: string;
    annualSalary: string;  // If this is a large number, you might want to treat it as a number in your calculations later
    savingAmount: string;
    savingAssets: string;
    savingsValue: number;
    allLifeEvents: string;
    annualBonuses: string;
    situationType: string;
    AlimonyEndDate: string;
    AlimonyMonthly: string;
    personLastName: string;
    userOtherDebts: UserDebt[];
    catastropicLoss: string;
    homeEquityValue: number;
    homeMarketValue: string;
    personFirstName: string;
    recentLifeEvent: string;
    homeMortgageOwed: string;
    incomeChangeDate: string;
    severenceEndDate: string;
    severenceMonthly: string;
    disabilityEndDate: string;
    disabilityMonthly: string;
    educationExpenses: string;
    userCardsPurposes: UserCardPurpose[];
    workerCompEndDate: string;
    workerCompMonthly: string;
    extendedFamilyCare: string;
    incomeChangeReason: string;
    spouseAnnualSalary: number;
    childSupportEndDate: string;
    childSupportMonthly: string;
    futureIncomeChanges: string;
    homeChangesOpenness: string;
    unemploymentEndDate: string;
    unemploymentMonthly: string;
    assetsForLiquidation: string;
    creditScoreImportance: string;
    socialSecurityEndDate: string;
    socialSecurityMonthly: string;
    userRetirementEndDate: string;
    userRetirementMonthly: string;
    assetsLiquidationAmount: number;
    currentlyEmployedFullTime: string;
    currentlyEmployedPartTime: string;
}
// UserData.ts (the interface definition in a separate file)
export interface UserCardPurpose {
    cardPurpose: string;
    purposeFrequency: string;
}

export interface UserCard {
    balance: number;
    cardType: string;
    interest: number;
    creditLimit: number;
    cardUseStatus: string;
    monthlyPaymentType: string;
    paymentTimelyStatus: string;
}

export interface UserDebt {
    debtType: string;
    amountOwed: number;
    entityName: string;
    inCollection: string;
    isPaymentPlan: string;
    paymentStatus: string;
    monthlyPaymentAmount: number;
    collectionCompanyName: string;
}

export interface UserData {
    monthly: number;
    homeAsset: string;
    userCards: UserCard[];
    homeAddress: string;
    personEmail: string;
    savingAsset: string;
    annualSalary: string;
    savingAmount: string;
    savingAssets: string;
    savingsValue: number;
    allLifeEvents: string;
    annualBonuses: string;
    situationType: string;
    AlimonyEndDate: string;
    AlimonyMonthly: string;
    personLastName: string;
    userOtherDebts: UserDebt[];
    catastropicLoss: string;
    homeEquityValue: number;
    homeMarketValue: string;
    personFirstName: string;
    recentLifeEvent: string;
    homeMortgageOwed: string;
    incomeChangeDate: string;
    severenceEndDate: string;
    severenceMonthly: string;
    disabilityEndDate: string;
    disabilityMonthly: string;
    educationExpenses: string;
    userCardsPurposes: UserCardPurpose[];
    workerCompEndDate: string;
    workerCompMonthly: string;
    extendedFamilyCare: string;
    incomeChangeReason: string;
    spouseAnnualSalary: number;
    childSupportEndDate: string;
    childSupportMonthly: string;
    futureIncomeChanges: string;
    homeChangesOpenness: string;
    unemploymentEndDate: string;
    unemploymentMonthly: string;
    assetsForLiquidation: string;
    creditScoreImportance: string;
    socialSecurityEndDate: string;
    socialSecurityMonthly: string;
    userRetirementEndDate: string;
    userRetirementMonthly: string;
    assetsLiquidationAmount: number;
    currentlyEmployedFullTime: string;
    currentlyEmployedPartTime: string;
}
