import {
    fetchMarketsByEventTicker,
} from "./Kalshi.ts";

const KalshiData = {
    markets: {
        getByEventTicker: fetchMarketsByEventTicker,
    },
}

const PredictionMarketsData = {
   kalshiData: KalshiData
}

export default PredictionMarketsData;
