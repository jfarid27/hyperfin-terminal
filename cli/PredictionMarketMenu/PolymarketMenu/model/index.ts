import {
    fetchTopicsPolymarket, fetchEventDataByTagId,
    fetchMarketDataByTagId, fetchTopEventData,
    fetchTopMarketData,
    fetchMarketDataBySlug,
    fetchEventDataBySlug,
    fetchUserPositions,
    fetchMarketPriceHistoryByClobId,
    fetchSearchPolymarket,
} from "./Polymarket.ts";

const PolymarketData = {
    tags: {
        get: fetchTopicsPolymarket,
    },
    events: {
        getByTagId: fetchEventDataByTagId,
        top: fetchTopEventData,
    },
    event: {
        getBySlug: fetchEventDataBySlug,
    },
    markets: {
        getByTagId: fetchMarketDataByTagId,
        top: fetchTopMarketData,
    },
    market: {
        getBySlug: fetchMarketDataBySlug,
        prices: fetchMarketPriceHistoryByClobId,
    },
    user: {
        getPositions: fetchUserPositions,
    },
    search: {
        get: fetchSearchPolymarket,
    }
}

const PredictionMarketsData = {
   polyMarketData: PolymarketData,    
}

export default PredictionMarketsData;