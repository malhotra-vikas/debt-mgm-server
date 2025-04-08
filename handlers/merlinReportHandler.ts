import { Request, Response, NextFunction } from "express";
import { getUserByEmail } from "../database/postGresDBOperations";
import path from "path";
import puppeteer from "puppeteer"; // Import Puppeteer
import axios from "axios";
import dotenv from "dotenv";

// Importing the UserData interface if needed
import { AINarrative, Data, UserCard } from "../lib/UserData";  // Adjust this path as needed
import { calculateCardPaymentAmounts, calculateCardPaymentStatus, calculateCreditCardUtilization, calculatePaymentSchedule, calculateTax, calculateAllIncomesForUserHousehold, computeHairCutPercentage, emphasizeKeyPhrases, FormValues, getSentimentLabel } from "../lib/report-utils";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const MERLIN_PERSONA = `Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). 
You're a financial advisor summarizing a user's credit health. 
Your goal is to build a trust worthy and reliable debt management report for the users. 
Your responses will be added to the report that is sent to the users`

// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}

interface RecommendationFactor {
    factorKey: string;
    factorValue: string;
}

export interface IncomeDetails {
    houseHoldAnnualIncome: number;
    spouseAnnualIncome: number;
    userAnnualIncome: number;
    socialSecurityMonthly: number;
    socialSecurityEndDate: string;

    unemploymentMonthly: number;
    unemploymentEndDate: string;

    childSupportMonthly: number;
    childSupportEndDate: string;

    workerCompMonthly: number;
    workerCompEndDate: string;

    disabilityMonthly: number;
    disabilityEndDate: string;

    severanceMonthly: number;
    severanceEndDate: string;

    alimonyMonthly: number;
    alimonyEndDate: string;

    retirementMonthly: number;
    userRetirementEndDate: string;

    partTimeMonthly: number;
    consultingMonthly: number;
}

type OtherDebt = {
    debtType: string;              // Type of debt (e.g., "Federal Tax")
    amountOwed: number;            // Amount owed
    entityName: string;            // Entity name (e.g., "IRS")
    inCollection: "Yes" | "No";     // Whether the debt is in collection ("Yes" or "No")
    isPaymentPlan: "Yes" | "No";   // Whether the debt is in a payment plan ("Yes" or "No")
    paymentStatus: string;         // Payment status (e.g., "Unknown")
    monthlyPaymentAmount: number;  // Monthly payment amount
    collectionCompanyName: string; // Collection company name (if applicable)
};

type UserOtherDebts = OtherDebt[]; // Array of debts

type ReportData = {
    email: string;
    firstName: string;
    fetchAllIncomeForHousehold: IncomeDetails,
    userDisposableIncome: number;
    lastName: string;
    houseHoldAnnualIncome: number;
    spouseAnnualSalary: number;
    federalTaxes: number;
    incomeHairCutPercentage: number;
    lifeEventsList: string,
    debtCards: UserCard[]; // Assuming userCards is an array of UserCard objects
    chartBase64: string;
    aiNarrativeHouseholdIncome: AINarrative;
    aiNarrativeIncomeToDebt: string;
    otherDebts: OtherDebt[];
    totalCCDebt: number;
    totalOtherDebt: number;
    userCardUsagePurposes: string;
    futureIncomeChanges: string;
    homeChangesOpenness: string;
    assetsLiquidationAmount: number;
    creditScoreImportance: string;
    desiredDebtFreeTimeframe: string;
    feelingAboutDebtSituation: string;
    aiNarrativeFinalRecommendation: string
    recommendation: string
    summary: string
    recommendationFactors: RecommendationFactor[]
    finalNote: string

    //recommendations: string[]; // Assuming recommendations is an array of strings
};

const generatePieChart = async (): Promise<Buffer> => {
    const chartData = {
        type: "pie",
        data: {
            labels: ["Housing", "Transportation", "Food", "Insurance & Pensions", "Healthcare", "Misc", "Savings/Disposable"],
            datasets: [{
                data: [33, 17, 13, 12, 5, 8, 12],
                backgroundColor: [
                    "#1E3A8A", // Dark blue
                    "#3B82F6", // Light blue
                    "#60A5FA", // Lightest blue
                    "#D1D5DB", // Light gray
                    "#9CA3AF", // Gray-blue
                    "#4B5563", // Dark gray
                    "#374151"  // Charcoal gray
                ]
            }]
        },
        options: {
            plugins: {
                doughnut3d: {
                    enabled: true, // Enable 3D effect
                    rotation: 45, // Set the angle of rotation
                    depth: 30,   // Set the depth of the 3D effect
                    light: {
                        intensity: 1.2, // Set the light intensity for 3D effect
                        angle: 45 // Set the light angle
                    }
                }
            },
            responsive: true,
            legend: {
                position: 'bottom',  // Move legend to the bottom
                labels: {
                    fontColor: '#000', 
                    boxWidth: 20, // Set the size of the legend box
                    padding: 10 // Add padding around the legend items
                }
            },
            // To improve text contrast in the chart
            tooltips: {
                callbacks: {
                    label: function(tooltipItem: { label: string; raw: string; }) {
                        return tooltipItem.label + ": " + tooltipItem.raw + "%"; // Show percentage on hover
                    }
                }
            }
        }
    };

    try {
        // Create the chart using QuickChart API
        const response = await axios.post("https://quickchart.io/chart/create", {
            chart: chartData
        });

        const chartUrl = response.data.url;

        // Now fetch the image from the URL and return it as a Buffer
        const imageResponse = await axios.get(chartUrl, { responseType: 'arraybuffer' });
        return Buffer.from(imageResponse.data);  // Return the image as a Buffer
    } catch (error) {
        console.error("❌ Error generating pie chart:", error);
        throw new Error("Failed to generate pie chart.");
    }
};

