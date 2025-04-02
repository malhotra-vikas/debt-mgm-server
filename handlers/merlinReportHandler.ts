import { Request, Response, NextFunction } from "express";
import { getUserByEmail } from "../database/postGresDBOperations";
import path from "path";
import puppeteer from "puppeteer"; // Import Puppeteer
import axios from "axios";
import dotenv from "dotenv";

// Importing the UserData interface if needed
import { Data, UserCard } from "../lib/UserData";  // Adjust this path as needed
import { calculatePaymentSchedule, calculateTax, calculateTotalAnnualIncome, computeHairCutPercentage, FormValues, getSentimentLabel } from "../lib/report-utils";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Define Type for User Data
interface UserData {
    email: string;
    data: any;
}

type ReportData = {
    email: string;
    firstName: string;
    lastName: string;
    houseHoldAnnualIncome: number;
    spouseAnnualSalary: number;
    federalTaxes: number;
    incomeHairCutPercentage: number;
    lifeEventsList: string,
    debtCards: UserCard[]; // Assuming userCards is an array of UserCard objects
    chartBase64: string;
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
    const browser = await puppeteer.launch();
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

    const aiSummary = await buildAiSummary(debtOverView, disposableIncomeOverView, payoffSummary)
    console.log("aiSummary framed as ", aiSummary)

    const [para1, para2] = aiSummary.split("\n\n").length > 1
        ? aiSummary.split("\n\n")
        : aiSummary.split(". ").reduce((acc: string[], sentence: string, idx: number) => {
            if (idx < 2) acc[0] = (acc[0] || "") + sentence + ". ";
            else acc[1] = (acc[1] || "") + sentence + ". ";
            return acc;
        }, []);
    // Define the HTML content for the PDF
    const content = `
<html>
    <head>
        <link rel="stylesheet" type="text/css" href=${url}">
    </head>
    <body>
        <div class="container">
            <h1>Merlin Assessment Report for ${reportData.firstName} ${reportData.lastName}</h1>

            <h2>Household Income Analysis</h2>
            <table>
                <tr>
                    <th>Description</th>
                    <th>Amount</th>
                </tr>
                <tr><td>Gross Annual Household Income</td><td>$${reportData.houseHoldAnnualIncome.toFixed(2)}</td></tr>
                <tr><td>${reportData.firstName}'s Gross Annual Income</td><td>$${(reportData.houseHoldAnnualIncome - reportData.spouseAnnualSalary).toFixed(2)}</td></tr>
                <tr><td>Spouse's Gross Annual Income</td><td>$${reportData.spouseAnnualSalary.toFixed(2)}</td></tr>
            </table>

            <p>Based on our analysis, your household income will be subjected to approximately 
                <span class="highlight">${(reportData.federalTaxes / reportData.houseHoldAnnualIncome * 100).toFixed(2)}%</span> in federal taxes, amounting to 
                $${reportData.federalTaxes.toFixed(2)}.</p>

            <p>Your monthly after-tax income will be about 
                $${((reportData.houseHoldAnnualIncome - reportData.federalTaxes) / 12).toFixed(2)}.</p>

            <h2>Life Events Analysis</h2>
            <p>${reportData.firstName}, you mentioned having experienced the following life events:</p>
            <ul>${reportData.lifeEventsList}</ul>

            <p>As per our research, such events have a high impact on your available disposable income. We estimate your Disposable Income (also known as monthly income available 
                for you to payoff your debts) to be <span class="highlight">${userDisposableIncome} per month.</span>
            </p>

            <h2>Debt Analysis</h2>
            <table>
                <tr>
                    <th>Card Type</th>
                    <th>Balance</th>
                    <th>Utilization</th>
                    <th>Payment Status</th>
                    <th>Payment Type</th>
                    <th>Card Status</th>
                </tr>
                ${reportData.debtCards.map((card: any) => `
                <tr>
                    <td>${card.cardType}</td>
                    <td>$${card.balance.toFixed(2)}</td>
                    <td>${(card.balance / card.creditLimit * 100).toFixed(2)}%</td>
                    <td>${card.paymentTimelyStatus}</td>
                    <td>${card.monthlyPaymentType}</td>
                    <td>${card.cardUseStatus}</td>
                </tr>
                `).join('')}
            </table>

            <h3>Debt Free Outlook</h3>
            <table>
                <tr>
                    <th>Card Type</th>
                    <th>Balance</th>
                    <th>Interest</th>
                    <th>Minimum Payment Due</th>
                    <th>Payoff Time (Months)</th>
                    <th>Total Interest Paid</th>
                </tr>
                ${reportData.debtCards.map((card: any) => `
                <tr>
                    <td>${card.cardType}</td>
                    <td>$${card.balance.toFixed(2)}</td>
                    <td>${parseFloat(card.interest).toFixed(2)}</td>
                    <td>$${card.minPaymentDue}</td>
                    <td>${card.payoffMonths}</td>
                    <td>$${card.totalInterestPaid}</td>
                </tr>
                
                `).join('')}
            </table>

            <h3>Merlin Debt Sentiment Summary: <span class="sentiment-label">${sentimentLabel}</span></h3>

            <div class="ai-summary">
                <p><em>${para1}</em></p>
                <p><em>${para2}</em></p>
            </div>

            <h2>Other Debt</h2>
            <h2>Total Monthly Debt Costs</h2>

            <h2>Income to Debt Ratio</h2>
            <p>PLaceholder for an AI generated analysis and summary</p>

            <h2>Credit Card Usage Analysis</h2>
            <p>PLaceholder for an AI generated analysis and summary</p>

            <h2>Hardship and Vulnerability Factors</h2>
            <p>PLaceholder for an AI generated analysis and summary</p>

            <h2>Final Recommendation</h2>
            <p>PLaceholder for an AI generated analysis and summary</p>

            <h2>Next Steps and Suggestions</h2>
            <p>PLaceholder for an AI generated analysis and summary</p>

            <h2>Household Spending Breakdown</h2>
            <div class="chart-container">
                <img src="data:image/png;base64,${reportData.chartBase64}" alt="Spending Breakdown Chart" width="400">
            </div>
        </div>
        </body>
    </html>
    `;

    // Set the content and generate the PDF
    await page.setContent(content);
    const pdfPath = path.join(__dirname, `../uploads/${email}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4' });

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

            let annualIncomes = calculateTotalAnnualIncome(userData);
            let houseHoldAnnualIncome = annualIncomes.houseHoldAnnualIncome
            let spouseAnnualSalary = annualIncomes.spouseIncome

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

            let userEventsAndImppact = computeHairCutPercentage(userData);
            let incomeHairCutPercentage = userEventsAndImppact.hairCutPercentage
            let userLifeEvents = userEventsAndImppact.lifeEvents

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
                    minimumPayment: minPaymentDue,
                    additionalPayment: 0, // assume no extra payment
                    requiredPrincipalPercentage: 1 // 1% as per your logic
                };
            
                const [_, summary] = calculatePaymentSchedule(formValues);
            
                return {
                    ...card,
                    minPaymentDue: parseFloat(minPaymentDue.toFixed(2)),
                    payoffMonths: summary.monthsToPayoff,
                    totalInterestPaid: summary.totalInterestPaid
                };
            });                    


            // Generate Pie Chart for Household Spending
            const chartBuffer = await generatePieChart();
            const chartBase64 = chartBuffer.toString('base64'); // Convert the chart to base64

            // Preparing data for the report
            const reportData: ReportData = {
                email,
                firstName: userData.data.personFirstName,
                lastName: userData.data.personLastName,
                houseHoldAnnualIncome,
                spouseAnnualSalary,
                federalTaxes,
                lifeEventsList,
                incomeHairCutPercentage,
                debtCards: enrichedCards,
                chartBase64,
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

async function buildAiSummary(debtOverView: string, disposableIncomeOverView: string, payoffProjection: string) {

    let effectivePrompt = `1. Credit Utilization & Limits: ${debtOverView}
                            2. Disposable Income Situation: ${disposableIncomeOverView}
                            3. Debt Payoff Projection: ${payoffProjection}.
        Write a 2-paragraph personalized summary. 
            - First paragraph: Describe their current debt burden and income gap.
            - Second paragraph: Highlight debt outlook, expected payoff timeline and interest cost.
        Each para should be no more than 40 word each. Do not use superlatives. Make it sound like a human and not a machine or AI bot`

    const chatMessages = [
        {
            role: "system", content: `Your name is Merlin. You are an A.I. Assistant with Dealing With Debt (DWD). 
            You're a financial advisor summarizing a user's credit health. 
            Your goal is to build a trust worthy and reliable debt management report for the users. 
            Your responses will be added to the report that is sent to the users  `
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
        console.log("askOpenAI - Parsed Response:", responseData);

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

