import trustPhrasesData from "../knowledgebase/trustPhrases.json"

interface TrustPhrase {
    phrase: string
}

export const TrustPhrases: TrustPhrase[] = trustPhrasesData;