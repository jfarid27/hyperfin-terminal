import { getRedditBest, getRedditSearchTop } from "./reddit.ts";

export const reddit = {
    get: getRedditBest,
    search: getRedditSearchTop,
}


/**
 * News model
 */
export const news = {
    reddit
}

export default news;