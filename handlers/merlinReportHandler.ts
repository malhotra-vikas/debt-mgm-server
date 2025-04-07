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

type ReportData = {
    email: string;
    firstName: string;
    fetchAllIncomeForHousehold: IncomeDetails,
    lastName: string;
    houseHoldAnnualIncome: number;
    spouseAnnualSalary: number;
    federalTaxes: number;
    incomeHairCutPercentage: number;
    lifeEventsList: string,
    debtCards: UserCard[]; // Assuming userCards is an array of UserCard objects
    chartBase64: string;
    aiNarrativeHouseholdIncome: AINarrative;
    aiNarrativeLifeEvents: AINarrative;
    //recommendations: string[]; // Assuming recommendations is an array of strings
};

const generatePieChart = async (): Promise<Buffer> => {
    const chartData = {
        type: "pie",
        data: {
            labels: ["Housing", "Transportation", "Food", "Insurance & Pensions", "Healthcare", "Misc", "Savings/Disposable"],
            datasets: [{
                data: [33, 17, 13, 12, 5, 8, 12],
                backgroundColor: ["#FF5733", "#FFBD33", "#FF33D7", "#33D7FF", "#33FF57", "#FF33FF", "#D733FF"]
            }]
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
    console.log("Max debt-free date:", debtFreeDate);


    const payoffSummary = `Based on your current balances and interest rates, paying only the minimum due will take approximately ${maxMonths} months to become debt-free. Over that time, you'll pay an estimated $${aggregateCCInterestPayment.toFixed(2)} in interest.`;

    let debtOverView = `You have an aggregate Credit Card Debt of $${aggregateCCDebt.toFixed(2)}. Your combined credit limit is $${aggregateCCLimit.toFixed(2)}.
            This puts you at a Credit Utilization bracket of ${(aggregateCCDebt / aggregateCCLimit * 100).toFixed(2)}%.
            Merlin estimates that your combined monthly minimum payment is about $${aggregateCCMinimumPayment}`

    let disposableIncomeOverView = `We estimate your Disposable Income (also known as monthly income available for you to payoff your debts) to be $${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * (12 + reportData.incomeHairCutPercentage) / 100).toFixed(2)} per month.`

    console.log("debtOverView framed as ", debtOverView)
    console.log("disposableIncomeOverView framed as ", disposableIncomeOverView)

    const sentimentLabel = getSentimentLabel(
        aggregateCCDebt / aggregateCCLimit * 100,
        aggregateCCMinimumPayment,
        userDisposableIncome
    );

    const creditCardUtilization = calculateCreditCardUtilization(reportData.debtCards)
    console.log("creditCardUtilization framed as ", creditCardUtilization)

    const cardPaymentStatus = calculateCardPaymentStatus(reportData.debtCards)
    console.log("cardPaymentStatus framed as ", cardPaymentStatus)

    const cardPaymentAmount = calculateCardPaymentAmounts(reportData.debtCards)
    console.log("cardPaymentAmount framed as ", cardPaymentAmount)

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
        <p>In the United States, average household spending generally breaks down into the following categories:</p>

        <ul>
        <li>Housing: 33%</li>
        <li>Transportation: 17%</li>
        <li>Food: 13%</li>
        <li>Insurance & Pensions: 12%</li>
        <li>Healthcare: 5%</li>
        <li>Miscellaneous: 8%</li>
        <li>Savings/Disposable: 12%</li>
        </ul>
         <p>The Saving/Disposable income is what you typically use to pay-off your debts.</p>
      </div>

      <!-- Income Section -->
      <div class="section">
        <h2 class="section-title">Your Household Income</h2>
        <div class="ai-summary">
          <p>${reportData.firstName}, Your annual household income is <span clas="bold">$${reportData.fetchAllIncomeForHousehold.houseHoldAnnualIncome}</span>. This equates to a monthly income of <span clas="bold">$${(reportData.fetchAllIncomeForHousehold.houseHoldAnnualIncome / 12).toFixed(2)}</span> before taxes.</p>

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
            <tr>
            <td>${item.category}</td>
            <td>${item.percentage}%</td>
            <td>$${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * item.percentage / 100).toFixed(0)}</td>
            </tr>
        `).join('')}
        </table>

        <p>Applying the national average of Saving/ Disposable income Merlin has estimated that you have about $${(((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12) * 12 / 100).toFixed(0)} of Disposable income in your household</p>

      </div>

      <!-- Life Events -->
      <div class="section">
        <h2 class="section-title">Life Events Analysis</h2>

          <!-- Conditionally Render Life Events -->
          <div class="ai-summary" id="lifeEventsAnalysis">
            ${reportData.lifeEventsList && reportData.lifeEventsList.length > 0 ? `
              <p><em>${emphasizeKeyPhrases(reportData.aiNarrativeLifeEvents.para1)}</em></p>
              <p><em>${emphasizeKeyPhrases(reportData.aiNarrativeLifeEvents.para2)}</em></p>
            ` : '<p>No life events data available.</p>'}
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
      <div class="section">
        <h2 class="section-title">Your Debt Analysis</h2>
        <p>Based on your Credit Card Details, we estimate your Minimum Monthly Payment for each card to be:</p>

        <ul>
        <li>EACH CARD: $minimim monthly payment</li>
        <li>Total across all your cards: $minimim monthly payment</li>
        </ul>


        <p>Based on your Card Balances and Credit Limits, here are the Utilization for each card:</p>

        <ul>
        <li>EACH CARD: Unitization Percentage % : Utilization FLag</li>
        </ul>

            <div class="metrics">
        <!-- Credit Card Utilization -->
        <div class="metric">
            <h3>Credit Card Utilization</h3>
            <!-- Circular meter for utilization -->
            <div class="utilization-meter-container">
                <svg class="utilization-meter" width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <!-- Background circle -->
                    <circle cx="50" cy="50" r="40" stroke="#ddd" stroke-width="6" fill="none" />
                    <!-- Foreground circle representing utilization -->
                    <circle cx="50" cy="50" r="40" stroke="url(#grad)" stroke-width="6" fill="none" stroke-dasharray="${creditCardUtilization.utilization * 2.51}, 251" />
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
            <div class="utilization-text">${creditCardUtilization.utilization.toFixed(1)}%</div>
            <div class="utilization-text">Your Credit Card Utilization is : <span class="bold">${creditCardUtilization.utilizationLabel}</span></div>
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


        <table>
          <tr>
            <th>Card Type</th>
            <th>Balance</th>
            <th>Interest</th>
            <th>Minimum Monthly Payment</th>
            <th>Years to Pay-off</th>
            <th>Total Interest Paid</th>
          </tr>
          ${reportData.debtCards.map(card => `
            <tr>
              <td>${card.cardType}</td>
              <td>$${card.balance.toFixed(2)}</td>
              <td>${card.interest}%</td>
              <td>$${card.minPaymentDue.toFixed(2)}</td>
              <td>${card.yearsToPayoff}</td>
              <td>$${card.totalInterestPaid.toFixed(2)}</td>
            </tr>
          `).join('')}

            <!-- Total Row -->
            <tr style="font-weight: bold;">
            <td>Total</td>
            <td>$${reportData.debtCards.reduce((sum, card) => sum + card.balance, 0).toFixed(2)}</td>
            <td></td>
            <td>$${reportData.debtCards.reduce((sum, card) => sum + card.minPaymentDue, 0).toFixed(2)}</td>
            <td></td>
            <td>$${reportData.debtCards.reduce((sum, card) => sum + card.totalInterestPaid, 0).toFixed(2)}</td>
            </tr>

        </table>


</div>


        <div class="section">
            <h2 class="section-title">Other Debt</h2>
        </div>

        <div class="section">
            <h2 class="section-title">Total Monthly Debt Costs</h2>
        </div>        

        <div class="section">
            <h2 class="section-title">Credit Card Usage Analysis</h2>
        </div>   
        
        <div class="section">
            <h2 class="section-title">Hardship and Vulnerability Factors</h2>
        </div>           

        <div class="section">
            <h2 class="section-title">Merlin's Recommendation</h2>
        </div>    
        
        <div class="section">
            <h2 class="section-title">Next Steps and Suggestions</h2>
        </div>    
        
        


      <!-- Footer -->
      <footer>
        Report generated by Merlin • ${new Date().toLocaleDateString()}
      </footer>

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

            const aiNarrativeLifeEvents = await buildAiNarrativeLiveEvents(userName, lifeEventsList, originalDisposableIncome, userDisposableIncome)
            //console.log(`📌 Successfully computed buildAiNarrativeLiveEvents: ${buildAiNarrativeLiveEvents} `);

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

                console.log("summary came back as ", summary)

                return {
                    ...card,
                    minPaymentDue: parseFloat(minPaymentDue.toFixed(2)),
                    payoffMonths: summary.payoffMonths,
                    yearsToPayoff: summary.yearsToPayoff,
                    totalInterestPaid: summary.totalInterestPaid,
                    debtFreeDate: summary.revisedDebtFreeDate
                };
            });


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
                houseHoldAnnualIncome,
                spouseAnnualSalary,
                federalTaxes,
                lifeEventsList,
                incomeHairCutPercentage,
                debtCards: enrichedCards,
                chartBase64,
                aiNarrativeHouseholdIncome,
                aiNarrativeLifeEvents
                //recommendations: generateRecommendations(userData)
            };

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