const generatePdfWithPuppeteer = async (reportData: ReportData, email: string): Promise<string> => {
    //    const browser = await puppeteer.launch();
    const browser = await puppeteer.launch({
        headless: true, // or true for older versions
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Get the current timestamp to append as a cache buster
    const timestamp = new Date().getTime();
    const url = `http://${process.env.HOST}:${process.env.PORT}/styles/report.css?timestamp=${timestamp}`

    let userDisposableIncome = ((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * (12 + reportData.incomeHairCutPercentage) / 100

    let aggregateCCDebt = reportData.debtCards.reduce((sum, card) => sum + card.balance, 0);
    let aggregateCCLimit = reportData.debtCards.reduce((sum, card) => sum + card.creditLimit, 0);
    let aggregateCCMinimumPayment = reportData.debtCards.reduce((sum, card) => sum + card.minPaymentDue, 0);
    let aggregateCCInterestPayment = reportData.debtCards.reduce((sum, card) => sum + card.totalInterestPaid, 0);
    const maxMonths = Math.max(...reportData.debtCards.map(card => card.payoffMonths));
    const maxDebtFreeDate = new Date(
        Math.max(
            ...reportData.debtCards.map(card => new Date(card.debtFreeDate).getTime())
        )
    );

    // Find the card with the latest debt-free date
    const latestCard = reportData.debtCards.find(card => new Date(card.debtFreeDate).getTime() === maxDebtFreeDate.getTime());
    //console.log("Latest debt-free date:", maxDebtFreeDate);

    const debtFreeDate = latestCard?.debtFreeDate
    //console.log("Max debt-free date:", debtFreeDate);


    const payoffSummary = `Based on your current balances and interest rates, paying only the minimum due will take approximately ${maxMonths} months to become debt-free. Over that time, you'll pay an estimated $${aggregateCCInterestPayment.toFixed(2)} in interest.`;

    let debtOverView = `You have an aggregate Credit Card Debt of $${aggregateCCDebt.toFixed(2)}. Your combined credit limit is $${aggregateCCLimit.toFixed(2)}.
            This puts you at a Credit Utilization bracket of ${(aggregateCCDebt / aggregateCCLimit * 100).toFixed(2)}%.
            Merlin estimates that your combined monthly minimum payment is about $${aggregateCCMinimumPayment}`

    let disposableIncomeOverView = `We estimate your Disposable Income (also known as monthly income available for you to payoff your debts) to be $${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * (12 + reportData.incomeHairCutPercentage) / 100).toFixed(2)} per month.`

    //console.log("debtOverView framed as ", debtOverView)
    //console.log("disposableIncomeOverView framed as ", disposableIncomeOverView)

    const sentimentLabel = getSentimentLabel(
        aggregateCCDebt / aggregateCCLimit * 100,
        aggregateCCMinimumPayment,
        userDisposableIncome
    );

    const creditCardUtilization = calculateCreditCardUtilization(reportData.debtCards)
    //console.log("creditCardUtilization framed as ", creditCardUtilization)

    const cardPaymentStatus = calculateCardPaymentStatus(reportData.debtCards)
    //console.log("cardPaymentStatus framed as ", cardPaymentStatus)

    const cardPaymentAmount = calculateCardPaymentAmounts(reportData.debtCards)
    //console.log("cardPaymentAmount framed as ", cardPaymentAmount)

    // Define the HTML content for the PDF
    const content = `
<html>
  <head>
    <link rel="stylesheet" type="text/css" href="http://${process.env.HOST}:${process.env.PORT}/styles/report.css?timestamp=${Date.now()}">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  </head>
  <body>
    <!-- Logo Header -->
    <div class="header">
      <img src="http://${process.env.HOST}:${process.env.PORT}/logo/logo.png" class="logo" alt="Merlin Logo" />
    </div>

    <div class="container">

      <h1>Merlin Assessment Report for ${reportData.firstName} ${reportData.lastName}</h1>

            <!-- Income Section -->
      <div class="section">
        <h2 class="section-title">Here is what we know</h2>
            <p>Based on national averages, published at 
            <a href="https://infogram.com/expenses-category-chart-1hdw2jpqnzp5j2l/" target="_blank" rel="noopener noreferrer">American Households Average Monthly Expenses</a> 
            this pie chart shows how an Average American Household budget their income for various expenses.
            </p>

            <img src="http://${process.env.HOST}:${process.env.PORT}/chart.png" alt="Pie Chart of Household Spending" />

      </div>

      <!-- Income Section -->
      <div class="section">
        <h2 class="section-title">Your Household Income</h2>
        <div class="ai-summary">
          <p>${reportData.firstName}, Your annual household income is <span clas='bold'>$${reportData.fetchAllIncomeForHousehold.houseHoldAnnualIncome}</span>. This equates to a monthly income of <span clas='bold'>$${(reportData.fetchAllIncomeForHousehold.houseHoldAnnualIncome / 12).toFixed(2)}</span> before taxes.</p>

          <p> As per the information Merlin gathered with you, here are your income sources.
            <ul>
            <!-- Iterate over income sources and display only those that are non-zero -->
            ${Object.entries(reportData.fetchAllIncomeForHousehold).map(([key, value]) => {
        // Skip 'houseHoldAnnualIncome' because it's already displayed above
        if (key === 'houseHoldAnnualIncome' || value === 0 || key.endsWith('EndDate')) return ''; // Skip zero and the main income, and "End Date" keys

        // Customize the label for 'userAnnualIncome'
        let label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()); // Convert camelCase to space-separated words and capitalize
        if (key === 'userAnnualIncome') {
            label = 'Your Annual Income'; // Replace 'User Annual Income' with 'Your Annual Income'
        }

        // Extract end date from the income source (e.g., for socialSecurity, check for socialSecurityEndDate)
        let endDate = null;
        if (key === 'socialSecurityMonthly') endDate = reportData.fetchAllIncomeForHousehold.socialSecurityEndDate;
        else if (key === 'childSupportMonthly') endDate = reportData.fetchAllIncomeForHousehold.childSupportEndDate;
        else if (key === 'workerCompMonthly') endDate = reportData.fetchAllIncomeForHousehold.workerCompEndDate;
        else if (key === 'disabilityMonthly') endDate = reportData.fetchAllIncomeForHousehold.disabilityEndDate;
        else if (key === 'severanceMonthly') endDate = reportData.fetchAllIncomeForHousehold.severanceEndDate;
        else if (key === 'alimonyMonthly') endDate = reportData.fetchAllIncomeForHousehold.alimonyEndDate;
        else if (key === 'userRetirementMonthly') endDate = reportData.fetchAllIncomeForHousehold.userRetirementEndDate;

        // If there is an end date, format and append it; if no valid end date, don't show the "Ending mm/dd/yyyy"
        let endDateLabel = '';
        if (endDate && new Date(endDate) > new Date()) {
            const formattedEndDate = new Date(endDate).toLocaleDateString('en-US'); // Format the end date as mm/dd/yyyy
            endDateLabel = `: Ending ${formattedEndDate}`;
        }

        // Add "Ending dd/mm/yy" only for income sources that have an end date
        if (endDateLabel) {
            label = `${label}${endDateLabel}`;
        }

        return `<li>${label}: $${value}</li>`;
    }).join('')}
            </ul>


          <p><em>${emphasizeKeyPhrases(reportData.aiNarrativeHouseholdIncome.para1)}</em></p>
        </div>

        <p>Based on national average, this is how Merlin has estimated your household budget</p>

        <table>
        <tr>
            <th>Expense Category</th>
            <th>Typical American Household Allocation Percentage</th>
            <th>Your Monthly spend</th>

        </tr>
        ${[
            { category: 'Housing', percentage: 33 },
            { category: 'Transportation', percentage: 17 },
            { category: 'Food', percentage: 13 },
            { category: 'Insurance & Pensions', percentage: 12 },
            { category: 'Healthcare', percentage: 5 },
            { category: 'Miscellaneous', percentage: 8 },
            { category: 'Savings/Disposable', percentage: 12 }
        ].map(item => `
        <tr ${item.category === 'Savings/Disposable' ? 'style="background-color: yellow; font-weight: bold;"' : ''}>
            <td>${item.category}${item.category === 'Savings/Disposable' ? ' 1' : ''}</td>
            <td>${item.percentage}%</td>
            <td>$${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * item.percentage / 100).toFixed(0)}</td>
        </tr>
        `).join('')}
        </table>
        <p><small>1 Applying the national average of Saving/ Disposable income Merlin has estimated that you have about <span class='bold'>$${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * 12 / 100).toFixed(0)}</span> of Disposable income in your household. This is your available monthly disposable income for debt repayments.</p>

      </div>

      <!-- Life Events -->
      <div class="section">
        <h2 class="section-title">Life Events Analysis</h2>

          <!-- Conditionally Render Life Events -->
          <div class="ai-summary" id="lifeEventsAnalysis">
            ${reportData.lifeEventsList && reportData.lifeEventsList.length > 0 ? `
              <p><em>Given your income and national average of household spending, Merlin determined your disposable income available to address your debt to be approximately <span class='bold'>$${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * 12 / 100).toFixed(0)}</span>.
               However given the life events you discussed, and our percieved financial impact of such life events. Merlin has made adjustment to account for these and estimates your disposible income to 
               be <span class='bold'>$${(reportData.userDisposableIncome).toFixed(0)}</span></em></p>
            ` : `
              <p><em>Given your income and national average of household spending, Merlin determined your disposable income available to address your debt to be approx <span class='bold'>$${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * 12 / 100).toFixed(0)}</span>.</em></p>
            `}
          </div>    
      </div>

      <!-- Debt Overview -->
      <div class="section">
        <h2 class="section-title">Credit Card Details</h2>
        <table>
          <tr>
            <th>Card Type</th>
            <th>Balance</th>
            <th>Interest Rate</th>
            <th>Payment Status</th>
            <th>Typical Payment</th>
            <th>Current Behavior</th>
          </tr>
          ${reportData.debtCards.map(card => `
            <tr>
              <td>${card.cardType}</td>
              <td>$${card.balance.toFixed(2)}</td>
              <td>${card.interest}%</td>
              <td>${card.paymentTimelyStatus}</td>
              <td>${card.monthlyPaymentType}</td>
              <td>${card.cardUseStatus}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <!-- Payoff Outlook -->
      <div class="section page-break">
        <br>
        <h2 class="section-title">Your Debt Analysis</h2>
        <p>Based on your Credit Card Details, Merlin estimates your Minimum Monthly Payment for each card to be:</p>

        <ul>
        ${reportData.debtCards.map(card => {
            // Get the minimum monthly payment for each card (assuming `minPaymentDue` is already a number)
            const minMonthlyPayment = card.minPaymentDue.toFixed(2); // Format to 2 decimal places

            return `<li>${card.cardType}: $${minMonthlyPayment}</li>`;
        }).join('')}
        
        </ul>

        <!-- Total across all cards -->
        <p><strong>Minimum Monthly Payment across all your cards:</strong> $
            ${reportData.totalCCDebt} 
        </p>


        <p>Based on your Card Balances and Credit Limits, here are the Utilization for each card:</p>

        <ul>
        ${creditCardUtilization.cardUtilizations.map(card => {
            return `<li>${card.cardType}: ${card.utilization.toFixed(2)}% - ${card.utilizationLabel}</li>`;
        }).join('')}
        

            <div class="metrics">
        <!-- Credit Card Utilization -->
        <div class="metric">
            <h3>Your Overall Credit Card Utilization</h3>
            <!-- Circular meter for utilization -->
            <div class="utilization-meter-container">
                <svg class="utilization-meter" width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- Background circle -->
                    <circle cx="50" cy="50" r="40" stroke="#ddd" stroke-width="6" fill="none" />
                    <!-- Foreground circle representing utilization -->
                    <circle cx="50" cy="50" r="40" stroke="url(#grad)" stroke-width="6" fill="none" stroke-dasharray="${creditCardUtilization.totalUtilization * 2.51}, 251" />
                    <!-- Text in the center showing utilization percentage -->
                    <!-- Gradient for color transition from green to red -->
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:green;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:red;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <!-- Percentage text under the meter -->
            <div class="utilization-text">${creditCardUtilization.totalUtilization.toFixed(1)}%</div>
            <div class="utilization-text">Your Credit Card Utilization is : <span class="bold">${creditCardUtilization.totalUtilizationLabel}</span></div>
        </div>

    </div>

        <p>Assuming you only make minimum monthly payments on your Credit Cards, this is what Merlin estimates the time to payoff each card

            <div class="cards-visual">
            ${reportData.debtCards.map(card => {
            const maxMonths = Math.max(...reportData.debtCards.map(c => c.payoffMonths));  // Get the max months to pay off
            const barWidth = (card.payoffMonths / maxMonths) * 100;  // Calculate width based on months
            const years = Math.floor(card.payoffMonths / 12);  // Convert months to years
            const months = card.payoffMonths % 12;  // Get the remaining months

            // Year Labels: Show only Year 1 at the start and Year N at the end
            const yearLabels = `Year 1`;

            // Color gradient or intensity based on totalInterestPaid
            //const interestIntensity = Math.min((card.totalInterestPaid / Math.max(...reportData.debtCards.map(c => c.totalInterestPaid))) * 100, 100);
            //            const barColor = `hsl(${120 - interestIntensity}, 100%, 40%)`; // Green to red gradient based on interest paid
            const barColor = '#3498db'; // Blue color for the bar

            return `
                <div class="card-visual">
                    <div class="card-label">${card.cardType}</div>
                    <div class="interest-bar-container">
                    <div class="interest-bar" style="width: ${barWidth}%; background-color: ${barColor};">
                        <span class="interest-amount"></span>
                    </div>
                    <div class="year-labels">
                        <span class="year-label start">${yearLabels.split(' | ')[0]}</span>
                    </div>
                    </div>
                    <div class="time-bar-label">${years} years ${months} months</div>
                </div>
                `;
        }).join('')}
        </div>

        <div class="ai-summary">
            <p>Assuming you pay minimum payment on each of your Credit Card until payoff, this is the percentage of original outstanding balance that you will pay in Interest for each card</p>

                <ul>
        ${reportData.debtCards.map(card => {
            // Calculate the total interest paid for the card
            const totalInterest = card.totalInterestPaid;
            const interestPercentage = ((totalInterest / card.balance) * 100).toFixed(2); // Calculate interest as percentage of balance

            return `<li>${card.cardType}: <strong>${interestPercentage}% of the original outstanding balance in Interest</strong></li>`;
        }).join('')}
                </ul>

        </div>

        <div class="ai-summary">
            <p>Here is a summary of your payment behavior across all of your credit cards:</p>

            <ul>
                ${cardPaymentStatus.cardPaymentStatuses.map(card => {
            // For each card, show the payment status and timely status
            return `<li>
                        ${card.cardType}: 
                        <strong>${card.paymentStatus}</strong> (Payment Timely Status: ${card.paymentTimelyStatus}):

                    </li>`;
        }).join('')}
                
            </ul>
        </div>

    </div>


<div class="section">
    <h2 class="section-title">Other Debt</h2>
    <div class="ai-summary">
        ${reportData.otherDebts && reportData.otherDebts.length > 0 ? `
        <p><em>Based on the details your shared on your other/ Non Credit Card Debts, Merlin has estimated your Monthly Minimum Payment for these debts as below: </em></p>
        
        <ul>
        ${reportData.otherDebts.map(debt => {
            // Use monthlyPaymentAmount if it exists, otherwise compute based on debt type
            let minimumPayment: number = debt.monthlyPaymentAmount > 0 ? debt.monthlyPaymentAmount : 0;

            if (minimumPayment === 0) { // If monthlyPaymentAmount is not provided or is zero, compute it
                switch (debt.debtType) {
                    case "Medical":
                    case "Federal Tax":
                    case "State Tax":
                        minimumPayment = debt.amountOwed / 36; // Balance owed divided by 36 months
                        break;
                    case "Personal Loan":
                        minimumPayment = debt.amountOwed / 60; // Balance owed divided by 60 months
                        break;
                    case "Student Loan":
                    case "Other":
                        minimumPayment = debt.amountOwed / 120; // Balance owed divided by 120 months
                        break;
                    default:
                        minimumPayment = 0; // Default if no matching type, though shouldn't occur
                }
            }

            // Display the debt type, balance owed, and the calculated or provided minimum monthly payment
            return `
            <li>
                <strong>${debt.debtType}</strong>: 
                Balance Owed: $${debt.amountOwed.toFixed(2)} 
                | Minimum Monthly Payment: $${minimumPayment.toFixed(2)}
            </li>`;
        }).join('')}
        </ul>

        <!-- Total Minimum Monthly Payment -->
        <p><strong>Total Minimum Monthly Payment across all other debts:</strong> $${reportData.totalOtherDebt}</li>
        </p>

        ` : `
        <p><em>No debts other than Credit Card debts shared with Merlin.</em></p>
        `}
    </div>


</div>

        <div class="section">
            <h2 class="section-title">Total Monthly Debt Costs</h2>
                <div class="ai-summary">
                    <ul>
                        <li><strong>Your Monthly Payment Obligation across all your Credit Cards:</strong> $
                ${reportData.totalCCDebt} 
                        </li>
                        <li><strong>Your Monthly Payment Obligation across all of your Other Debts:</strong> $
${reportData.totalOtherDebt}                        </li>
                    </ul>

        <!-- Total Monthly Payment Obligation -->
        <p><strong>Merlin estimates your total minimum monthly obligation across all of your debts (Credit Cards + Other Debts) is:</strong> $
            ${(
            reportData.debtCards.reduce((total, card) => total + card.minPaymentDue, 0) +
            reportData.otherDebts.reduce((total, debt) => {
                let minimumPayment = debt.monthlyPaymentAmount > 0 ? debt.monthlyPaymentAmount : 0;

                if (minimumPayment === 0) { // If no provided payment amount, calculate it
                    switch (debt.debtType) {
                        case "Medical":
                        case "Federal Tax":
                        case "State Tax":
                            minimumPayment = debt.amountOwed / 36;
                            break;
                        case "Personal Loan":
                            minimumPayment = debt.amountOwed / 60;
                            break;
                        case "Student Loan":
                        case "Other":
                            minimumPayment = debt.amountOwed / 120;
                            break;
                        default:
                            minimumPayment = 0;
                    }
                }
                return total + minimumPayment;
            }, 0)
        ).toFixed(2)}
        </p>

        <p><strong>Merlin estimated your monthly disposible income to payoff your debts to be $${userDisposableIncome.toFixed(0)}</strong>

          <p><em>${emphasizeKeyPhrases(reportData.aiNarrativeIncomeToDebt)}</em></p>


                </div>        
 

        <div class="section page-break">
            <h2 class="section-title">Merlin's Recommendation</h2>
                <div class="section recommendation">
                    <p><em>${emphasizeKeyPhrases(reportData.recommendation)}</em></p>          
                    <p><em>${emphasizeKeyPhrases(reportData.summary)}</em></p>                
                </div>

            <h2 class="section-title">Recommendation Factors:</h2>

            <ul class="factors-list">
                ${reportData.recommendationFactors.map((recommendationFactor: RecommendationFactor) => {
            const key = recommendationFactor.factorKey;
            const value = recommendationFactor.factorValue; // You can calculate additional logic here if needed

            return `<li>${key}: ${value}</li>`; // Properly close <li> and <span>
        }).join('')}
            </ul>



                <div class="section final-note">
            <h2 class="section-title">Final Note:</h2>
                        
                                <p><em>${emphasizeKeyPhrases(reportData.finalNote)}</em></p>          
                        </div>


        </div>    
        
<div class="section  page-break">
    <h2 class="section-title">Tools and Next Steps</h2>

    <p>Here are some helpful steps you can take to better understand and manage your debt:</p>

    <ul>
        <li>
            <strong>Calculate Credit Card Payoff Time:</strong> 
            To find out how long it will take to pay off your credit cards, visit 
            <a href="https://dealingwithdebt.org/credit-card-payoff-calculator/" target="_blank" rel="noopener noreferrer">
                Dealing With Debt’s free calculator tool
            </a>.
        </li>
        <li>
            <strong>Learn About Debt Relief Paths:</strong>
            Gain a deep understanding of debt relief options (forgiveness and restructuring) by taking a free course called 
            <a href="https://dealingwithdebt.org/courses/tgtydsj/" target="_blank" rel="noopener noreferrer">
                "The Guide to Your Debt Relief Journey"
            </a> offered by Dealing With Debt.
        </li>
        <li>
            <strong>Understand Debt Relief Regulations:</strong>
            Visit regulatory websites like the 
            <a href="https://www.ftc.gov" target="_blank" rel="noopener noreferrer">Federal Trade Commission (FTC)</a> or the 
            <a href="https://www.consumerfinance.gov/" target="_blank" rel="noopener noreferrer">Consumer Financial Protection Bureau (CFPB)</a>, or your state’s attorney general website. 
            You can also use this 
            <a href="https://www.naag.org/find-my-state-attorney-general/" target="_blank" rel="noopener noreferrer">directory</a> to find your state’s office.
        </li>
        <li>
            <strong>Find Reputable Debt Relief Companies:</strong>
            Visit the trade association websites for accredited companies, such as 
            <a href="https://www.cdrionline.org/" target="_blank" rel="noopener noreferrer">Consumer Debt Relief Initiative (CDRI)</a> and/or 
            <a href="https://www.aadr.org/" target="_blank" rel="noopener noreferrer">American Association for Debt Relief (AADR)</a>.
        </li>
        <li>
            <strong>Check Consumer Reviews:</strong>
            For consumer reviews on specific companies, check their ratings on reputable websites like 
            <a href="https://www.bbb.org/" target="_blank" rel="noopener noreferrer">Better Business Bureau (BBB)</a> or 
            <a href="https://www.trustpilot.com/" target="_blank" rel="noopener noreferrer">TrustPilot</a>.
        </li>
        <li>
            <strong>Seek Personalized Support:</strong>
            For more personalized support, reach out to a non-profit credit counseling company, such as the 
            <a href="https://www.nfcc.org/" target="_blank" rel="noopener noreferrer">National Foundation for Credit Counseling</a>.
        </li>
        <li>
            <strong>Join a Supportive Community:</strong>
            For additional support and guidance, join Dealing With Debt’s judgment-free community to engage with peers. Visit 
            <a href="https://dealingwithdebt.org/" target="_blank" rel="noopener noreferrer">Dealing With Debt</a> to join.
        </li>
    </ul>
</div>

    </div>
  </body>
</html>

    `;

    // Set the content and generate the PDF
    //await page.setContent(content);
    await page.setContent(content, { waitUntil: 'load' });

    const pdfPath = path.join(__dirname, `../uploads/${email}.pdf`);
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true
    });

    await browser.close();

    return pdfPath;
};

const merlinReportHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("📌 Event Starting - Handling Request");

    try {
        if (req.method === "GET") {
            const { email } = req.query;

            // Input validation
            if (!email || typeof email !== "string") {
                console.log("📌 Validation Error - Email is required as a query parameter");
                res.status(400).json({ error: "Validation Error - Email is required as a query parameter" });
                return;
            }

            console.log("📌 Fetching Data for Email:", email);

            // Fetch user by email from the database
            const userData: UserData | null = await getUserByEmail(email);

            if (!userData) {
                console.log("📌 User not found for Email:", email);
                res.status(404).json({ error: "User not found" });
                return;
            }

            console.log("📌 Successfully fetched user data for Email:", email);
            let userName = userData.data.personFirstName

            let fetchAllIncomeForHousehold = calculateAllIncomesForUserHousehold(userData);

            console.log("fetchAllIncomeForHousehold os ", fetchAllIncomeForHousehold)


            let houseHoldAnnualIncome = fetchAllIncomeForHousehold.houseHoldAnnualIncome
            let spouseAnnualSalary = fetchAllIncomeForHousehold.spouseAnnualIncome
            let userAnnualSalary = fetchAllIncomeForHousehold.userAnnualIncome

            console.log("📌 Successfully computed Annual Household Income :", houseHoldAnnualIncome);
            console.log("📌 Successfully computed Annual Spouse Income :", spouseAnnualSalary);

            let filingStatus: 'single' | 'joint' = 'single';  // Default to 'single'

            // Check if the spouse has an annual salary and if it's valid (non-empty, greater than 0)
            if (spouseAnnualSalary && parseFloat(userData.data.spouseAnnualSalary) > 0) {
                filingStatus = 'joint';  // Set to 'joint' if spouse has a valid salary
            }

            let federalTaxes = calculateTax(houseHoldAnnualIncome, filingStatus);
            console.log("📌 Successfully computed Federal Taxes :", federalTaxes);

            let estimateTaxBracket = federalTaxes / houseHoldAnnualIncome;
            console.log("📌 Successfully computed Federal Estimate TaxBracket :", estimateTaxBracket);

            let afterTaxAnnualIncome = houseHoldAnnualIncome - federalTaxes;
            let afterTaxMonthlyIncome = afterTaxAnnualIncome / 12;

            console.log(`📌 Successfully computed After Taxes income. Annual: ${afterTaxAnnualIncome} and Monthly: ${afterTaxMonthlyIncome}`);

            const aiNarrativeHouseholdIncome = await buildAiNarrativeHouseholdIncome(userName, houseHoldAnnualIncome, spouseAnnualSalary, federalTaxes, estimateTaxBracket, afterTaxAnnualIncome, afterTaxMonthlyIncome)
            console.log(`📌 Successfully computed aiNarrativeHouseholdIncome: ${aiNarrativeHouseholdIncome} `);


            let userEventsAndImppact = computeHairCutPercentage(userData);
            let incomeHairCutPercentage = userEventsAndImppact.hairCutPercentage
            let userLifeEvents = userEventsAndImppact.lifeEvents
            let originalDisposableIncome = ((houseHoldAnnualIncome - federalTaxes) / 12) * (12) / 100
            let userDisposableIncome = ((houseHoldAnnualIncome - federalTaxes) / 12) * (12 + incomeHairCutPercentage) / 100

            const lifeEventsList = userLifeEvents
                .filter(event => event !== '') // Remove any empty strings
                .map(event => `<li>${event}</li>`) // Format each life event as a list item
                .join(''); // Join all list items into a single string


            console.log("📌 Successfully computed Income Hair Cut due to Life Events:", incomeHairCutPercentage);
            console.log("📌 Successfully computed User Life Events:", lifeEventsList);

            const enrichedCards = userData.data.userCards.map((card: any) => {
                const interestRate = parseFloat(card.interest) || 0;
                const monthlyRate = interestRate / 100 / 12;
                const minPaymentDue = (monthlyRate * card.balance) + (0.01 * card.balance);

                const formValues: FormValues = {
                    principal: card.balance,
                    apr: interestRate,
                    minimumPayment: 40,
                    additionalPayment: 0, // assume no extra payment
                    requiredPrincipalPercentage: 1 // 1% as per your logic
                };

                const [summary] = calculatePaymentSchedule(formValues);

                //console.log("summary came back as ", summary)

                return {
                    ...card,
                    minPaymentDue: parseFloat(minPaymentDue.toFixed(2)),
                    payoffMonths: summary.payoffMonths,
                    yearsToPayoff: summary.yearsToPayoff,
                    totalInterestPaid: summary.totalInterestPaid,
                    debtFreeDate: summary.revisedDebtFreeDate
                };
            });


            //console.log(" enrichedCards atds ",  enrichedCards)
            // Calculating total credit card debt
            const totalCCDebt = enrichedCards.reduce((total: any, card: { minPaymentDue: any; }) => {
                return total + card.minPaymentDue; // Sum the balance of each credit card
            }, 0).toFixed(2);

            //console.log(" userData.data.userOtherDebts atds ",  userData.data.userOtherDebts)

            // Calculating total other debt
            const totalOtherDebt = userData.data.userOtherDebts.reduce((total: any, debt: { monthlyPaymentAmount: number; debtType: any; amountOwed: number; }) => {
                let minimumPayment = debt.monthlyPaymentAmount > 0 ? debt.monthlyPaymentAmount : 0;
                if (minimumPayment === 0) { // If no provided payment amount, calculate it
                    switch (debt.debtType) {
                        case "Medical":
                        case "Federal Tax":
                        case "State Tax":
                            minimumPayment = debt.amountOwed / 36;
                            break;
                        case "Personal Loan":
                            minimumPayment = debt.amountOwed / 60;
                            break;
                        case "Student Loan":
                        case "Other":
                            minimumPayment = debt.amountOwed / 120;
                            break;
                        default:
                            minimumPayment = 0;
                    }
                }
                return total + minimumPayment;
            }, 0).toFixed(2);

            //console.log("TOTAL CC DEBET is ", totalCCDebt)
            //console.log("TOTAL OTHER DEBET is ", totalOtherDebt)

            const aiNarrativeIncomeToDebt = await buildAiNarrativeIncomeToDebt(userName, userDisposableIncome, totalCCDebt, totalOtherDebt)
            //console.log(`📌 Successfully computed aiNarrativeIncomeToDebt: ${aiNarrativeIncomeToDebt} `); 

            // Generate Pie Chart for Household Spending
            const chartBuffer = await generatePieChart();
            const chartBase64 = chartBuffer.toString('base64'); // Convert the chart to base64


            // Preparing data for the report
            const reportData: ReportData = {
                email,
                fetchAllIncomeForHousehold,
                // Capitalizing the first letter of the firstName
                firstName: userData.data.personFirstName.charAt(0).toUpperCase() + userData.data.personFirstName.slice(1),
                lastName: userData.data.personLastName.charAt(0).toUpperCase() + userData.data.personLastName.slice(1),
                userDisposableIncome,
                houseHoldAnnualIncome,
                spouseAnnualSalary,
                federalTaxes,
                lifeEventsList,
                incomeHairCutPercentage,
                debtCards: enrichedCards,
                chartBase64,
                aiNarrativeHouseholdIncome,
                aiNarrativeIncomeToDebt,
                otherDebts: userData.data.userOtherDebts,
                totalCCDebt: totalCCDebt,
                totalOtherDebt: totalOtherDebt,
                userCardUsagePurposes: userData.data.userCardsPurposes,
                futureIncomeChanges: userData.data.futureIncomeChanges,
                homeChangesOpenness: userData.data.homeChangesOpenness,
                assetsLiquidationAmount: userData.data.assetsLiquidationAmount,
                creditScoreImportance: userData.data.creditScoreImportance,
                desiredDebtFreeTimeframe: userData.data.desiredDebtFreeTimeframe,
                feelingAboutDebtSituation: userData.data.feelingAboutDebtSituation,
                aiNarrativeFinalRecommendation: "",
                recommendation: "",
                summary: "",
                recommendationFactors: [],
                finalNote: ""
            };

            const {
                chartBase64: _chartBase64,
                aiNarrativeHouseholdIncome: _aiNarrativeHouseholdIncome,
                aiNarrativeIncomeToDebt: _aiNarrativeIncomeToDebt,
                incomeHairCutPercentage: _incomeHairCutPercentage,
                houseHoldAnnualIncome: _houseHoldAnnualIncome,
                spouseAnnualSalary: _spouseAnnualSalary,
                lifeEventsList: _lifeEventsList,
                ...filteredReportData
            } = reportData;

            //console.log("Filtered REPORT DATA:", JSON.stringify(filteredReportData, null, 2));
            const aiNarrativeFinalRecommendation = await buildAiNarrativeFinalRecommendation(userName, JSON.stringify(filteredReportData, null, 2))
            const cleanedData = aiNarrativeFinalRecommendation.replace(/`/g, ''); // remove backticks
            // Remove the 'json' prefix and any potential extra whitespace
            const cleanedDataWithoutPrefix = cleanedData.replace(/^json/, '').trim();

            console.log("cleanedDataWithoutPrefix is ", cleanedDataWithoutPrefix);

            const jsonaiNarrativeFinalRecommendation = JSON.parse(cleanedDataWithoutPrefix);
            const { recommendation, summary, recommendationFactors, finalNote } = jsonaiNarrativeFinalRecommendation;


            console.log("recommendation is ", recommendation);
            console.log("summary is ", summary);
            console.log("recommendationFactors is ", recommendationFactors);
            console.log("finalNote is ", finalNote);

            reportData.recommendation = recommendation
            reportData.summary = summary
            reportData.recommendationFactors = recommendationFactors
            reportData.finalNote = finalNote

            // Generate PDF using Puppeteer
            const pdfPath = await generatePdfWithPuppeteer(reportData, email);

            // Return the PDF path in the response
            res.status(200).json({
                message: "PDF report generated successfully",
                reportUrl: `/uploads/${email}.pdf`
            });

        } else {
            console.log("📌 Method Not Allowed: ", req.method);
            res.status(405).json({ error: "Method Not Allowed" });
        }

    } catch (error) {
        console.error("❌ Error in merlinReportHandler:", error);
        next(error);
    }
};


