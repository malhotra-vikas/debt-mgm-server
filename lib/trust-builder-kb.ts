import trustPhrasesData from "../lib/trustPhrases.json"

interface TrustPhrase {
    phrase: string
}

export const TrustPhrases: TrustPhrase[] = trustPhrasesData;