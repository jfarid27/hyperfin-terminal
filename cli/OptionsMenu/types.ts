import { DataSourceType } from "cli/types.ts";

export interface OptionSymbolType {
    name: string;
    id: string;
    _type: DataSourceType;
}
