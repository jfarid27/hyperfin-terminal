export enum PortfolioAnalysisType {
    Spot = "spot",
    Chart = "chart",
}
    
export type PolymarketPosition = {
    slug: string;
    outcome: string;
    amount: number;
}
    
export type PolymarketPortfolio = {
    positions: PolymarketPosition[];
}
