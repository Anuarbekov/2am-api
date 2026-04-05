import {HealthFactor} from "./health-factor.interface";

export interface HealthResult {
    score: number;
    grade: string;
    factors: HealthFactor[];
}