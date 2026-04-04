import {MetricHealthConfig} from "./metric-health-config.interface";

export interface HealthConfig {
    speed: MetricHealthConfig;
    fuel: MetricHealthConfig;
    pressure: MetricHealthConfig;
    temp: MetricHealthConfig;
    brake: MetricHealthConfig;
    engine: MetricHealthConfig;
}