// Function to format recommendation factors into a table
const formatRecommendationFactors = (factors: { [x: string]: any; }) => {
    let tableContent = '';
    for (let factor in factors) {
        tableContent += `
        <tr>
          <td><strong>${factor}</strong></td>
          <td>${factors[factor]}</td>
        </tr>
      `;
    }
    return tableContent;
};

// Helper functions for Debt Analysis and Recommendations

const generateRecommendations = (userData: UserData): string => {
    if (userData.data.savingsValue > 10000) {
        return "Consider using your savings for debt consolidation.";
    } else {
        return "Explore debt consolidation options or a payment plan.";
    }
};

export default merlinReportHandler;

async function runMerlinAI(effectivePrompt: string) {

    const chatMessages = [
        {
            role: "system", content: MERLIN_PERSONA
        },
        { role: "user", content: effectivePrompt }
    ];

    const openaiPayload = {
        model: "gpt-4o-mini",
        messages: chatMessages,
        stream: false,
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(openaiPayload),
        })


        if (!response.ok) {
            throw new Error(`OpenAI API Error: ${response.status} - ${response.statusText}`);
        }

        const responseData = await response.json(); // Extract JSON response
        //console.log("askOpenAI - Parsed Response:", responseData);

        // Extract AI response text safely
        const aiResponse = responseData?.choices?.[0]?.message?.content?.trim() || "No response from OpenAI";

        return aiResponse

    } catch (error: any) {
        console.error("Error in askOpenAI:", error);
        if (error.response) {
            console.error("HTTP status:", error.response.status);
            console.error("Response body:", error.response.data);
            if (error.response.status === 429) console.error("Rate limit exceeded.");
            if (error.response.status === 503) console.error("Service unavailable.");
        }
        return "I'm sorry, but I couldn't fetch an answer right now. Please try again later.";
    }
}


