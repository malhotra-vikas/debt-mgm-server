interface Question {
    id: number
    question: string
    type: "text" | "single-select" | "multi-select"
    options?: string[]
    nextQuestion?: string | ((answer: string | string[]) => string)
}

export const personalSituationQuestions: { [key: string]: Question } = {
    life_events: {
        id: 1,
        question: "Have you experienced any recent life events (Divorce, Death of Spouse, Child Birth, or similar)?",
        type: "single-select",
        options: ["Yes", "No"],
        nextQuestion: "catastrophic_loss",
    },
    catastrophic_loss: {
        id: 2,
        question: "Have you experienced a catastrophic loss (house fire, or similar)?",
        type: "single-select",
        options: ["Yes", "No"],
        nextQuestion: "education_expenses",
    },
    education_expenses: {
        id: 3,
        question: "Do you have education expenses (tuition, student loans, etc.)?",
        type: "single-select",
        options: ["Yes", "No"],
        nextQuestion: "caring_family",
    },
    caring_family: {
        id: 4,
        question: "Are you caring for extended family members (aging parents, children, etc.)?",
        type: "single-select",
        options: ["Yes", "No"],
        nextQuestion: "credit_card_expenses",
    },
    situation_description: {
        id: 5,
        question: "Which Do You Feel Best Describes Your Situation?",
        type: "single-select",
        options: ["I need short-term assistance", "I'm in over my head. I will never catch up"],
        nextQuestion: "employment_status",
    }
}
