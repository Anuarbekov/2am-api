import {ContextCondition} from "./context-condition.interface";

export interface MetricHealthConfig {
    weight: number;
    optimal: [number, number];
    critical: [number, number];
    contextualBands?: Array<{
        when: ContextCondition[];
        optimal: [number, number];
        critical: [number, number];
    }>;
}