async function buildAiNarrativeFinalRecommendation(userName: string, userObject: string) {
    let effectivePrompt = `Here is what we know about the User's situation:
    
    User Details on Income, Debts, and Payment Behaviour: ${userObject}
    User's Name: ${userName}
    
    Based on this information, generate a personalized recommendations for the user, broken into 4 paragraphs. The response should be a JSON with these 4 parts/ paras
    1-para should be your recommendation. Use key "recommendation" in the JSON
    2-para should be a maximum of 40 words summary on why this is the right recoemmndation for the user. Use key "summary" in the JSON
    3-para should be a table of recommndation factors and how they map to the user's data. Use key "recommendationFactors" in the JSON. This should have factorKey and factorValue.
    4-para should be a 50 words final note from Merlin that acknowledges the situation user is in, applauds them for taking the steps to be better at Debt.
    This para MSUT also encourage users to take the next step as well as motivate them. Use key "finalNote" in the JSON
    
    **Key Factors for Recommendation**:
    The most important factors in recommending a path are:
    - **Income to Debt Result number** (primary driver)
    - **Current Payment Status of Debts**: Are they on-time, 90+ days late, charged off, etc.?
    - **Payment Characteristics on Credit Cards**: Are they making the minimum payments or more?
    - **Aggregate Amount of Outstanding Debts**: Total debt load.
    - **Credit Card Utilization Percent**: How much of their credit is used.
    - **Ratio of Credit Card Debt vs Other Debt**: How does credit card debt compare to other debts like personal loans or medical bills?
    - **Equity in Home, Savings, or Other Assets**: How much equity does the user have, and are they willing to liquidate assets to help reduce debt?

    **Debt Relief Paths**:
    The recommendation will fall into one of these four paths:
    
    1. **Restructuring Path**: Debt modification or consolidation, where principal remains the same but interest rates or fees may be adjusted. Suitable for users with temporary financial setbacks but who expect recovery.
    
    2. **Forgiveness Path**: For users who are unlikely to repay their debt in full. This includes debt settlement or bankruptcy, where some or all of the debt may be forgiven.
    
    3. **DIY Path**: For financially capable users who can manage their debts on their own, possibly through debt consolidation or using their available resources to pay down debt without external help.
    
    4. **Alternative Debt Services Path**: For users whose debts do not fit typical debt relief profiles. This includes medical, student loan, or back tax-related debts that may need specialized services.

    **Explanation of Paths**:
    
    - **Restructuring**: Users modify debt terms (like interest rates), often due to temporary hardship. Principal amount stays the same, but they may experience some fee or rate relief.
    
    - **Forgiveness**: Users get their debt reduced or eliminated due to their financial situation, often due to inability to repay or bankruptcy proceedings.
    
    - **DIY**: Users with good financial standing but who may need guidance or reassurance. These users might consider liquidating savings or assets, or using home equity or personal loans.
    
    - **Alternative Debt Services**: Typically for users who have a specific mix of debts (medical, student loans, back taxes) that do not fit traditional debt relief paths.

    **Debt Relief Program Options**:
    
    - **Forgiveness Options**:
        - Debt Settlement
        - Bankruptcy
    
    - **Restructuring Options**:
        - Debt Consolidation
        - Credit Counseling
        - Interest Rate Refinancing
        - Loan Modification
    
    - **DIY Options**:
        - Liquidating savings or investments
        - Selling expensive assets
        - Home Equity Loan
        - Personal Loan
    
    - **Alternative Debt Services**:
        - If medical bills are a significant portion of debt, bankruptcy may be an option.
        - If student loans are a significant portion of the debt, consult student loan specialists.
        - If back taxes are a significant portion, speak with a tax specialist.

    **Typical Client Profiles for Each Option**:
    - **Personal Loan**:
        - Debt payment status less than 60 days late
        - User wants to preserve credit score
        - Debt-free goal within 4+ years
        - Income expected to remain the same or increase
    
    - **Home Equity Loan**:
        - Debt payment status less than 60 days late
        - Owns a home and is willing to leverage it
        - Income expected to remain the same or increase
    
    - **Debt Settlement**:
        - Not charged off, but overdue debts
        - User willing to accept negative credit score impact
        - Debt-free goal within 3 years
        - Minimum debt balance of $15,000
        - Monthly credit card debt servicing cost > $400
    
    - **Bankruptcy**:
        - Debt payment status 90+ days late or charged off
        - Significant unsecured debt or medical bills
        - Income to debt result < $300
        - No assets to liquidate
    
    - **Tax Specialist**:
        - Federal/state taxes make up the majority of debts
    
    - **Student Loan Programs**:
        - Significant student loan debt, with minimal unsecured debt

    **Resources for Actionable Next Steps**:
    - **Credit Card Payoff Calculator**: [Dealing with Debt's Credit Card Payoff Calculator](https://dealingwithdebt.org/credit-card-payoff-calculator/)
    - **Debt Relief Journey Guide**: [Free Course on Debt Relief](https://dealingwithdebt.org/courses/tgtydsj/)
    - **Debt Relief Regulatory Information**: Visit FTC or CFPB for laws and regulations
    - **Accredited Debt Relief Companies**: CDRI and AADR
    - **Consumer Reports**: BBB, TrustPilot
    - **Credit Counseling**: National Foundation for Credit Counseling
    - **Dealing with Debt Community**: Join the support community at Dealing with Debt's website

    **Instructions for AI**:
    - Generate a recommendation based on the user's financial details and the above factors.
    - Provide clear guidance on which path they should follow (Restructuring, Forgiveness, DIY, Alternative Debt Services).
    - If applicable, suggest specific options within each path (e.g., Debt Consolidation, Debt Settlement, etc.).
    - Be empathetic and concise, avoiding superlatives, and focus on actionable advice.
    - Make sure the advice aligns with the user's financial status and goals, considering their debt levels and ability to take action.

    Please provide your recommendation based on these instructions and the user's profile.
    
    Please make your response sound human and empathetic, and avoid using superlatives. Your recommendations should focus on logical analysis based on the user’s financial data and goals, providing actionable advice.`;

    //console.log("effectivePrompt is ", effectivePrompt);
    const aiNarrativeFinalRecommendation = await runMerlinAI(effectivePrompt);

    return aiNarrativeFinalRecommendation
}

