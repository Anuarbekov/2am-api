import {HealthFactor} from "./health-factor.interface";

export interface HealthResult {
    index: number;
    grade: string;
    factors: HealthFactor[];
    confidence: number;
}