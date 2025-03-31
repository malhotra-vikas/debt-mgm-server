type NationalStats = {
    housing: number;
    transportation: number;
    food: number;
    personalInsuranceAndPensions: number;
    healthcare: number;
    misc: number;
    savingsDisposable: number;
};

const nationalStats: NationalStats = {
    housing: 33,
    transportation: 17,
    food: 13,
    personalInsuranceAndPensions: 12,
    healthcare: 5,
    misc: 8,
    savingsDisposable: 12
};

// Function to display national stats
export const displayNationalStats = (stats: NationalStats): void => {
    console.log("National Stats Breakdown:");
    console.log(`Housing: ${stats.housing}%`);
    console.log(`Transportation: ${stats.transportation}%`);
    console.log(`Food: ${stats.food}%`);
    console.log(`Personal Insurance & Pensions: ${stats.personalInsuranceAndPensions}%`);
    console.log(`Healthcare: ${stats.healthcare}%`);
    console.log(`Misc: ${stats.misc}%`);
    console.log(`Savings / Disposable: ${stats.savingsDisposable}%`);
}