async function buildAiNarrativeIncomeToDebt(userName: any, userDisposableIncome: number, totalCCDebt: any, totalOtherDebt: any) {
    let effectivePrompt = `Here is what we know about the User's Income and Debt situation
    Total Monthly Disposible Income == ${userDisposableIncome}
    Total Monthly Debt Payment == ${totalCCDebt} + ${totalOtherDebt}
    User's Name == ${userName}

    Write a 1-paragraph personalized summary to give user an over view of their debt to Monthly Disposible Income ratio. 
    Tell them how much deficit or surplus they have. 
    Tell them how this impacts their margins and pressure on household expense.
    Tell them how this could impact any unexpected expense in the near future.
    The para should not be more than 50 words. 
    Never start with HI or Hello or other similar salutations.
    Do not use superlatives. Make it sound like a human and not a machine or AI bot`

    //console.log("effectivePrompt is ", effectivePrompt)
    const aiNarrative = await runMerlinAI(effectivePrompt)

    // Return the paragraphs
    return aiNarrative; // Return para3 as undefined if it's empty

}

async function buildAiNarrativeLiveEvents(userName: any, lifeEventsList: string, originalDisposableIncome: number, userDisposableIncome: number) {
    let effectivePrompt = `Here is what we know about the User's Live Events 
    Life Events: ${lifeEventsList}
    Monthly Disposible Income to pay of debts (In case of users with no challanging Life Events): ${originalDisposableIncome}
    Available Monthly Disposable Income to pay off debts (After taking into consideration user's personal Life Events ): ${userDisposableIncome}

    Write a 2-paragraph personalized summary to give user an over view of their available Monthly Disposable Income to pay off debts. 
    Each para should not be more than 20 word each. Capture how their personal life events impact and reduce this. 
    DO NOT refer to the life events as we do not want user to relive these as they read this summary. 
    Do not use superlatives. Make it sound like a human and not a machine or AI bot`

    const aiNarrative = await runMerlinAI(effectivePrompt)

    // Split the response into paragraphs based on a double newline
    let splitNarrative = aiNarrative.split("\n\n");

    // Fallback in case of fewer than 3 paragraphs after split
    if (splitNarrative.length < 3) {
        splitNarrative = aiNarrative.split(". ").reduce((acc: { para1: string, para2: string, para3?: string }, sentence: string, idx: number) => {
            if (idx < 3) acc.para1 = (acc.para1 || "") + sentence + ". "; // Add to first paragraph
            else if (idx < 6) acc.para2 = (acc.para2 || "") + sentence + ". "; // Add to second paragraph
            else acc.para3 = (acc.para3 || "") + sentence + ". "; // Add to third paragraph
            return acc;
        }, { para1: "", para2: "" });
    }

    // If splitIncomeNarrative is not yet in three paragraphs, forcefully assign them
    const { para1 = "", para2 = "", para3 = "" } = splitNarrative.length >= 3
        ? { para1: splitNarrative[0], para2: splitNarrative[1], para3: splitNarrative[2] }
        : splitNarrative;

    // Return the paragraphs
    return { para1, para2, para3: para3 || undefined }; // Return para3 as undefined if it's empty


}
async function buildAiNarrativeHouseholdIncome(userName: string, houseHoldAnnualIncome: number, spouseAnnualSalary: number, federalTaxes: number, estimateTaxBracket: number, afterTaxAnnualIncome: number, afterTaxMonthlyIncome: number) {

    let effectivePrompt = `Here is what we know about the User's income 
    User Name: ${userName}
    HouseHold Annual Income: ${houseHoldAnnualIncome}
    Estimated Federal Taxes: ${federalTaxes}
    Estimated Federal Tax Bracket: ${estimateTaxBracket}
    After Tax Annual Income: ${afterTaxAnnualIncome}
    After Tax Monthly Income: ${afterTaxMonthlyIncome}

Write a 1-paragraph personalized summary to give user an over view of their Income after federal taxes. 
The para should not be more than 25 words. 
Capture how Taxes impacts the household income. Share how much are federal taxes and what bracket the user falls into. 
Share how much do they have each month. Do not use superlatives. Make it sound like a human and not a machine or AI bot`

    const aiNarrativeHouseholdIncome = await runMerlinAI(effectivePrompt)

    // Split the response into paragraphs based on a double newline
    let splitIncomeNarrative = aiNarrativeHouseholdIncome.split("\n\n");

    // Fallback in case of no paragraphs after split
    if (splitIncomeNarrative.length <= 1) {
        splitIncomeNarrative = aiNarrativeHouseholdIncome.split(". ").reduce((acc: { para1: string, para2: string }, sentence: string, idx: number) => {
            if (idx < 2) acc.para1 = (acc.para1 || "") + sentence + ". ";
            else acc.para2 = (acc.para2 || "") + sentence + ". ";
            return acc;
        }, { para1: "", para2: "" });
    }

    // If splitIncomeNarrative is not yet in two paragraphs, forcefully assign them
    const { para1 = "", para2 = "" } = splitIncomeNarrative.length > 1 ? { para1: splitIncomeNarrative[0], para2: splitIncomeNarrative[1] } : splitIncomeNarrative;

    return { para1, para2 };
}


