import {TelemetryField} from "../types/telemetry-field.type";

export interface ContextCondition {
    field: TelemetryField;
    op: 'lte' | 'lt' | 'gte' | 'gt' | 'eq';
    value: number;
}